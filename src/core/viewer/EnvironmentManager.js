import * as THREE from 'three'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import LightDragHelper from './LightDragHelper.js'

// ========== 环境配置 ==========

/** 背景默认底色（无 HDR 且 bgInt=0 时使用） */
const BG_COLOR = 0x1a1a2e

/** 渐变背景颜色（环境贴图关闭时的回退背景，与 environment.js 一致） */
const GRADIENT_COLORS = [
  { stop: 0, color: '#46557a' },
  { stop: 0.55, color: '#232e47' },
  { stop: 1, color: '#0e1422' },
]

/** 默认 HDR 路径 */
const DEFAULT_HDR_PATH = './assets/studio.exr'

/** 默认环境配置（无外部文件时使用） */
const DEFAULT_CONFIG = Object.freeze({
  envMapEnabled: false,
  dirLight: {
    intensity: 1,
    yaw: 45,
    pitch: 50,
    color: '#ffffff',
    shadow: {
      enabled: true,
      resolution: 4096,
      range: 62,
      offsetX: 0,
      offsetY: 0,
      bias: -0.001,
    },
  },
  envLight: { intensity: 1, bgIntensity: 1.5, exposure: 1 },
})

// ========== 环境管理器 ==========

/**
 * 场景环境统一配置入口（v2，对齐 environment.js）。
 *
 * 管理 HDR 环境贴图、主方向光（含阴影）、环境/背景强度、
 * 渐变背景回退、色调映射曝光和泛光参数。
 *
 * 用法：
 * ```js
 * const env = new EnvironmentManager(scene, renderer)
 * env.applyConfig(configObject)
 * ```
 */
export class EnvironmentManager {
  scene
  renderer

  /** HDR 环境贴图（EXR），为 PBR 材质提供环境反射与背景 */
  hdrTexture = null
  /** 渐变背景纹理（envMap 关闭时的回退背景） */
  gradientBgTexture = null

  /** 主方向光引用（只创建一次，永不重建） */
  dirLight = null
  /** 半球光引用 */
  hemiLight = null
  /** 补光引用 */
  fillLight = null

  /** 灯光方向可拖拽控制器 */
  lightDragHelper = null

  /** 相机引用（拖拽辅助线需要） */
  camera = null
  /** OrbitControls 引用 */
  controls = null

  /** 当前配置缓存（applyAllParams 后保留，供后续局部更新使用） */
  config = null

  /** 上一次使用的 yaw/pitch（用于检测面板是否改了角度） */
  _lastYaw = null
  _lastPitch = null

  /**
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} renderer
   */
  constructor(scene, renderer) {
    this.scene = scene
    this.renderer = renderer
  }

  // ========== 公共方法 ==========

  /**
   * 传入配置对象应用环境参数。
   * 当 envMapEnabled 为 true 时自动加载 HDR 环境贴图（优先使用配置中的 hdrPath，否则使用默认路径）。
   * @param {Object} cfg - 环境配置对象
   */
  async applyConfig(cfg) {
    if (!cfg) return
    this.config = cfg

    // 灯光/背景/曝光 不依赖 HDR，立即应用（确保 dirLight 立刻可用）
    this.applyAllParams()

    // HDR 环境贴图异步加载，加载完成后重新应用 IBL 和背景
    if (cfg.envMapEnabled) {
      const hdrPath = cfg.envLight?.hdrPath ?? DEFAULT_HDR_PATH
      await this.loadHdrEnvironment(hdrPath)
      this.applyAllParams()
    }

    if (!cfg.envMapEnabled) {
      this.scene.background = null
    }
  }

  /**
   * 应用全部参数（可反复调用，对齐 environment.js applyAllParams）。
   * 必须先调用 applyConfig 完成初始化。
   */
  applyAllParams() {
    const cfg = this.config
    if (!cfg) return

    // ---- 1. 主方向光 ----
    this.setupDirLight(cfg)

    // ---- 2. 环境照明(IBL) ----
    const envInt = cfg.envLight.intensity
    if (envInt > 0 && this.hdrTexture) {
      this.scene.environment = this.hdrTexture
      this.scene.environmentIntensity = envInt
    } else if (envInt > 0) {
      this.scene.environment = null
      this.scene.environmentIntensity = envInt
    } else {
      this.scene.environment = null
      this.scene.environmentIntensity = 0
    }

    // ---- 3. 背景 ----
    // envMapEnabled 开关仅控制背景显隐，停用时换渐变底
    const bgInt = cfg.envLight.bgIntensity
    if (!cfg.envMapEnabled) {
      this.scene.background = this.getGradientBackground()
      this.scene.backgroundIntensity = 1
    } else if (envInt === 0 && bgInt === 0) {
      this.scene.background = this.getGradientBackground()
      this.scene.backgroundIntensity = 1
    } else if (bgInt > 0 && this.hdrTexture) {
      this.scene.background = this.hdrTexture
      this.scene.backgroundIntensity = bgInt
    } else if (bgInt > 0) {
      this.scene.background = new THREE.Color(0x000000)
      this.scene.backgroundIntensity = bgInt
    } else {
      this.scene.background = new THREE.Color(BG_COLOR)
      this.scene.backgroundIntensity = 0
    }

    // ---- 4. 曝光度 ----
    this.renderer.toneMappingExposure = cfg.envLight.exposure
  }

  /** 获取主方向光引用（可能为 null，applyConfig 后才有值） */
  getDirLight() {
    return this.dirLight
  }

  /** 获取当前环境配置快照 */
  getConfig() {
    return this.config
  }

  /** 释放环境相关 GPU 资源 */
  dispose() {
    if (this.scene.environment) {
      this.scene.environment.dispose()
      this.scene.environment = null
    }
    if (this.hdrTexture) {
      this.hdrTexture.dispose()
      this.hdrTexture = null
    }
    if (this.gradientBgTexture) {
      this.gradientBgTexture.dispose()
      this.gradientBgTexture = null
    }
    this.removeLightHelper()
    // 移除灯光
    if (this.dirLight) { this.scene.remove(this.dirLight); this.dirLight = null }
    if (this.hemiLight) { this.scene.remove(this.hemiLight); this.hemiLight = null }
    if (this.fillLight) { this.scene.remove(this.fillLight); this.fillLight = null }
  }

  /** 控制环境贴图是否启用，关闭时背景透明 */
  controlEnvMapEnabled(enabled) {
    if (!this.config) return
    this.config.envMapEnabled = enabled

    if (!enabled) {
      this.scene.background = null
    } else {
      this.applyAllParams()
    }
  }

  /**
   * 显示/隐藏灯光方向控制线（可拖拽）。
   * @param {boolean} show
   */
  toggleLightHelper(show) {
    // 防御：如果配置已加载但灯光尚未创建，先创建灯光
    if (show && !this.dirLight) {
      if (!this.config) {
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
      }
      this.setupDirLight(this.config)
    }
    if (show && this.dirLight && this.camera) {
      if (!this.lightDragHelper) {
        // 首次开启：根据当前场景尺度重新计算灯光距离（模型可能已加载，场景包围盒变化）
        this._recalcLightDistance()
        this.lightDragHelper = new LightDragHelper(
          this.scene, this.camera, this.renderer, this.controls,
          (lightPos, targetPos) => this._onLightDrag(lightPos, targetPos),
        )
      }
      this.lightDragHelper.group.visible = true
      this.lightDragHelper.syncFromLight(this.dirLight, this.dirLight.target)
    } else if (this.lightDragHelper) {
      this.lightDragHelper.group.visible = false
      this.lightDragHelper.transformControls.detach()
      this.lightDragHelper.transformControls.visible = false
    }
  }

  /** 根据当前场景包围盒重新计算灯光距离（模型加载后场景尺度可能变化很大） */
  _recalcLightDistance() {
    const dl = this.config?.dirLight
    if (!dl || !this.dirLight) return
    const yaw = THREE.MathUtils.degToRad(dl.yaw ?? 45)
    const pitch = THREE.MathUtils.degToRad(dl.pitch ?? 50)
    const tp = dl.targetPos ?? { x: 0, y: 0, z: 0 }
    const targetVec = new THREE.Vector3(tp.x, tp.y, tp.z)
    const box = this._getModelBounds() ?? new THREE.Box3()
    const size = new THREE.Vector3()
    box.getSize(size)
    const radius = Math.max(size.length() * 0.6, 50)
    const dir = new THREE.Vector3()
    dir.setFromSphericalCoords(1, Math.PI / 2 - pitch, yaw)
    this.dirLight.position.copy(targetVec).addScaledVector(dir, radius)
    this.dirLight.target.position.copy(targetVec)
    this.dirLight.target.updateMatrixWorld(true)
    // 同步到配置
    dl.lightPos = { x: this.dirLight.position.x, y: this.dirLight.position.y, z: this.dirLight.position.z }
    this._lastYaw = dl.yaw
    this._lastPitch = dl.pitch
  }

  /** 拖拽回调：更新灯光位置并同步到配置中的 lightPos/targetPos + yaw/pitch */
  _onLightDrag(lightPos, targetPos) {
    if (!this.dirLight) return
    this.dirLight.position.copy(lightPos)
    if (this.dirLight.target) {
      this.dirLight.target.position.copy(targetPos)
      this.dirLight.target.updateMatrixWorld(true)
    }
    // 同步到配置
    if (this.config?.dirLight) {
      const dl = this.config.dirLight
      dl.lightPos = { x: lightPos.x, y: lightPos.y, z: lightPos.z }
      dl.targetPos = { x: targetPos.x, y: targetPos.y, z: targetPos.z }
      // 反算 yaw/pitch 供面板显示
      const r = lightPos.distanceTo(targetPos)
      if (r > 0) {
        const dx = lightPos.x - targetPos.x
        const dy = lightPos.y - targetPos.y
        const dz = lightPos.z - targetPos.z
        dl.yaw = Math.round(((THREE.MathUtils.radToDeg(Math.atan2(dx, dz)) % 360) + 360) % 360)
        dl.pitch = Math.round(Math.max(0, Math.min(90, 90 - THREE.MathUtils.radToDeg(Math.acos(dy / r)))))
        // 同步 _lastYaw/_lastPitch，避免下次 setupDirLight 误判 yaw/pitch 变了而覆盖拖拽位置
        this._lastYaw = dl.yaw
        this._lastPitch = dl.pitch
      }
    }
  }

  /** 移除辅助线 */
  removeLightHelper() {
    if (this.lightDragHelper) {
      this.lightDragHelper.dispose()
      this.lightDragHelper = null
    }
  }

  // ========== 内部方法 ==========

  /** 设置主方向光 + 阴影（灯光只创建一次，后续只更新属性） */
  setupDirLight(cfg) {
    const dl = cfg.dirLight

    // ---- 首次创建灯光（之后只更新属性，永不重建） ----
    if (!this.dirLight) {
      this.dirLight = new THREE.DirectionalLight(dl.color, dl.intensity)
      this.dirLight.layers.enableAll()
      this.scene.add(this.dirLight)
      this.scene.add(this.dirLight.target)

      // 阴影初始化（只设一次，对齐参考项目 main.js L168/L249-258）
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFShadowMap
      this.dirLight.castShadow = true
      this.dirLight.shadow.mapSize.set(4096, 4096)
      this.dirLight.shadow.camera.autoUpdate = false

      this.hemiLight = new THREE.HemisphereLight('#dbeafe', '#020617', 0.6)
      this.hemiLight.position.set(0, 1, 0)
      this.hemiLight.layers.enableAll()
      this.scene.add(this.hemiLight)

      this.fillLight = new THREE.DirectionalLight('#93c5fd', 0.4)
      this.fillLight.position.set(-100, 60, -80)
      this.fillLight.layers.enableAll()
      this.scene.add(this.fillLight)
    }

    const mainLight = this.dirLight

    // ---- 更新灯光属性 ----
    mainLight.intensity = dl.intensity
    mainLight.color.set(dl.color)

    // ---- 灯光位置：从 yaw/pitch 计算，同步到 lightPos ----
    const yaw = THREE.MathUtils.degToRad(dl.yaw ?? 45)
    const pitch = THREE.MathUtils.degToRad(dl.pitch ?? 50)
    const tp = dl.targetPos ?? { x: 0, y: 0, z: 0 }
    const targetVec = new THREE.Vector3(tp.x, tp.y, tp.z)

    // 仅在 yaw/pitch 变化（面板修改）或首次时重算位置；拖拽后 _onLightDrag 已直接写入 lightPos
    const yawChanged = this._lastYaw !== dl.yaw || this._lastPitch !== dl.pitch
    if (yawChanged || !dl.lightPos) {
      // 灯光距离：仅从模型 mesh 计算包围盒，排除灯光/辅助线
      const box = this._getModelBounds() ?? new THREE.Box3()
      const size = new THREE.Vector3()
      box.getSize(size)
      const radius = Math.max(size.length() * 0.6, 50)
      // 方向从 yaw/pitch 算出，位置 = target + 方向 * 距离
      const dir = new THREE.Vector3()
      dir.setFromSphericalCoords(1, Math.PI / 2 - pitch, yaw)
      mainLight.position.copy(targetVec).addScaledVector(dir, radius)
      // 缓存到配置
      dl.lightPos = { x: mainLight.position.x, y: mainLight.position.y, z: mainLight.position.z }
      this._lastYaw = dl.yaw
      this._lastPitch = dl.pitch
    } else {
      // 拖拽后的位置，直接使用 lightPos
      mainLight.position.set(dl.lightPos.x, dl.lightPos.y, dl.lightPos.z)
    }
    mainLight.target.position.copy(targetVec)
    mainLight.target.updateMatrixWorld(true)

    // 更新辅助线（如果已开启）
    if (this.lightDragHelper?.group.visible) {
      this.lightDragHelper.syncFromLight(mainLight, mainLight.target)
    }

    // ---- 阴影（renderer.shadowMap.enabled 在灯光创建时已设为 true 且永不关闭） ----
    const sh = dl.shadow
    if (sh.enabled) {
      mainLight.castShadow = true
      mainLight.shadow.mapSize.set(sh.resolution ?? 4096, sh.resolution ?? 4096)
      const range = sh.range ?? 62
      const ox = sh.offsetX ?? 0
      const oy = sh.offsetY ?? 0
      mainLight.shadow.camera.left = -range + ox
      mainLight.shadow.camera.right = range + ox
      mainLight.shadow.camera.top = range + oy
      mainLight.shadow.camera.bottom = -range + oy
      mainLight.shadow.camera.near = 0.5
      mainLight.shadow.camera.far = Math.max(range * 4, mainLight.position.length() + range)
      mainLight.shadow.bias = sh.bias ?? -0.001
      // 重新开启阴影时强制刷新 shadow map
      if (mainLight.shadow.map) {
        mainLight.shadow.map.dispose()
        mainLight.shadow.map = null
      }
      mainLight.shadow.needsUpdate = true
      // 首次加载或模型加载后确保所有 mesh 有 castShadow/receiveShadow
      if (!this._meshShadowsInitialized) {
        this._setMeshShadows(true)
        this._meshShadowsInitialized = true
      }
    } else {
      mainLight.castShadow = false
    }
    mainLight.shadow.camera.updateProjectionMatrix()
  }

  // ========== 阴影管理 ==========


  /** 遍历场景所有 mesh 设置 castShadow / receiveShadow（排除控制手柄） */
  _setMeshShadows(enabled) {
    this.scene.traverse((obj) => {
      if (!obj.isMesh) return
      if (obj.userData.isControlHandle) return
      obj.castShadow = enabled
      obj.receiveShadow = enabled
    })
  }

  /**
   * 自动适配阴影相机范围到当前场景尺度。
   * 仅从模型 mesh 计算包围盒，排除控制手柄和灯光子对象。
   */
  _autoFitShadowCamera() {
    if (!this.dirLight) return
    const box = this._getModelBounds()
    if (!box) return
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const range = Math.max(maxDim * 1.5, 5)
    this.dirLight.shadow.camera.left = -range
    this.dirLight.shadow.camera.right = range
    this.dirLight.shadow.camera.top = range
    this.dirLight.shadow.camera.bottom = -range
    this.dirLight.shadow.camera.near = 0.01
    this.dirLight.shadow.camera.far = Math.max(50, range * 5)
    this.dirLight.shadow.camera.updateProjectionMatrix()
  }

  /** 获取场景中所有模型 mesh 的包围盒（排除控制手柄和灯光子对象） */
  _getModelBounds() {
    const box = new THREE.Box3()
    this.scene.traverse((obj) => {
      if (!obj.isMesh) return
      if (obj.userData.isControlHandle) return
      if (obj.parent?.isLight) return
      box.expandByObject(obj)
    })
    return box.isEmpty() ? null : box
  }

  /** 生成渐变背景纹理（与 environment.js getGradientBackground 一致） */
  getGradientBackground() {
    if (this.gradientBgTexture) return this.gradientBgTexture
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 512
    const ctx2d = canvas.getContext('2d')
    const grad = ctx2d.createLinearGradient(0, 0, 0, 512)
    for (const { stop, color } of GRADIENT_COLORS) {
      grad.addColorStop(stop, color)
    }
    ctx2d.fillStyle = grad
    ctx2d.fillRect(0, 0, 16, 512)
    this.gradientBgTexture = new THREE.CanvasTexture(canvas)
    this.gradientBgTexture.colorSpace = THREE.SRGBColorSpace
    return this.gradientBgTexture
  }

  /** 加载 HDR 环境贴图（EXR 格式） */
  loadHdrEnvironment(path) {
    if (!path) return Promise.resolve()
    return new Promise((resolve) => {
      new EXRLoader().load(
        path,
        (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping
          this.hdrTexture = tex
          resolve()
        },
        undefined,
        (err) => {
          console.warn('[EnvironmentManager] HDR 加载失败', err)
          resolve()
        },
      )
    })
  }

}

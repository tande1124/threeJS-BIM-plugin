import * as THREE from 'three'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import LightDragHelper from './LightDragHelper.js'

// ========== 环境配置 ==========

/** 背景默认底色（无 HDR 且 bgInt=0 时使用） */
const BG_COLOR = 0x1a1a2e


/** 默认 HDR 路径 */
const DEFAULT_HDR_PATH = './cdn/assets/studio.exr'

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
  envLight: { intensity: 0.3, bgIntensity: 1.5, exposure: 1 },
  bloom: { enabled: false, strength: 0.001, radius: 0, threshold: 0 },
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

  /** 后处理合成器（始终创建，Bloom 通过 pass.enabled 切换） */
  composer = null
  /** UnrealBloomPass 实例 */
  bloomPass = null
  /** OutlinePass 实例：选中部件描边发光 */
  outlinePass = null
  /** OutlinePass 专用相机（全图层可见） */
  outlineCamera = null
  /** RenderPass 实例 */
  _renderPass = null
  /** 描边叠加用临时渲染目标（双透视模式下独立渲染 OutlinePass） */
  _outlineRT = null

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

    // 后期泛光（独立应用，参照 environment.js applyBloom）
    this.applyBloom(cfg.bloom)

    // 始终加载 HDR 环境贴图（IBL 照明需要，与 envMapEnabled 背景开关无关）
    const hdrPath = cfg.envLight?.hdrPath ?? DEFAULT_HDR_PATH
    await this.loadHdrEnvironment(hdrPath)
    this.applyAllParams()
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
    } else {
      this.scene.environment = null
      this.scene.environmentIntensity = 0
    }

    // ---- 3. 背景（与 envMapEnabled 无关，bgIntensity 始终生效） ----
    const bgInt = cfg.envLight.bgIntensity
    if (bgInt > 0 && cfg.envMapEnabled && this.hdrTexture) {
      this.scene.background = this.hdrTexture
      this.scene.backgroundIntensity = bgInt
    } else if (bgInt > 0) {
      this.scene.background = this.getGradientBackground()
      this.scene.backgroundIntensity = bgInt
    } else {
      this.scene.background = new THREE.Color(BG_COLOR)
      this.scene.backgroundIntensity = 0
    }

    // ---- 4. 曝光度 ----
    this.renderer.toneMappingExposure = cfg.envLight.exposure

    // 注意：bloom 不在此处应用，由 _applyBloom 独立控制（参照 environment.js applyBloom）
  }

  /** 获取主方向光引用（可能为 null，applyConfig 后才有值） */
  getDirLight() {
    return this.dirLight
  }

  /** 获取当前环境配置快照 */
  getConfig() {
    return this.config
  }

  /**
   * Composer 是否已初始化。
   * 渲染循环中用于判断是否走 composer.render()。
   * @returns {boolean}
   */
  hasComposer() {
    return !!this.composer
  }

  /**
   * 通过合成器渲染一帧（后处理模式）。
   * 渲染循环中调用，无需参数（使用构造时注入的 scene/camera）。
   */
  renderComposer() {
    if (this._renderPass) {
      this._renderPass.scene = this.scene
      this._renderPass.camera = this.camera
    }
    // 临时让主相机也渲染 Layer 1（GLB），避免 dualPass 模式下 GLB 不可见
    const savedMask = this.camera.layers.mask
    this.camera.layers.enable(1)
    try {
      this.composer.render()
    } finally {
      this.camera.layers.mask = savedMask
    }
  }

  /**
   * 初始化后处理管道（RenderPass → UnrealBloomPass → OutputPass）。
   * 必须在 camera 就绪后调用，只调用一次。
   * bloomPass 始终在管道中，通过 .enabled 切换开关。
   */
  initPostProcessing() {
    if (this.composer) return

    const size = this.renderer.getSize(new THREE.Vector2())
    const pixelRatio = this.renderer.getPixelRatio()

    this.composer = new EffectComposer(this.renderer)
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(size.x, size.y)

    // RenderPass：渲染场景到 composer 帧缓冲
    this._renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this._renderPass)

    // OutlinePass：选中部件描边（始终在管道中，通过 selectedObjects 控制）
    this.outlineCamera = this.camera.clone()
    this.outlineCamera.layers.enableAll()
    this.outlinePass = new OutlinePass(
      new THREE.Vector2(size.x, size.y), this.scene, this.outlineCamera
    )
    this.outlinePass.edgeStrength = 3.0
    this.outlinePass.edgeGlow = 0.0
    this.outlinePass.edgeThickness = 1.2
    this.outlinePass.visibleEdgeColor.set(0x00ddff)
    this.outlinePass.hiddenEdgeColor.set(0x444444)
    this.outlinePass.selectedObjects = []
    this.composer.addPass(this.outlinePass)

    // OutputPass：色调映射 + 色彩空间转换
    const outputPass = new OutputPass()
    this.composer.addPass(outputPass)

    // UnrealBloomPass：泛光后处理（始终在管道中，通过 enabled 切换）
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.001, // 默认 strength
      0,     // 默认 radius
      0,     // 默认 threshold
    )
    this.bloomPass.enabled = false // 默认关闭
    this.composer.addPass(this.bloomPass)

    // ---- 描边叠加用正交场景（双透视模式下将描边 alpha 混合到屏幕） ----
    this._overlayScene = new THREE.Scene()
    this._overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10)
    const overlayMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    this._overlayQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), overlayMat)
    this._overlayScene.add(this._overlayQuad)
  }

  /**
   * 更新 OutlinePass 选中对象（每帧调用）。
   * @param {THREE.Object3D[]} selectedObjects - 当前选中的网格列表
   */
  updateOutline(selectedObjects) {
    if (!this.outlinePass) return
    this.outlinePass.selectedObjects = selectedObjects || []
  }

  /**
   * 双透视模式下的描边叠加渲染。
   *
   * 在双透视三步合成完成后调用，将 OutlinePass 产生的描边
   * 以 alpha 混合方式叠加到屏幕上，不影响已有的外壳 + GLB 合成结果。
   *
   * 原理：
   * 1. OutlinePass.render() 输出到内部 RT（描边像素有 alpha=1，背景 alpha=0）
   * 2. 用 alpha 混合将 RT 叠加到屏幕（alpha=0 区域完全透明，描边像素正常显示）
   */
  renderOutlineOverlay() {
    if (!this.composer || !this.outlinePass) return
    if (!this.outlinePass.selectedObjects?.length) return

    const renderer = this.renderer
    const size = renderer.getSize(new THREE.Vector2())
    const pr = renderer.getPixelRatio()

    // 确保临时渲染目标存在且尺寸匹配
    if (!this._outlineRT) {
      this._outlineRT = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      })
    } else {
      this._outlineRT.setSize(size.x * pr, size.y * pr)
    }

    const savedBg = this.scene.background
    const savedRT = renderer.getRenderTarget()
    const savedAutoClear = renderer.autoClear
    const savedCC = renderer.getClearColor(new THREE.Color())
    const savedCA = renderer.getClearAlpha()

    // 保存并禁用场景背景（避免 renderBackground 干扰 OutlinePass 内部渲染）
    this.scene.background = null

    // 同步 OutlinePass 相机
    if (this.outlineCamera) {
      this.outlineCamera.updateMatrixWorld()
    }

    try {
      // 用 OutlinePass.render() 将描边渲染到 _outlineRT
      // renderToScreen=false → 不输出到屏幕，输出到 writeBuffer（内部处理）
      // 但 OutlinePass 没有 renderToScreen 参数...它依赖 composer 的 renderToScreen
      // 所以我们直接用 renderer 手动渲染 OutlinePass

      renderer.setRenderTarget(this._outlineRT)
      renderer.setClearColor(0x000000, 0)
      renderer.autoClear = true
      renderer.clear(true, true, false)

      // OutlinePass.render 会把描边像素写入 RT
      // 方式：背景黑(alpha=0) + 描边像素(color, alpha=1)
      this.outlinePass.render(
        renderer,
        this._outlineRT,   // writeBuffer
        this._outlineRT,   // readBuffer (同一目标即可，OutlinePass 不做后处理)
      )

      // 用 alpha 混合将描边叠加到屏幕
      // outlineRT 的 alpha=0 区域完全透明，描边像素正常显示
      if (this._overlayQuad) {
        this._overlayQuad.material.map = this._outlineRT.texture
        renderer.setRenderTarget(null)
        renderer.autoClear = false
        renderer.render(this._overlayScene, this._overlayCam)
      }
    } finally {
      this.scene.background = savedBg
      renderer.setRenderTarget(savedRT)
      renderer.setClearColor(savedCC, savedCA)
      renderer.autoClear = savedAutoClear
    }
  }

  /**
   * 窗口/容器 resize 时更新 composer 尺寸。
   * @param {number} width
   * @param {number} height
   */
  resizeBloom(width, height) {
    if (this.composer) {
      this.composer.setSize(width, height)
    }
    if (this._outlineRT) {
      const pr = this.renderer.getPixelRatio()
      this._outlineRT.setSize(width * pr, height * pr)
    }
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
    this._disposeComposer()
    this.removeLightHelper()
    // 移除灯光
    if (this.dirLight) { this.scene.remove(this.dirLight); this.dirLight = null }
    if (this.hemiLight) { this.scene.remove(this.hemiLight); this.hemiLight = null }
    if (this.fillLight) { this.scene.remove(this.fillLight); this.fillLight = null }
  }

  /** 控制环境贴图是否启用 */
  controlEnvMapEnabled(enabled) {
    if (!this.config) return
    this.config.envMapEnabled = enabled
    this.applyAllParams()
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

  // ========== 后期泛光 (Bloom) ==========

  /**
   * 应用 Bloom 配置：切换 enabled 并更新参数（独立方法，不由 applyAllParams 调用）。
   * bloomPass 始终在管道中，仅通过 .enabled 开关控制。
   * @param {Object} bloomCfg - { enabled, strength, radius, threshold }
   */
  applyBloom(bloomCfg) {
    if (!this.bloomPass) return
    const cfg = bloomCfg ?? {}
    this.bloomPass.enabled = !!cfg.enabled
    this.bloomPass.strength = cfg.strength ?? 0.001
    this.bloomPass.radius = cfg.radius ?? 0
    this.bloomPass.threshold = cfg.threshold ?? 0
  }

  /** 销毁 composer 及相关资源（仅在 dispose 时调用） */
  _disposeComposer() {
    if (!this.composer) return
    this.composer.renderTarget1?.dispose()
    this.composer.renderTarget2?.dispose()
    this._outlineRT?.dispose()
    this._outlineRT = null
    if (this._overlayQuad) {
      this._overlayQuad.geometry.dispose()
      this._overlayQuad.material.dispose()
      this._overlayQuad = null
    }
    this._overlayScene = null
    this._overlayCam = null
    if (this.bloomPass) {
      this.bloomPass.renderTargetBright?.dispose()
      this.bloomPass.renderTargetHorizontal?.dispose()
      this.bloomPass.renderTargetVertical?.dispose()
    }
    if (this.outlinePass) {
      this.outlinePass.dispose()
    }
    this.composer = null
    this.bloomPass = null
    this.outlinePass = null
    this.outlineCamera = null
    this._renderPass = null
  }

}

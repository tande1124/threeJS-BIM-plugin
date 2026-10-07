import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { disposeObject3D } from '../../utils/three-dispose'
import { EnvironmentManager } from './EnvironmentManager'
import { CameraManager } from './CameraManager'
import { GltfModelLoader } from '../loaders/GltfModelLoader'
import { TileModelLoader } from '../loaders/TileModelLoader'
import { LabelRenderer } from '../loaders/LabelRenderer'

/**
 * BIM 查看器控制器。
 *
 * 统一管理场景环境（天空/光照）、3D Tiles 瓦片集加载、相机/飞行/聚焦、
 * 双相机渲染循环、视口自适应和生命周期。
 */
export class BimViewerController {
  // ---- Three.js 核心对象 ----
  scene = new THREE.Scene()
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  gltfModelLoader
  resizeObserver = new ResizeObserver(() => this.handleResize())

  // ---- CSS2D 标注渲染器 ----
  css2dRenderer = new CSS2DRenderer()
  /** 已添加的 CSS2D 标注列表，便于统一管理与销毁 */
  css2dLabels = []

  // ---- 相机管理 ----
  cameraManager

  // ---- 环境管理 ----
  environment

  // ---- 3D Tiles 加载管理器 ----
  tileModelLoader

  // ---- 3D 标签渲染器 ----
  labelRenderer

  // ---- 动画时钟（标签涟漪/弹跳用） ----
  labelClock = new THREE.Clock(false)

  // ---- 双相机透视：Layer 0 外壳（3D Tiles）/ Layer 1 内部（GLB） ----
  camInner = new THREE.PerspectiveCamera(45, 1, 1, 1e7)
  rtInner = new THREE.WebGLRenderTarget(1, 1)
  sceneOverlay = new THREE.Scene()
  camOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10)

  // ---- 其他状态 ----
  container = null
  /** 场景范围（root 加载后由包围球得出），供相机聚焦与点位贴地回退 */
  sceneBounds = new THREE.Box3()
  animationFrameId = 0
  /** 是否启用双相机透视渲染（默认开启：GLB 透明叠加在 3D Tiles 外壳上） */
  dualPass = true

  /**
   * @param {Object} [callbacks={}]
   * @param {Function} [callbacks.onGltfPick] - 点击 GLB 模型部件时的回调
   * @param {Function} [callbacks.onLabelClick] - 点击 3D 标签时的回调
   */
  constructor(callbacks = {}) {
    // 环境管理器
    this.environment = new EnvironmentManager(this.scene, this.renderer)

    // 相机管理器：统一管理相机、轨道控制、飞行、聚焦
    this.cameraManager = new CameraManager(this.renderer.domElement)

    // 将相机/控制器传给环境管理器（灯光拖拽辅助线需要）
    this.environment.camera = this.cameraManager.camera
    this.environment.controls = this.cameraManager.controls

    // 3D Tiles 加载管理器
    this.tileModelLoader = new TileModelLoader({
      scene: this.scene,
      renderer: this.renderer,
      getCamera: () => this.cameraManager.camera,
      onTilesetLoaded: (radius, isFirst) => {
        // 更新场景范围
        if (radius > 0) {
          this.sceneBounds.setFromCenterAndSize(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(radius * 2, radius * 2, radius * 2),
          )
          const cam = this.cameraManager.camera
          cam.near = Math.max(radius * 0.0001, 0.01)
          cam.far = radius * 10
          cam.updateProjectionMatrix()
          this.cameraManager.controls.minDistance = radius * 0.01
          this.cameraManager.controls.maxDistance = radius * 3
          this.cameraManager.controls.update()
        }
        // 只在首次 tileset 加载完成时自动定位相机
        if (!isFirst) return
        const cameraCfg = window.BizConfig?.sceneConfig?.cameraConfig
        if (cameraCfg) {
          this.applyCameraConfig(cameraCfg)
        } else if (!this.cameraManager.isViewSettled() && !this.sceneBounds.isEmpty()) {
          const box = new THREE.Box3().copy(this.sceneBounds)
          const gltfBox = new THREE.Box3().setFromObject(this.gltfModelLoader.root)
          if (!gltfBox.isEmpty()) box.union(gltfBox)
          this.cameraManager.fitToBox(box)
        }
      },
      onTileError: (e) => {
        console.warn('[BimViewerController] 瓦片加载错误:', e)
      },
    })

    // GLTF/GLB 模型加载器：维护独立的 gltf-root 容器组
    this.gltfModelLoader = new GltfModelLoader({
      scene: this.scene,
      renderer: this.renderer,
      getEcefToSceneTransform: () => this.getEcefToSceneTransform(),
      whenTerrainReady: () => this.tileModelLoader.whenReady(),
      onPick: (info, position) => {
        callbacks.onGltfPick?.(info, position)
      },
      onRequestFitCamera: () => {
        // 无 3D Tiles 时，GLB 加载完自动聚焦到模型上
        if (this.tileModelLoader.ready) return
        const box = new THREE.Box3().setFromObject(this.gltfModelLoader.root)
        if (!box.isEmpty()) {
          this.cameraManager.fitToBox(box)
        }
      },
      onFlyTo: (target, distance, duration) => {
        // 将计算好的观察距离转换为 flyTo 的 markerScale 参数
        this.cameraManager.flyTo(target, distance / 12, duration)
      },
    })

    // 3D 标签渲染器
    this.labelRenderer = new LabelRenderer({
      scene: this.scene,
      getCamera: () => this.cameraManager.camera,
      getEcefToSceneTransform: () => this.getEcefToSceneTransform(),
      whenTerrainReady: () => this.tileModelLoader.whenReady(),
      onLabelClick: (info) => {
        callbacks.onLabelClick?.(info)
      },
    })

    // ---- 双相机透视基础设施 ----
    this.cameraManager.camera.layers.set(0)
    this.camInner.layers.set(1)
    this.rtInner.texture.colorSpace = THREE.SRGBColorSpace

    // 全屏面片 + 正交场景：把内部渲染纹理叠加到屏幕顶层
    const quadMat = new THREE.MeshBasicMaterial({
      map: this.rtInner.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat)
    this.sceneOverlay.add(quad)

    // 启用 GLB 部件点击拾取
    this.gltfModelLoader.enablePicking(this.cameraManager.camera, this.renderer.domElement)
    // 启用 3D 标签点击拾取
    this.labelRenderer.enablePicking(this.cameraManager.camera, this.renderer.domElement)

    this.renderer.setPixelRatio(this.getPreferredPixelRatio())
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping   // 色调映射
    this.renderer.toneMappingExposure = 1
    this.renderer.autoClear = false // 双透模式手动控制清屏

    // 画布初始透明，等环境配置就绪后淡入，避免黑屏
    this.renderer.domElement.style.opacity = '0'
    this.renderer.domElement.style.transition = 'opacity 0.6s ease'

    // ---- CSS2DRenderer：在 WebGL 画布上方叠加 HTML 标注层 ----
    Object.assign(this.css2dRenderer.domElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      pointerEvents: 'none',
    })
  }

  // ========== 公共方法 ==========

  /** 挂载 canvas 到容器，启动渲染循环。 */
  async mount(container) {
    this.container = container
    this.container.innerHTML = ''
    this.container.appendChild(this.renderer.domElement)
    this.container.appendChild(this.css2dRenderer.domElement)

    if (container.style.position === '') {
      container.style.position = 'relative'
    }

    this.resizeObserver.observe(container)
    this.handleResize()

    // 画布淡入
    this.renderer.domElement.style.opacity = '1'

    this.startLoop()
  }

  /** 加载 3D Tiles 场景（支持多个数据源） */
  async loadScene(sources) {
    if (!this.container) {
      throw new Error('Three.js 容器尚未挂载。')
    }
    this.sceneBounds.makeEmpty()
    await this.tileModelLoader.loadScene(sources)
  }

  /** 获取 GLTF 模型加载器实例 */
  getGltfModelLoader() {
    return this.gltfModelLoader
  }

  
  /**
   * 根据来源 ID 设置模型显隐。
   * @param {string} id - 数据源 ID
   * @param {boolean} visible - 是否可见
   * @param {'3dtiles'|'glb'|'gltf'} [type] - 模型类型；省略时同时在两端查找
   * @returns {boolean} 是否成功设置
   */
  setModelVisible(id, visible, type) {
    if (type === '3dtiles') {
      this.tileModelLoader.setLayerVisible(id, visible)
      return true
    }
    if (type === 'glb' || type === 'gltf') {
      return this.gltfModelLoader.setVisibleById(id, visible)
    }
    // 未指定类型：两端都尝试
    this.tileModelLoader.setLayerVisible(id, visible)
    this.gltfModelLoader.setVisibleById(id, visible)
    return true
  }

  /**
   * 根据来源 ID 移除模型。
   * @param {string} id - 数据源 ID
   * @param {'3dtiles'|'glb'|'gltf'} [type] - 模型类型；省略时同时尝试移除 3DTiles 和 GLB
   * @returns {boolean} 是否成功移除
   */
  removeModel(id, type) {
    if (type === '3dtiles') {
      return this.tileModelLoader.removeById(id)
    }
    if (type === 'glb' || type === 'gltf') {
      return this.gltfModelLoader.removeById(id)
    }
    // 未指定类型：两端都尝试
    const a = this.tileModelLoader.removeById(id)
    const b = this.gltfModelLoader.removeById(id)
    return a || b
  }

  /**
   * 根据来源 ID 飞行定位到指定模型。
   * @param {string} id - 数据源 ID
   * @param {number} [duration=3000] - 飞行动画时长（毫秒）
   * @param {'3dtiles'|'glb'|'gltf'} [type] - 模型类型；省略时同时在两端查找
   * @returns {boolean} 是否成功飞行
   */
  flyToModel(id, duration = 3000, type) {
    // 3DTiles 飞行回调：直接传 Box3 给 flyToBox（带动画）
    const flyToTileset = (box, dur) => {
      this.cameraManager.flyToBox(box, dur)
    }
    if (type === '3dtiles') {
      return this.tileModelLoader.flyToById(id, flyToTileset, duration)
    }
    if (type === 'glb' || type === 'gltf') {
      return this.gltfModelLoader.flyToById(id, duration)
    }
    // 未指定类型：先尝试 GLB，再尝试 3DTiles
    if (this.gltfModelLoader.flyToById(id, duration)) return true
    return this.tileModelLoader.flyToById(id, flyToTileset, duration)
  }

  /**
   * 动态更新所有 GLB 模型的场景偏移配置（无需重新加载模型）。
   * 首次设置（无 geoOrigin）时直接应用绝对配准矩阵；
   * 已有 geoOrigin 时计算增量矩阵统一更新。仅影响 GLB，3D Tiles 不受影响。
   * @param {Object} newGeoInfo - 新的地理配准参数
   * @returns {Promise<boolean>} 是否成功更新
   */
  async setGltfGeoOrigin(newGeoInfo) {
    return this.gltfModelLoader.setGltfGeoOrigin(newGeoInfo)
  }

  /** 清除 GLB 部件高亮 */
  clearGltfHighlight() {
    this.gltfModelLoader.clearHighlight()
  }

  /** 获取当前双相机透视模式状态 */
  getDualPass() {
    return this.dualPass
  }

  /**
   * 切换双相机透视模式。
   * - ON: GLB 在 Layer 1 由内相机渲染，透明叠加在 3D Tiles 外壳上
   * - OFF: 所有物体在 Layer 0，单相机单次渲染
   * @param {boolean} enabled
   */
  setDualPass(enabled) {
    if (this.dualPass === enabled) return
    this.dualPass = enabled

    if (enabled) {
      // 切回双透模式
      this.cameraManager.camera.layers.set(0)
      this.renderer.autoClear = false
      this.gltfModelLoader.setLayer(1)
    } else {
      // 切到单层模式
      this.cameraManager.camera.layers.enable(1)
      this.renderer.autoClear = true
      this.gltfModelLoader.setLayer(0)
    }
  }

  // ========== 环境配置 ==========

  /**
   * 加载环境配置。
   * @param {Object} config - 配置对象
   */
  async applyEnvConfig(config) {
    try {
      await this.environment.applyConfig(config)
    } catch (e) {
      console.warn('[BimViewerController] 环境配置加载失败，使用默认参数。', e)
    }
  }

  // ========== 销毁 ==========

  /** 销毁控制器，释放所有 GPU 资源与 DOM 监听 */
  destroy() {
    cancelAnimationFrame(this.animationFrameId)
    this.resizeObserver.disconnect()
    this.gltfModelLoader.disablePicking()
    this.clearAnnotations()
    this.labelRenderer.dispose()
    this.tileModelLoader.dispose()
    this.cameraManager.dispose()
    this.environment.dispose()
    this.rtInner.dispose()

    disposeObject3D(this.scene)
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.container?.replaceChildren()
    this.container = null
  }

  // ========== 渲染循环 ==========

  startLoop() {
    this.labelClock.start()
    const renderFrame = () => {
      this.animationFrameId = window.requestAnimationFrame(renderFrame)
      try {
        if (this.cameraManager.tickFlyAnimation()) {
          // 飞行动画进行中，跳过 controls.update()
        } else {
          this.cameraManager.controls.update()
        }

        const cam = this.cameraManager.camera
        cam.updateMatrixWorld()
        this.tileModelLoader.update()
        this.labelRenderer.update(this.labelClock.getElapsedTime())

        if (this.dualPass) {
          // ---- 双相机透视：三步合成 ----
          this.renderer.autoClear = false
          this.camInner.copy(cam)
          this.camInner.layers.set(1)

          // 临时禁用背景和雾
          const savedBackground = this.scene.background
          const savedFog = this.scene.fog
          this.scene.background = null
          this.scene.fog = null

          // 1. 渲染 GLB 到 rtInner（透明背景）
          this.renderer.setRenderTarget(this.rtInner)
          this.renderer.setClearColor(0x000000, 0)
          this.renderer.clear(true, true, false)
          this.renderer.render(this.scene, this.camInner)

          // 恢复背景和雾效
          this.scene.background = savedBackground
          this.scene.fog = savedFog

          // 2. 渲染外壳到屏幕（Layer 0 的 3D Tiles + 天空）
          this.renderer.setRenderTarget(null)
          this.renderer.clear(true, true, false)
          this.renderer.render(this.scene, cam)

          // 3. 叠加 GLB（含轮廓）：只清深度、保留外壳颜色
          this.renderer.clearDepth()
          this.renderer.render(this.sceneOverlay, this.camOrtho)
        } else {
          // ---- 单层模式：一步渲染 ----
          this.renderer.autoClear = true
          this.renderer.render(this.scene, cam)
        }

        // ---- 标签层始终在最上层（Layer 2，清深度后叠加） ----
        // 临时移除背景和雾，避免标签通道重绘背景覆盖场景
        const savedBg = this.scene.background
        const savedFog = this.scene.fog
        this.scene.background = null
        this.scene.fog = null
        this.renderer.autoClear = false
        this.renderer.clearDepth()
        const savedMask = cam.layers.mask
        cam.layers.set(2)
        this.renderer.render(this.scene, cam)
        cam.layers.mask = savedMask
        this.scene.background = savedBg
        this.scene.fog = savedFog
        this.renderer.autoClear = true

        // CSS2D 标注层始终在主渲染之后绘制
        this.css2dRenderer.render(this.scene, cam)
      } catch (err) {
        console.error('[BimViewerController] 渲染循环异常:', err)
      }
    }

    renderFrame()
  }

  // ========== 视口自适应 ==========

  handleResize() {
    if (!this.container) return

    const width = Math.max(this.container.clientWidth, 1)
    const height = Math.max(this.container.clientHeight, 1)

    this.cameraManager.resize(width, height)
    this.renderer.setSize(width, height, false)
    this.renderer.setPixelRatio(this.getPreferredPixelRatio())
    this.css2dRenderer.setSize(width, height)

    // 窗口变化时重新同步瓦片 SSE 分辨率
    this.tileModelLoader.resize(this.cameraManager.camera, this.renderer)

    // 双透模式下同步内相机与渲染目标尺寸
    if (this.dualPass) {
      this.camInner.aspect = width / height
      this.camInner.updateProjectionMatrix()
      this.rtInner.setSize(width, height)
    }
  }

  /** 获取标签渲染器实例 */
  getLabelRenderer() {
    return this.labelRenderer
  }

  /** 获取相机管理器实例 */
  getCameraManager() {
    return this.cameraManager
  }

  /**
   * 获取 ECEF → 场景变换矩阵。
   * 从 3D Tiles 获取 ECEF → 场景变换矩阵。
   * @returns {THREE.Matrix4|null}
   */
  getEcefToSceneTransform() {
    return this.tileModelLoader.getFirstTransform() ?? null
  }

  /**
   * 按配置设置相机位置和观察目标。
   * position 和 target 均为可选，缺省项保持当前值。
   * @param {Object} cfg
   * @param {{ x?: number, y?: number, z?: number }} [cfg.position]
   * @param {{ x?: number, y?: number, z?: number }} [cfg.target]
   */
  applyCameraConfig(cfg) {
    const cam = this.cameraManager.camera
    const controls = this.cameraManager.controls

    if (cfg.position) {
      cam.position.set(
        cfg.position.x ?? cam.position.x,
        cfg.position.y ?? cam.position.y,
        cfg.position.z ?? cam.position.z,
      )
    }
    if (cfg.target) {
      controls.target.set(
        cfg.target.x ?? controls.target.x,
        cfg.target.y ?? controls.target.y,
        cfg.target.z ?? controls.target.z,
      )
    }

    controls.update()
    this.cameraManager.hasSettledView = true
  }

  /**
   * 回归视角。
   * 传入 cameraConfig 时平滑飞行到指定位置，否则优先读取 biz-config.js 配置，
   * 均无配置时自动聚焦到已加载场景的包围盒中心。
   * @param {Object} [cameraConfig] - 相机配置（可选）
   * @param {{ x?: number, y?: number, z?: number }} [cameraConfig.position] - 相机位置
   * @param {{ x?: number, y?: number, z?: number }} [cameraConfig.target] - 观察目标点
   * @param {number} [duration=3000] - 飞行动画时长（毫秒）
   */
  resetCamera(cameraConfig, duration = 3000) {
    const cameraCfg = cameraConfig || window.BizConfig?.sceneConfig?.cameraConfig
    if (cameraCfg) {
      // 有配置：平滑飞行到目标位置
      const cam = this.cameraManager.camera
      const controls = this.cameraManager.controls
      const toPosition = cameraCfg.position
        ? new THREE.Vector3(
            cameraCfg.position.x ?? cam.position.x,
            cameraCfg.position.y ?? cam.position.y,
            cameraCfg.position.z ?? cam.position.z,
          )
        : cam.position.clone()
      const toTarget = cameraCfg.target
        ? new THREE.Vector3(
            cameraCfg.target.x ?? controls.target.x,
            cameraCfg.target.y ?? controls.target.y,
            cameraCfg.target.z ?? controls.target.z,
          )
        : controls.target.clone()

      this.cameraManager.flyToPosition(toPosition, toTarget, duration)
      return
    }
    // 无配置：平滑飞行到场景包围盒中心
    const box = new THREE.Box3()
    if (!this.sceneBounds.isEmpty()) box.copy(this.sceneBounds)
    const gltfBox = new THREE.Box3().setFromObject(this.gltfModelLoader.root)
    if (!gltfBox.isEmpty()) box.union(gltfBox)
    if (!box.isEmpty()) {
      this.cameraManager.flyToBox(box, duration)
    }
  }

  /** 按真实设备像素比渲染，高分屏上限 2x 保护性能 */
  getPreferredPixelRatio() {
    return THREE.MathUtils.clamp(window.devicePixelRatio || 1, 1, 2)
  }


  // ========== CSS2D 标注管理（HTML 标注） ==========

  /**
   * 在 3D 世界坐标处添加一个 HTML 标注。
   *
   * 如果 element 上挂载了 Vue 组件（通过 element.__vueApp__ 标记），
   * clearAnnotations 时会自动 unmount，避免内存泄漏。
   *
   * @param {THREE.Vector3} position - 世界坐标
   * @param {HTMLElement} element - DOM 元素（可预先挂载 Vue 组件）
   * @param {Object} [vueApp] - 关联的 Vue app 实例（createApp 返回值），清理时自动 unmount
   * @returns {CSS2DObject} 标注对象引用，可用于后续移除
   */
  addAnnotation(position, element, vueApp) {
    this.clearAnnotations()
    const label = new CSS2DObject(element)
    label.position.copy(position)
    // 记录 Vue app 实例，清理时 unmount
    if (vueApp) element.__vueApp__ = vueApp
    this.scene.add(label)
    this.css2dLabels.push(label)
    return label
  }

  /** 移除指定标注 */
  removeAnnotation(label) {
    this.scene.remove(label)
    const idx = this.css2dLabels.indexOf(label)
    if (idx !== -1) this.css2dLabels.splice(idx, 1)
    // unmount 关联的 Vue 组件，防止内存泄漏
    if (label.element?.__vueApp__) {
      label.element.__vueApp__.unmount()
      label.element.__vueApp__ = null
    }
    if (label.element?.parentNode) {
      label.element.parentNode.removeChild(label.element)
    }
  }

  /** 移除全部标注 */
  clearAnnotations() {
    for (const label of this.css2dLabels) {
      this.scene.remove(label)
      // unmount 关联的 Vue 组件，防止内存泄漏
      if (label.element?.__vueApp__) {
        label.element.__vueApp__.unmount()
        label.element.__vueApp__ = null
      }
      if (label.element?.parentNode) {
        label.element.parentNode.removeChild(label.element)
      }
    }
    this.css2dLabels.length = 0
  }
}

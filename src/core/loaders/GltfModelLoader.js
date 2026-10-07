import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { disposeObject3D } from '../../utils/three-dispose'
import { createGeoReferenceMatrix } from '../../utils/geo-coordinate'

// TODO--禁用 GLTFLoader 对节点名称的清洗（空格→下划线、移除 [ ] . : /）。
// GLB 模型中常用方括号标注编号，如 "第 0001 单元 [32845CDAB621]"，
// 默认会被 sanitizeNodeName 清洗为 "第_0001_单元_32845CDAB621"。
// 注意：若模型包含动画数据（AnimationMixer），禁用清洗可能导致 parseTrackName 解析异常。
THREE.PropertyBinding.sanitizeNodeName = (name) => name

/**
 * GLTF/GLB 模型加载器。
 *
 * 负责把外部 GLB/GLTF 模型直接加载进场景：
 * 创建 GLTFLoader、可选居中到原点，
 * 所有模型统一挂到 root 容器组下（root 已在构造函数中加入 scene）。
 * 同时提供点击拾取能力：enablePicking 后点击 GLB 部件会通过 deps.onPick
 * 回调该部件的位置/名称等详情，未命中模型时回调 null。
 * 选中部件通过背面放大法绘制白色轮廓线（无需后处理）。
 */
export class GltfModelLoader {
  /** 所有已加载模型的父级容器组（已加入 scene） */
  root

  deps
  loader
  raycaster = new THREE.Raycaster()

  // ---- 点击拾取状态 ----
  pickCamera = null
  pickDomElement = null
  pickPointerStart = new THREE.Vector2()

  // ---- 部件选中状态 ----
  /** 当前选中的部件对象（null 表示无选中） */
  highlightedObject = null
  /** 选中部件的半透明不透明度 */
  static SELECTED_OPACITY = 0.5
  /** 选中前每个网格的原始材质（恢复时用） */
  originalMaterials = new Map()
  /** 选中时克隆出的临时材质（清除时释放） */
  clonedMaterials = new Set()
  /** 轮廓线容器（克隆网格 + 白色背面材质） */
  outlineGroup = new THREE.Group()
  /** 当前 GLB 网格所在图层（双透模式=1，单层模式=0） */
  currentLayer = 1
  /** 轮廓线共享材质：白色、反面绘制 */
  outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.FrontSide,
    depthWrite: false,
  })
  /** 部件放大比例（相对于部件包围盒），1.0 表示不放大 */
  static OUTLINE_SCALE = 1.0

  /**
   * @param {Object} deps - 依赖注入
   * @param {THREE.Scene} deps.scene - 模型挂载的目标场景
   * @param {THREE.WebGLRenderer} [deps.renderer] - WebGL 渲染器
   * @param {Function} [deps.getEcefToSceneTransform] - 获取 ECEF → 场景坐标的变换矩阵
   * @param {Function} [deps.whenTerrainReady] - 等待地形瓦片集就绪
   * @param {Function} [deps.onPick] - 点击 GLB 部件时回调
   * @param {Function} [deps.onRequestFitCamera] - 模型加载完成后请求控制器触发相机自动聚焦
   * @param {Function} [deps.onFlyTo] - 飞行到目标点 (target: Vector3, distance: number, duration?: number)
   */
  constructor(deps) {
    this.deps = deps

    this.root = new THREE.Group()
    this.root.name = 'gltf-root'
    this.outlineGroup.name = 'outline-group'
    this.outlineGroup.layers.set(this.currentLayer) // 轮廓线仅内相机可见
    this.deps.scene.add(this.outlineGroup)
    this.deps.scene.add(this.root)

    this.loader = new GLTFLoader()

    // Draco 解码器（支持 Draco 压缩的 GLB/GLTF）
    // 仅当模型包含 Draco 压缩时才会按需加载解码器
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('./libs/threeJs/draco/gltf/')
    this.loader.setDRACOLoader(dracoLoader)

    // 射线拾取启用所有图层，确保 Layer 1（GLB 内部层）的网格也能被点击命中
    this.raycaster.layers.enableAll()
  }

  /** 加载并渲染一个 GLTF/GLB 模型，返回模型根节点
   * @param {string} url
   * @param {Object} [options={}]
   * @returns {Promise<THREE.Group>}
   */
  async load(url, options = {}) {
    const { center = true, layer, geo } = options

    const model = (await this.loader.loadAsync(url)).scene
    model.name = model.name || 'gltf-model'
    this.enhanceTextures(model)

    // 保存 GLB 原始材质（供 setPartMaterial 重置时恢复）
    model.traverse((obj) => {
      if (obj.isMesh) obj.userData._gltfOriginalMaterial = obj.material
    })

    if (center) {
      const box = new THREE.Box3().setFromObject(model)
      if (!box.isEmpty()) {
        const centerOffset = box.getCenter(new THREE.Vector3())
        model.position.sub(centerOffset)
        // 缓存居中偏移，以便 setGltfGeoOrigin 首次设置时补偿
        model.userData._centerOffset = centerOffset
      }
    }

    // 分配到指定图层（双相机模式：Layer 1 = GLB 内部层）
    if (layer !== undefined) {
      model.traverse((obj) => {
        if (obj.isMesh) obj.layers.set(layer)
      })
    }

    // 地理配准：用 CGCS2000 坐标把模型定位到场景中
    if (geo) {
      await this.applyGeoReference(model, geo)
    }
    // 始终缓存配准参数（即使 applyGeoReference 因 ECEF 不可用而跳过，
    // 也保存原始参数，以便后续 setGltfGeoOrigin 可用）
    if (geo) {
      model.userData.geoOrigin = { ...geo }
      console.log('[GltfModelLoader] geoOrigin 已存储:', model.name, model.userData.geoOrigin)
    } else {
      console.warn('[GltfModelLoader] 未提供 geo 参数，跳过 geoOrigin 存储。model:', model.name)
    }

    // 设置阴影投射/接收（对齐参考项目 enableShadows）
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })

    this.root.add(model)
    return model
  }

  /**
   * 加载 GLTF/GLB 模型的高层封装
   *
   * @param {string} url - 模型资源地址
   * @param {Object} [options={}]
   * @param {boolean} [options.fitCamera=true] - 加载后是否触发相机聚焦
   * @returns {Promise<THREE.Group>}
   */
  async loadGltf(url, options = {}) {
    const loadOptions = { layer: 1, ...options }
    const model = options.geo
      ? await this.load(url, { ...loadOptions, center: false })
      : await this.load(url, loadOptions)

    // 存储来源 ID，便于后续通过 ID 查找模型
    if (options.id) model.userData.sourceId = options.id
    // 存储显示名称，用于模型树和路径显示
    if (options.name) model.userData.displayName = options.name

    if (options.fitCamera !== false) {
      this.deps.onRequestFitCamera?.()
    }

    return model
  }

  /**
   * 启用点击拾取：在 domElement 上监听点击，命中 GLB 部件时通过
   * deps.onPick 回调部件信息，点击空白（未命中模型）时回调 null。
   * @param {THREE.Camera} camera
   * @param {HTMLElement} domElement
   */
  enablePicking(camera, domElement) {
    if (this.pickDomElement === domElement) return
    this.disablePicking()
    this.pickCamera = camera
    this.pickDomElement = domElement
    domElement.addEventListener('pointerdown', this.handlePickPointerDown)
    domElement.addEventListener('click', this.handlePickClick)
  }

  /** 停止点击拾取并释放监听 */
  disablePicking() {
    if (this.pickDomElement) {
      this.pickDomElement.removeEventListener('pointerdown', this.handlePickPointerDown)
      this.pickDomElement.removeEventListener('click', this.handlePickClick)
    }
    this.pickCamera = null
    this.pickDomElement = null
  }

  /**
   * 切换 GLB 网格所在图层，用于双相机/单相机模式切换。
   * @param {number} layer - 目标图层（0=单层模式，1=双透模式）
   */
  setLayer(layer) {
    this.currentLayer = layer
    this.root.traverse((obj) => {
      if (obj.isMesh) obj.layers.set(layer)
    })
    this.outlineGroup.layers.set(layer)
  }

  /**
   * 根据来源 ID 设置 GLB 模型的显隐。
   * @param {string} sourceId - 模型来源 ID
   * @param {boolean} visible - 是否可见
   * @returns {boolean} 是否找到并设置成功
   */
  setVisibleById(sourceId, visible) {
    for (const model of this.root.children) {
      if (model.userData?.sourceId === sourceId) {
        model.visible = visible
        return true
      }
    }
    return false
  }

  /**
   * 用归一化设备坐标（NDC，x/y ∈ -1 ~ 1，原点在画布中心）对已加载的 GLB
   * 模型做射线拾取，未命中任何部件时返回 null。
   * @param {THREE.Camera} camera
   * @param {THREE.Vector2} ndc
   * @returns {Object|null}
   */
  pick(camera, ndc) {
    if (this.root.children.length === 0) return null

    camera.updateMatrixWorld()
    this.root.updateMatrixWorld(true)
    this.raycaster.setFromCamera(ndc, camera)
    const hits = this.raycaster.intersectObjects(this.root.children, true)

    const hit = hits.find((item) => this.isVisibleInTree(item.object))
    if (!hit) return null

    const object = hit.object
    const model = this.findModelRoot(object)
    if (!model) return null

    // 选中整个「部件」：取命名的最近祖先
    const part = this.resolvePartObject(object, model)

    // 将 3D 世界坐标投影为屏幕坐标（像素，左上角原点）
    let screenX = 0, screenY = 0
    if (this.pickDomElement) {
      const vector = hit.point.clone().project(camera)
      const rect = this.pickDomElement.getBoundingClientRect()
      screenX = (vector.x * 0.5 + 0.5) * rect.width
      screenY = (-vector.y * 0.5 + 0.5) * rect.height
    }

    return {
      /** 选中的部件 Object3D（命名的最近祖先） */
      object: part,
      /** 部件名称 */
      name: this.resolveObjectName(part),
      /** 部件在模型树中的完整路径（如 "model/xxx/围堰工程"） */
      path: this.buildObjectPath(part, model),
      /** 射线命中点的 3D 世界坐标 */
      worldPosition: hit.point.clone(),
      /** 射线命中点在模型局部坐标系中的位置 */
      localPosition: model.worldToLocal(hit.point.clone()),
      /** 射线命中点投影到画布的屏幕像素坐标（左上角原点） */
      screenPosition: { x: screenX, y: screenY },
      /** 射线起点到命中点的距离 */
      distance: hit.distance,
      /** 所属 GLB 模型根节点 */
      model,
    }
  }

  /**
   * 选中指定 GLB 部件：部件整体半透明 + 白色轮廓线。
   * 传 null 清除当前选中。
   * @param {THREE.Object3D|null} object
   */
  highlight(object) {
    this.clearHighlight()
    this.highlightedObject = object
    if (!object) return

    // ── 1. 部件整体半透明 ──
    object.traverse((child) => {
      const mesh = child
      if (!mesh.isMesh) return

      const original = mesh.material
      const materials = Array.isArray(original) ? original : [original]
      const clones = materials.map((mat) => {
        const clone = mat.clone()
        clone.transparent = true
        clone.opacity = GltfModelLoader.SELECTED_OPACITY
        clone.depthWrite = false
        clone.needsUpdate = true
        this.clonedMaterials.add(clone)
        return clone
      })
      mesh.material = Array.isArray(original) ? clones : clones[0]
      this.originalMaterials.set(mesh, original)
    })

    // ── 2. 白色轮廓线（背面放大法） ──
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    const center = box.getCenter(new THREE.Vector3())
    const scale = GltfModelLoader.OUTLINE_SCALE

    const scaleMatrix = new THREE.Matrix4()
      .makeTranslation(center.x, center.y, center.z)
      .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
      .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z))

    object.traverse((child) => {
      const mesh = child
      if (!mesh.isMesh) return

      const clone = mesh.clone()
      clone.material = this.outlineMaterial

      mesh.updateMatrixWorld(true)
      clone.matrix.copy(mesh.matrixWorld)
      clone.matrix.premultiply(scaleMatrix)
      clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)

      clone.layers.set(this.currentLayer)
      clone.renderOrder = 999
      this.outlineGroup.add(clone)
    })
  }

  /**
   * 飞行聚焦到指定部件：根据包围盒计算观察距离，平滑拉近相机。
   * @param {THREE.Object3D} object - 要高亮并飞行的部件
   * @param {number} [duration=900] - 飞行动画时长（ms）
   */
  flyToObject(object, duration = 900) {
    if (!object || !this.deps.onFlyTo) return

    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 1)

    // 根据 FOV 计算合适的观察距离（与 fitToBox 逻辑一致，系数 2.0 留余量）
    const halfFov = THREE.MathUtils.degToRad(45 * 0.5)
    const distance = (maxDim / (2 * Math.tan(halfFov))) * 2.0

    this.deps.onFlyTo(center, distance, duration)
  }

  /**
   * 根据来源 ID 飞行定位到指定 GLB 模型。
   * @param {string} sourceId - 模型来源 ID
   * @param {number} [duration=900] - 飞行动画时长（毫秒）
   * @returns {boolean} 是否找到并飞行
   */
  flyToById(sourceId, duration = 900) {
    for (const model of this.root.children) {
      if (model.userData?.sourceId === sourceId) {
        this.flyToObject(model, duration)
        return true
      }
    }
    return false
  }

  /** 清除当前选中，恢复原始材质并移除轮廓网格 */
  clearHighlight() {
    // 恢复原始材质
    for (const [mesh, original] of this.originalMaterials) {
      mesh.material = original
    }
    this.originalMaterials.clear()
    for (const mat of this.clonedMaterials) {
      mat.dispose()
    }
    this.clonedMaterials.clear()

    // 移除轮廓网格
    while (this.outlineGroup.children.length > 0) {
      this.outlineGroup.remove(this.outlineGroup.children[0])
    }
    this.highlightedObject = null
  }

  /** 清除并释放所有已加载的 GLTF 模型 */
  clear() {
    this.clearHighlight()
    disposeObject3D(this.root)
    this.root.clear()
  }

  /**
   * 根据来源 ID 移除指定的 GLB 模型。
   * @param {string} sourceId - 模型来源 ID（加载时传入的 id）
   * @returns {boolean} 是否成功移除
   */
  removeById(sourceId) {
    const idx = this.root.children.findIndex(
      (child) => child.userData?.sourceId === sourceId,
    )
    if (idx === -1) return false
    const model = this.root.children[idx]
    // 如果当前高亮对象在被移除的模型内部，先清除高亮
    if (this.highlightedObject) {
      let node = this.highlightedObject
      while (node) {
        if (node === model) {
          this.clearHighlight()
          break
        }
        node = node.parent
      }
    }
    this.root.remove(model)
    disposeObject3D(model)
    return true
  }

  // ========== 地理配准 ==========

  /** 按地理配准参数把 GLB 定位到场景（等待地形就绪后应用矩阵） */
  async applyGeoReference(model, params) {
    await this.deps.whenTerrainReady?.()
    const ecefToScene = this.deps.getEcefToSceneTransform?.()
    if (!ecefToScene) {
      console.warn('[GltfModelLoader] ECEF → 场景变换不可用，无法进行地理配准。')
      return
    }
    const matrix = createGeoReferenceMatrix(params, ecefToScene)
    model.matrix.identity()
    model.applyMatrix4(matrix)
    model.matrix.decompose(model.position, model.quaternion, model.scale)
  }

  /**
   * 动态更新所有 GLB 模型的地理配准参数（无需重新加载）。
   *
   * 两种模式：
   * - 首次设置：模型无 geoOrigin 时，直接应用绝对配准矩阵（与 applyGeoReference 一致）
   * - 增量更新：模型已有 geoOrigin 时，计算 delta = newMatrix × inverse(oldMatrix)，统一应用
   *
   * 所有模型共享同一套 geoOrigin，因此只计算一次矩阵，毫秒级完成。
   * 仅影响 GLB 模型，3D Tiles 不受影响。
   *
   * @param {Object} newGeoInfo - 新的地理配准参数
   * @param {number} newGeoInfo.centralMeridianDeg - 中央子午线经度（度）
   * @param {number} newGeoInfo.offsetX - 东坐标（米）
   * @param {number} newGeoInfo.offsetY - 北坐标（米）
   * @param {number} [newGeoInfo.offsetZ=0] - 高程（米）
   * @param {number} [newGeoInfo.verticalScale=1] - 垂直缩放比例
   * @returns {Promise<boolean>} 是否成功更新
   */
  async setGltfGeoOrigin(newGeoInfo) {
    const models = this.root.children
    if (models.length === 0) {
      console.warn('[GltfModelLoader] 无已加载的模型。')
      return false
    }

    // 等待 3D Tiles 就绪（与 applyGeoReference 一致）
    await this.deps.whenTerrainReady?.()
    const ecefToScene = this.deps.getEcefToSceneTransform?.()
    if (!ecefToScene) {
      console.warn('[GltfModelLoader] ECEF → 场景变换不可用。')
      return false
    }

    const newMatrix = createGeoReferenceMatrix(newGeoInfo, ecefToScene)
    const refModel = models.find((m) => m.userData?.geoOrigin)

    if (refModel) {
      // ── 增量更新：delta = newMatrix × inverse(oldMatrix) ──
      const oldMatrix = createGeoReferenceMatrix(refModel.userData.geoOrigin, ecefToScene)
      const delta = newMatrix.clone().multiply(oldMatrix.clone().invert())
      for (const model of models) {
        model.applyMatrix4(delta)
        model.matrix.decompose(model.position, model.quaternion, model.scale)
        model.userData.geoOrigin = { ...newGeoInfo }
      }
    } else {
      // ── 首次设置：与 applyGeoReference 一致，需补偿加载时的居中偏移 ──
      for (const model of models) {
        model.matrix.identity()
        // 补偿加载时 center=true 的居中偏移（在模型局部空间中恢复）
        const centerOffset = model.userData._centerOffset
        if (centerOffset) {
          model.translateOnAxis(centerOffset, 1)
        }
        model.applyMatrix4(newMatrix)
        model.matrix.decompose(model.position, model.quaternion, model.scale)
        model.userData.geoOrigin = { ...newGeoInfo }
        delete model.userData._centerOffset
      }
    }
    return true
  }

  // ========== 纹理质量增强 ==========

  /** 提升模型纹理采样质量（各向异性 + 三线性过滤） */
  enhanceTextures(scene) {
    const maxAnisotropy =
      this.deps.renderer?.capabilities.getMaxAnisotropy?.() ?? 16

    // 标准 PBR 材质中可能包含纹理的属性列表
    const TEXTURE_KEYS = [
      'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
      'emissiveMap', 'bumpMap', 'displacementMap', 'alphaMap',
      'envMap', 'lightMap', 'specularMap',
    ]

    scene.traverse((obj) => {
      if (!obj.isMesh) return

      const material = obj.material
      if (!material) return

      const materials = Array.isArray(material) ? material : [material]
      for (const mat of materials) {
        if (!mat) continue

        for (const key of TEXTURE_KEYS) {
          const texture = mat[key]
          if (!texture || !texture.isTexture) continue

          texture.anisotropy = maxAnisotropy

          const mipCount = Array.isArray(texture.mipmaps) ? texture.mipmaps.length : 0
          if (mipCount > 1) {
            texture.minFilter = THREE.LinearMipmapLinearFilter
          } else if (!(texture instanceof THREE.CompressedTexture)) {
            // 压缩纹理无法 GPU 生成 mipmap，保持 LinearFilter
            texture.minFilter = THREE.LinearMipmapLinearFilter
            texture.generateMipmaps = true
          }

          texture.needsUpdate = true
        }
      }
    })
  }

  // ========== 点击拾取实现 ==========

  handlePickPointerDown = (event) => {
    this.pickPointerStart.set(event.clientX, event.clientY)
  }

  handlePickClick = (event) => {
    if (!this.pickCamera || !this.pickDomElement) return

    // 拖动旋转/平移后松开也会触发 click，位移超过阈值视为拖拽，不拾取
    if (
      Math.hypot(
        event.clientX - this.pickPointerStart.x,
        event.clientY - this.pickPointerStart.y,
      ) > 5
    ) {
      return
    }

    const info = this.pick(this.pickCamera, this.clientToNdc(event, this.pickDomElement))
    // 命中则高亮该部件并飞行聚焦，点击空白清除高亮
    this.highlight(info?.object ?? null)
    if (info?.object) {
      this.flyToObject(info.object)
    }
    this.deps.onPick?.(info, info ? { x: event.clientX, y: event.clientY } : null)
  }

  clientToNdc(event, domElement) {
    const rect = domElement.getBoundingClientRect()
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
  }

  /** 命中对象及其所有祖先是否可见 */
  isVisibleInTree(object) {
    let node = object
    while (node) {
      if (node.visible === false) return false
      node = node.parent
    }
    return true
  }

  /**
   * 按名称查找部件，返回结构化信息（与 pick 返回格式一致）。
   * 遍历模型树查找第一个 name 匹配的节点，未找到返回 null。
   * @param {string} name - 部件名称
   * @returns {Object|null}
   */
  findPartByName(name) {
    if (this.root.children.length === 0) return null

    const search = (node) => {
      if (node.name === name) return node
      for (const child of node.children) {
        const found = search(child)
        if (found) return found
      }
      return null
    }

    const object = search(this.root)
    if (!object) return null

    const model = this.findModelRoot(object)
    if (!model) return null

    // 用包围盒中心作为部件的世界坐标
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    const worldPos = box.getCenter(new THREE.Vector3())

    // 投影到屏幕坐标（需要已启用拾取的相机和画布）
    let screenX = 0, screenY = 0
    if (this.pickCamera && this.pickDomElement) {
      const vector = worldPos.clone().project(this.pickCamera)
      const rect = this.pickDomElement.getBoundingClientRect()
      screenX = (vector.x * 0.5 + 0.5) * rect.width
      screenY = (-vector.y * 0.5 + 0.5) * rect.height
    }

    return {
      /** 选中的部件 Object3D */
      object,
      /** 部件名称 */
      name: this.resolveObjectName(object),
      /** 部件在模型树中的完整路径 */
      path: this.buildObjectPath(object, model),
      /** 部件包围盒中心的 3D 世界坐标 */
      worldPosition: worldPos,
      /** 部件包围盒中心在模型局部坐标系中的位置 */
      localPosition: model.worldToLocal(worldPos.clone()),
      /** 部件包围盒中心投影到画布的屏幕像素坐标（左上角原点） */
      screenPosition: { x: screenX, y: screenY },
      /** 所属 GLB 模型根节点 */
      model,
    }
  }

  /** 找到命中对象所属的模型根节点 */
  findModelRoot(object) {
    let node = object
    while (node && node.parent && node.parent !== this.root) {
      node = node.parent
    }
    return node && node.parent === this.root ? node : null
  }

  /** 取部件名称：对象本身无名字时向上取最近的有名字的祖先 */
  resolveObjectName(object) {
    let node = object
    while (node && node !== this.root) {
      if (node.name) return node.name
      node = node.parent
    }
    return '(未命名部件)'
  }

  /** 取「部件」对象：命中网格向上取最近的有名字的祖先 */
  resolvePartObject(object, model) {
    let node = object
    while (node && node !== model) {
      if (node.name) return node
      node = node.parent
    }
    return object
  }

  /** 生成「模型根 → 命中对象」的节点路径 */
  buildObjectPath(object, model) {
    const names = []
    let node = object
    while (node && node !== model) {
      names.unshift(node.name || '(未命名)')
      node = node.parent
    }
    names.unshift(model.userData?.displayName || model.name || 'gltf-model')
    return names.join(' / ')
  }

  // ========== 模型结构树 ==========

  /**
   * 通过来源 ID 获取模型结构树。
   * @param {string} id - 模型来源 ID（对应 gltfSources[].id）
   * @returns {Object|null} 树结构数据
   */
  getModelTreeById(id) {
    for (const model of this.root.children) {
      if (model.userData?.sourceId === id) {
        return buildTreeNode(model)
      }
    }
    return null


    // 递归构建模型树节点
    function buildTreeNode(obj) {
      return {
        id: obj.id,
        name: obj.userData?.displayName || obj.name || '(未命名)',
        type: obj.type,
        children: obj.children.map((c) => buildTreeNode(c))
      }
    }
  }
}

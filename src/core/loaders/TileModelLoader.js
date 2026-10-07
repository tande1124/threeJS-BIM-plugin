import * as THREE from 'three'
import { TilesRenderer } from '3d-tiles-renderer'
import { GLTFExtensionsPlugin, ReorientationPlugin } from '3d-tiles-renderer/three/plugins'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

// ========== KTX2 压缩贴图支持 ==========

/**
 * Basis Universal（KTX2）转码器资源路径。
 *
 * 使用 CDN 加载 basis_transcoder.{js,wasm}，避免本地 libs 目录增大包体积。
 * 运行时 KTX2Loader 按 URL 加载 Worker，无需打包器处理。
 */
const KTX2_TRANSCODER_PATH = './libs/basis/'

/**
 * GLTF loader 插件：补齐 cesiumlab（osgb2tiles 等工具）3D Tiles 的贴图解码。
 *
 * 这类 b3dm 内嵌的 glTF 把压缩贴图写成 image/ktx2 图片并被 texture.source 直接引用，
 * 却不带 KHR_texture_basisu 扩展；three 的 GLTFLoader 默认把这类图片当作普通图片解码，
 * 解码失败后贴图为 null，模型就会退化成无贴图的"白膜"。
 *
 * 该插件在 GLTFLoader 解析 texture 依赖时被优先调用，凡是图片为 image/ktx2 的贴图
 * 一律交给 KTX2Loader 解码（与 KHR_texture_basisu 官方路径走同一入口 loadTextureImage），
 * 其余普通贴图返回 null 走 three 默认逻辑，不影响 JPEG/PNG 数据源。
 */
class RawKtx2TexturePlugin {
  constructor(parser, ktx2Loader) {
    this.parser = parser
    this.ktx2Loader = ktx2Loader
    this.name = 'RawKtx2TexturePlugin'
  }

  loadTexture(textureIndex) {
    const json = this.parser.json
    const textureDef = json.textures?.[textureIndex]
    const sourceIndex = textureDef?.source
    if (sourceIndex === undefined || sourceIndex === null) return null

    const imageDef = json.images?.[sourceIndex]
    if (!imageDef) return null

    const isKtx2 =
      imageDef.mimeType === 'image/ktx2' ||
      (typeof imageDef.uri === 'string' && /\.ktx2($|\?)/i.test(imageDef.uri))
    if (!isKtx2) return null

    return this.parser.loadTextureImage(textureIndex, sourceIndex, this.ktx2Loader)
  }
}

// ========== 3D Tiles 加载管理器 ==========

/**
 * 3D Tiles 瓦片集加载管理器。
 *
 * 负责 TilesRenderer 的创建、插件注册（坐标 recenter、KTX2 贴图解码）、
 * 事件监听、图层管理与生命周期。
 *
 * 与 GltfModelLoader 对称：BimViewerController 统一管理两个加载器。
 */
export class TileModelLoader {
  /** 瓦片根容器（加入 scene） */
  root = new THREE.Group()
  /** 当前活跃的 TilesRenderer 实例列表 */
  tilesRenderers = []
  /** 首个瓦片数据源 */
  tilesetSource = null
  /** 是否有瓦片集加载完成 */
  ready = false

  /** KTX2 纹理解码器 */
  ktx2Loader = null

  deps

  /**
   * @param {Object} deps
   * @param {THREE.Scene} deps.scene - 场景（root 会加入其中）
   * @param {THREE.WebGLRenderer} deps.renderer - 渲染器
   * @param {Function} deps.getCamera - 获取主相机
   * @param {Function} [deps.onTilesetLoaded] - 瓦片集加载完成回调 (radius: number, isFirst: boolean)
   * @param {Function} [deps.onTileError] - 瓦片加载错误回调 (error: Event)
   */
  constructor(deps) {
    this.deps = deps
    this.root.name = 'tileset-root'
    deps.scene.add(this.root)

    // KTX2（Basis Universal）纹理解码器：cesiumlab 等产出的 3D Tiles
    // b3dm 贴图为 image/ktx2，无解码器时贴图加载失败、模型呈白膜。
    this.ktx2Loader = new KTX2Loader()
      .setTranscoderPath(KTX2_TRANSCODER_PATH)
      .setWorkerLimit(2)
      .detectSupport(deps.renderer)
  }

  // ========== 加载 ==========

  /**
   * 加载 3D Tiles 场景（支持多个数据源）。
   * @param {Array<{id: string, url: string}>} sources - 数据源列表
   */
  async loadScene(sources) {
    this.clear()

    const validSources = sources.filter((item) => item.url)
    if (validSources.length === 0) {
      throw new Error('未提供可加载的 3DTiles 数据源。')
    }

    this.tilesetSource = validSources[0]
    let isFirst = true
    const boundingSphere = new THREE.Sphere()
    const camera = this.deps.getCamera()

    for (const source of validSources) {
      const tr = new TilesRenderer(source.url)
      tr.setCamera(camera)
      tr.setResolutionFromRenderer(camera, this.deps.renderer)

      // 坐标 recenter
      tr.registerPlugin(new ReorientationPlugin({ up: '+z', recenter: true }))

      // KTX2 压缩贴图解码
      tr.registerPlugin(
        new GLTFExtensionsPlugin({
          metadata: false,
          rtc: false,
          ktxLoader: this.ktx2Loader,
          autoDispose: false,
          plugins: [(parser) => new RawKtx2TexturePlugin(parser, this.ktx2Loader)],
        }),
      )

      // 瓦片网格分配到 Layer 0（外壳层）并启用双面渲染 + 阴影
      tr.addEventListener('load-model', ({ scene }) => {
        scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.layers.set(0)
            if (obj.material) obj.material.side = THREE.DoubleSide
            obj.castShadow = true
            obj.receiveShadow = true
          }
        })
      })

      // 瓦片集加载完成：更新场景范围、相机裁剪面
      tr.addEventListener('load-tile-set', () => {
        let radius = 0
        if (tr.getBoundingSphere(boundingSphere)) {
          radius = boundingSphere.radius
        }

        this.ready = true
        const wasFirst = isFirst
        isFirst = false

        this.deps.onTilesetLoaded?.(radius, wasFirst)
      })

      tr.addEventListener('load-tile-error', (e) => {
        this.deps.onTileError?.(e)
      })

      this.root.add(tr.group)
      tr.group.userData.sourceId = source.id
      this.tilesRenderers.push(tr)
    }
  }

  // ========== 渲染循环 / 视口 ==========

  /**
   * 每帧更新所有可见的瓦片渲染器（在渲染循环中调用）。
   */
  update() {
    for (const tr of this.tilesRenderers) {
      if (tr.group.visible) tr.update()
    }
  }

  /**
   * 视口变化时同步瓦片 SSE 分辨率。
   * @param {THREE.Camera} camera
   * @param {THREE.WebGLRenderer} renderer
   */
  resize(camera, renderer) {
    for (const tr of this.tilesRenderers) {
      tr.setResolutionFromRenderer(camera, renderer)
    }
  }

  // ========== 图层管理 ==========

  /**
   * 设置指定瓦片图层的显隐。
   * @param {string} sourceId - 数据源 ID
   * @param {boolean} visible - 是否可见
   */
  setLayerVisible(sourceId, visible) {
    for (const tr of this.tilesRenderers) {
      if (tr.group.userData.sourceId === sourceId) {
        tr.group.visible = visible
        break
      }
    }
  }

  /**
   * 根据来源 ID 飞行定位到指定瓦片集。
   * @param {string} sourceId - 数据源 ID
   * @param {Function} flyToFn - 飞行函数 (box: THREE.Box3, duration: number)
   * @param {number} [duration=3000] - 飞行动画时长（毫秒）
   * @returns {boolean} 是否找到并飞行
   */
  flyToById(sourceId, flyToFn, duration = 5000) {
    const box = new THREE.Box3()
    for (const tr of this.tilesRenderers) {
      if (tr.group.userData.sourceId === sourceId) {
        if (tr.getBoundingBox(box)) {
          // getBoundingBox 返回的是 group 局部空间的包围盒，
          // 需要通过 group 的世界矩阵转换到场景坐标系
          tr.group.updateMatrixWorld(true)
          box.applyMatrix4(tr.group.matrixWorld)
          flyToFn(box, duration)
          return true
        }
        break
      }
    }
    return false
  }

  // ========== 状态查询 ==========

  /**
   * 获取首个瓦片渲染器的 group.matrixWorld（ECEF → 场景坐标变换矩阵）。
   * 用于 GLB 地理配准。
   * @returns {THREE.Matrix4|null}
   */
  getFirstTransform() {
    const first = this.tilesRenderers[0]
    if (!first) return null
    const group = first.group
    group.updateMatrixWorld(true)
    return group.matrixWorld.clone()
  }

  /**
   * 等待地形瓦片集根节点就绪。
   * 每 100ms 轮询检测，默认 30s 超时。
   * @param {number} [timeout=30000]
   * @returns {Promise<void>}
   */
  whenReady(timeout = 30000) {
    if (this.tilesRenderers.length === 0) {
      console.warn('[TileModelLoader] 未加载地形瓦片集，无法进行地理配准。')
      return Promise.resolve()
    }

    const isReady = () =>
      this.ready || this.tilesRenderers.some((tr) => Boolean(tr.root))
    if (isReady()) return Promise.resolve()

    return new Promise((resolve) => {
      const timerId = window.setInterval(() => {
        if (isReady()) {
          window.clearInterval(timerId)
          resolve()
        }
      }, 100)
      window.setTimeout(() => {
        window.clearInterval(timerId)
        resolve()
      }, timeout)
    })
  }

  // ========== 生命周期 ==========

  /** 释放并移除所有瓦片渲染器 */
  clear() {
    const camera = this.deps.getCamera()
    for (const tr of this.tilesRenderers) {
      tr.deleteCamera(camera)
      this.root.remove(tr.group)
      tr.dispose()
    }
    this.tilesRenderers = []
    this.tilesetSource = null
    this.ready = false
  }

  /**
   * 根据来源 ID 移除指定的瓦片集。
   * @param {string} sourceId - 数据源 ID（加载时传入的 id）
   * @returns {boolean} 是否成功移除
   */
  removeById(sourceId) {
    const camera = this.deps.getCamera()
    const idx = this.tilesRenderers.findIndex(
      (tr) => tr.group.userData.sourceId === sourceId,
    )
    if (idx === -1) return false
    const tr = this.tilesRenderers[idx]
    tr.deleteCamera(camera)
    this.root.remove(tr.group)
    tr.dispose()
    this.tilesRenderers.splice(idx, 1)
    return true
  }

  /** 释放全部资源（含 KTX2 解码器） */
  dispose() {
    this.clear()
    this.ktx2Loader?.dispose()
    this.ktx2Loader = null
  }
}

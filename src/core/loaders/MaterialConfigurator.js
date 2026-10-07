import * as THREE from 'three'

// ========== 预置材质库 ==========

function createDefaultLibrary() {
  const lib = {
    solid: [],
    tex: [],
    metal: [],
    trans: [],
    glass: [],
    wireframe: [],
    other: [],
  }

  // 纯色
  lib.solid.push({ id: 'm1', color: '#cccccc', name: '默认灰白' })
  lib.solid.push({ id: 'm2', color: '#ffffff', name: '纯白' })
  lib.solid.push({ id: 'm3', color: '#000000', name: '纯黑' })
  lib.solid.push({ id: 'm4', color: '#808080', name: '中灰' })
  lib.solid.push({ id: 'm5', color: '#ff2222', name: '红色' })
  lib.solid.push({ id: 'm6', color: '#ff8800', name: '橙色' })
  lib.solid.push({ id: 'm7', color: '#ffcc00', name: '黄色' })
  lib.solid.push({ id: 'm8', color: '#22cc44', name: '绿色' })
  lib.solid.push({ id: 'm9', color: '#2288ff', name: '蓝色磨砂' })
  lib.solid.push({ id: 'm10', color: '#00bbdd', name: '青色' })
  lib.solid.push({ id: 'm11', color: '#8844ff', name: '紫色' })
  lib.solid.push({ id: 'm12', color: '#ff44aa', name: '粉色' })
  lib.solid.push({ id: 'm13', color: '#8a5a2b', name: '棕色' })
  lib.solid.push({ id: 'm14', color: '#44dd88', name: '绿色光泽' })
  lib.solid.push({ id: 'm68', color: '#a3d900', name: '青柠' })
  lib.solid.push({ id: 'm69', color: '#44aaff', name: '天蓝' })
  lib.solid.push({ id: 'm70', color: '#3355ee', name: '靛蓝' })
  lib.solid.push({ id: 'm71', color: '#cc44ff', name: '品红' })

  // 贴图
  lib.tex.push({ id: 'm40', color: '#b0b0b0', name: '水泥地', textureDataURL: './assets/textures/concrete.jpg', tileX: 2, tileY: 2 })
  lib.tex.push({ id: 'm41', color: '#5a8a42', name: '草皮', textureDataURL: './assets/textures/grass.jpg', tileX: 2, tileY: 2 })
  lib.tex.push({ id: 'm42', color: '#6e5234', name: '泥巴', textureDataURL: './assets/textures/mud_1.png', tileX: 2, tileY: 2 })
  lib.tex.push({ id: 'm43', color: '#6e5234', name: '泥巴2', textureDataURL: './assets/textures/mud_2.png', tileX: 2, tileY: 2 })
  lib.tex.push({ id: 'm44', color: '#c4b282', name: '砂砾石', textureDataURL: './assets/textures/gravel.jpg', tileX: 2, tileY: 2 })
  lib.tex.push({ id: 'm45', color: '#a0a0a0', name: '碎石', textureDataURL: './assets/textures/crushed_stone_1.jpg', tileX: 2, tileY: 2 })
  lib.tex.push({ id: 'm46', color: '#a0a0a0', name: '碎石2', textureDataURL: './assets/textures/crushed_stone_2.png', tileX: 2, tileY: 2 })
  lib.tex.push({ id: 'm47', color: '#ffffff', name: '水面', textureDataURL: './assets/textures/water.png', tileX: 2, tileY: 2, roughness: 0.25, transparent: true })
  lib.tex.push({ id: 'm48', color: '#ffffff', name: '栏杆', textureDataURL: './assets/textures/railing.png', tileX: 2, tileY: 2, roughness: 0.5, transparent: true })
  lib.tex.push({ id: 'm49', color: '#ffffff', name: '网格', textureDataURL: './assets/textures/grid.png', tileX: 2, tileY: 2, roughness: 0.5, transparent: true })

  // 金属
  lib.metal.push({ id: 'm15', color: '#ff2222', name: '红色金属', metalness: 0.8, roughness: 0.2 })
  lib.metal.push({ id: 'm16', color: '#aa44ff', name: '紫色金属', metalness: 0.8, roughness: 0.2 })
  lib.metal.push({ id: 'm17', color: '#ff8800', name: '金色金属', metalness: 0.8, roughness: 0.2 })
  lib.metal.push({ id: 'm18', color: '#ffd700', name: '黄金', metalness: 1.0, roughness: 0.15 })
  lib.metal.push({ id: 'm19', color: '#c0c0c0', name: '白银', metalness: 1.0, roughness: 0.1 })
  lib.metal.push({ id: 'm20', color: '#b87333', name: '铜', metalness: 0.95, roughness: 0.3 })
  lib.metal.push({ id: 'm21', color: '#d4af37', name: '黄铜', metalness: 0.9, roughness: 0.35 })
  lib.metal.push({ id: 'm22', color: '#8c92ac', name: '不锈钢', metalness: 1.0, roughness: 0.2 })
  lib.metal.push({ id: 'm23', color: '#a8a8a8', name: '铁', metalness: 0.9, roughness: 0.5 })
  lib.metal.push({ id: 'm24', color: '#c8c8d0', name: '铝', metalness: 0.95, roughness: 0.25 })
  lib.metal.push({ id: 'm25', color: '#a99f8f', name: '钬', metalness: 0.9, roughness: 0.4 })
  lib.metal.push({ id: 'm26', color: '#4d4d4d', name: '深灰金属', metalness: 0.85, roughness: 0.3 })
  lib.metal.push({ id: 'm27', color: '#004466', name: '蓝钢', metalness: 0.9, roughness: 0.2 })
  lib.metal.push({ id: 'm28', color: '#111111', name: '黑金属', metalness: 0.9, roughness: 0.25 })
  lib.metal.push({ id: 'm72', color: '#22cc44', name: '绿色金属', metalness: 0.85, roughness: 0.22 })
  lib.metal.push({ id: 'm73', color: '#00c98a', name: '青绿金属', metalness: 0.85, roughness: 0.22 })
  lib.metal.push({ id: 'm74', color: '#00bbdd', name: '青色金属', metalness: 0.85, roughness: 0.22 })
  lib.metal.push({ id: 'm75', color: '#44aaff', name: '天蓝金属', metalness: 0.85, roughness: 0.22 })
  lib.metal.push({ id: 'm76', color: '#3355ee', name: '靛蓝金属', metalness: 0.85, roughness: 0.22 })
  lib.metal.push({ id: 'm77', color: '#ff44aa', name: '粉色金属', metalness: 0.85, roughness: 0.22 })
  lib.metal.push({ id: 'm78', color: '#cc44ff', name: '品红金属', metalness: 0.85, roughness: 0.22 })

  // 半透明
  lib.trans.push({ id: 'm29', color: '#ff6644', name: '半透明红', opacity: 0.6 })
  lib.trans.push({ id: 'm30', color: '#44aaff', name: '半透明蓝', opacity: 0.6 })
  lib.trans.push({ id: 'm31', color: '#44dd88', name: '半透明绿', opacity: 0.6 })
  lib.trans.push({ id: 'm32', color: '#ffcc44', name: '半透明黄', opacity: 0.6 })
  lib.trans.push({ id: 'm33', color: '#aa88ff', name: '半透明紫', opacity: 0.6 })
  lib.trans.push({ id: 'm34', color: '#88ccff', name: '半透明青', opacity: 0.6 })
  lib.trans.push({ id: 'm35', color: '#ffffff', name: '半透明白', opacity: 0.6 })
  lib.trans.push({ id: 'm36', color: '#888888', name: '半透明灰', opacity: 0.6 })
  lib.trans.push({ id: 'm79', color: '#ff8800', name: '半透明橙', opacity: 0.6 })
  lib.trans.push({ id: 'm80', color: '#a3d900', name: '半透明青柠', opacity: 0.6 })
  lib.trans.push({ id: 'm81', color: '#00c98a', name: '半透明青绿', opacity: 0.6 })
  lib.trans.push({ id: 'm82', color: '#44bbff', name: '半透明天蓝', opacity: 0.6 })
  lib.trans.push({ id: 'm83', color: '#3355ee', name: '半透明靛蓝', opacity: 0.6 })
  lib.trans.push({ id: 'm84', color: '#cc44ff', name: '半透明品红', opacity: 0.6 })
  lib.trans.push({ id: 'm85', color: '#ff44aa', name: '半透明粉', opacity: 0.6 })
  lib.trans.push({ id: 'm86', color: '#8a5a2b', name: '半透明棕', opacity: 0.6 })

  // 其它（线框等）
  lib.other.push({ id: 'm37', color: '#00ffff', name: '青色线框', wireframe: true })
  lib.other.push({ id: 'm38', color: '#ff4444', name: '红色线框', wireframe: true })
  lib.other.push({ id: 'm39', color: '#44ff44', name: '绿色线框', wireframe: true })
  lib.other.push({ id: 'm100', color: '#ff8800', name: '橙色线框', wireframe: true })
  lib.other.push({ id: 'm101', color: '#ffcc00', name: '黄色线框', wireframe: true })
  lib.other.push({ id: 'm102', color: '#a3d900', name: '青柠线框', wireframe: true })
  lib.other.push({ id: 'm103', color: '#00c98a', name: '青绿线框', wireframe: true })
  lib.other.push({ id: 'm104', color: '#44aaff', name: '天蓝线框', wireframe: true })
  lib.other.push({ id: 'm105', color: '#4488ff', name: '蓝色线框', wireframe: true })
  lib.other.push({ id: 'm106', color: '#3355ee', name: '靛蓝线框', wireframe: true })
  lib.other.push({ id: 'm107', color: '#aa44ff', name: '紫色线框', wireframe: true })
  lib.other.push({ id: 'm108', color: '#cc44ff', name: '品红线框', wireframe: true })
  lib.other.push({ id: 'm109', color: '#ff66aa', name: '粉线框', wireframe: true })
  lib.other.push({ id: 'm110', color: '#8a5a2b', name: '棕线框', wireframe: true })

  // 玻璃（物理折射）
  lib.glass.push({ id: 'm50', color: '#88ddff', name: '蓝色玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm51', color: '#ff6644', name: '红色玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm52', color: '#44dd88', name: '绿色玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm53', color: '#ffcc44', name: '黄色玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm54', color: '#aa88ff', name: '紫色玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm55', color: '#ffffff', name: '透明玻璃', ior: 1.5, opacity: 0.15 })
  lib.glass.push({ id: 'm56', color: '#ff88aa', name: '粉色玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm57', color: '#44aaff', name: '海洋蓝玻璃', ior: 1.4, opacity: 0.25 })
  lib.glass.push({ id: 'm87', color: '#ff8800', name: '橙色玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm88', color: '#a3d900', name: '青柠玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm89', color: '#00c98a', name: '青绿玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm90', color: '#00bbdd', name: '青色玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm91', color: '#3355ee', name: '靛蓝玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm92', color: '#cc44ff', name: '品红玻璃', ior: 1.5, opacity: 0.2 })
  lib.glass.push({ id: 'm93', color: '#8a5a2b', name: '棕玻璃', ior: 1.5, opacity: 0.2 })

  // 线框（边线覆盖层）
  lib.wireframe.push({ id: 'm58', color: '#00ffff', name: '青色线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm59', color: '#ff4444', name: '红色线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm60', color: '#ffcc00', name: '黄色线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm61', color: '#44ff44', name: '绿色线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm62', color: '#4488ff', name: '蓝色线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm63', color: '#ff8800', name: '橙色线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm64', color: '#aa44ff', name: '紫色线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm65', color: '#ff66aa', name: '粉色线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm66', color: '#ffffff', name: '白色线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm67', color: '#444444', name: '深灰线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm94', color: '#a3d900', name: '青柠线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm95', color: '#00c98a', name: '青绿线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm96', color: '#44aaff', name: '天蓝线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm97', color: '#3355ee', name: '靛蓝线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm98', color: '#cc44ff', name: '品红线框', edgeThreshold: 45 })
  lib.wireframe.push({ id: 'm99', color: '#8a5a2b', name: '棕线框', edgeThreshold: 45 })

  return lib
}

// ========== 材质创建函数 ==========

function createSolidMaterial(cfg) {
  return new THREE.MeshStandardMaterial({
    name: cfg.name,
    color: cfg.color || '#ff6633',
    metalness: 0,
    roughness: 0.5,
  })
}

/** 共享 TextureLoader 实例（避免每次创建材质重复实例化） */
const _textureLoader = new THREE.TextureLoader()

function createTexMaterial(cfg, renderer) {
  const mat = new THREE.MeshStandardMaterial({
    name: cfg.name,
    color: cfg.color || '#ffffff',
    metalness: 0,
    roughness: cfg.roughness !== undefined ? cfg.roughness : 0.5,
    transparent: cfg.transparent === true,
  })
  if (cfg.textureDataURL) {
    const tex = _textureLoader.load(cfg.textureDataURL)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(cfg.tileX || 1, cfg.tileY || 1)
    tex.colorSpace = THREE.SRGBColorSpace
    // 各向异性过滤（提升斜角采样质量）
    const maxAniso = renderer?.capabilities.getMaxAnisotropy?.() ?? 16
    tex.anisotropy = maxAniso
    mat.map = tex
    mat.needsUpdate = true
  }
  return mat
}

function createMetalMaterial(cfg) {
  return new THREE.MeshStandardMaterial({
    name: cfg.name,
    color: cfg.color || '#ff8800',
    metalness: cfg.metalness ?? 0.8,
    roughness: cfg.roughness ?? 0.2,
  })
}

function createTransMaterial(cfg) {
  return new THREE.MeshStandardMaterial({
    name: cfg.name,
    color: cfg.color || '#44aaff',
    metalness: 0,
    roughness: 0.3,
    transparent: true,
    opacity: cfg.opacity ?? 0.6,
  })
}

function createOtherMaterial(cfg) {
  if (cfg.wireframe) {
    return new THREE.MeshStandardMaterial({
      name: cfg.name,
      color: cfg.color || '#00ffff',
      wireframe: true,
    })
  }
  return new THREE.MeshStandardMaterial({
    name: cfg.name,
    color: cfg.color || '#ffffff',
  })
}

/** 创建玻璃材质（MeshPhysicalMaterial，物理折射 + 清漆层） */
function createGlassMaterial(cfg) {
  return new THREE.MeshPhysicalMaterial({
    name: cfg.name,
    color: cfg.color || '#88ddff',
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: cfg.opacity ?? 0.2,
    ior: cfg.ior || 1.5,
    envMapIntensity: 2.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

/**
 * 创建线框材质配置。
 * 线框不是真实 Mesh 材质，而是边线覆盖层；
 * 返回配置标记对象，由应用层构建 EdgesGeometry + LineSegments。
 */
function createWireframeMaterial(cfg) {
  return {
    isWireframe: true,
    color: cfg.color || '#00ffff',
    edgeThreshold: cfg.edgeThreshold || 45,
  }
}

// ========== 材质配置器 ==========

/**
 * GLB 模型材质统一配置入口。
 *
 * 维护一份预置材质库（纯色 / 贴图 / 金属 / 半透明 / 玻璃 / 线框 / 其它），
 * 读取配置数组中按 meshName 记录的材质分配，
 * 批量覆盖到已加载的 GLB 模型网格上。
 *
 * matKey 支持两种格式：
 * - 材质编辑器 ID 格式："m1"、"m46"（从导出的 JSON 直接读取）
 * - 类型_索引 格式："tex_0"、"solid_3"
 */
export class MaterialConfigurator {
  lib
  renderer
  /** ID → { type, idx } 映射表 */
  idMap = new Map()
  /** matKey → 材质实例缓存（同一 key 复用同一实例，避免 GPU 资源重复创建） */
  materialCache = new Map()

  /**
   * @param {THREE.WebGLRenderer} [renderer]
   */
  constructor(renderer) {
    this.renderer = renderer
    this.lib = createDefaultLibrary()
    this.buildIdMap()
  }

  /** 遍历材质库，为每个条目的 id 字段建立快速查找索引 */
  buildIdMap() {
    this.idMap.clear()
    const types = ['solid', 'tex', 'metal', 'trans', 'glass', 'wireframe', 'other']
    for (const type of types) {
      const items = this.lib[type]
      for (let i = 0; i < items.length; i++) {
        const id = items[i].id
        if (id) this.idMap.set(id, { type, idx: i })
      }
    }
  }

  /**
   * 直接传入配置数组应用材质映射。
   * @param {Array} arr - 材质配置数组
   * @param {THREE.Object3D} model - 已加载的 GLB 模型根节点
   * @param {string} [sourceId] - 模型来源 ID，用于过滤配置条目（对应 gltfSources[].id）
   * @returns {{ hdrMeta: Object|null, appliedCount: number }}
   */
  applyConfig(arr, model, sourceId) {
    if (!Array.isArray(arr)) return { hdrMeta: null, appliedCount: 0 }
    const { entries, hdrMeta } = this.parseStateArray(arr)
    const appliedCount = this.applyEntries(entries, model, sourceId)
    return { hdrMeta, appliedCount }
  }

  /** 解析 material-state.json 数组：分离网格材质条目和 HDR 元数据。 */
  parseStateArray(arr) {
    const entries = []
    let hdrMeta = null

    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const obj = item

      if (obj.__hdrMeta === true) {
        hdrMeta = {
          __hdrMeta: true,
          envInt: obj.envInt ?? 0,
          bgInt: obj.bgInt ?? 1,
          exposure: obj.exposure ?? 1,
        }
        continue
      }

      if (typeof obj.meshName === 'string' && (typeof obj.modelId === 'string' || typeof obj.modelName === 'string')) {
        entries.push({
          modelId: obj.modelId ?? obj.modelName,
          meshName: obj.meshName,
          matKey: obj.matKey ?? '',
        })
      }
    }

    return { entries, hdrMeta }
  }

  /** 遍历模型，按 meshName 匹配并应用 matKey 对应的材质。支持按 sourceId 过滤。 */
  applyEntries(entries, model, sourceId) {
    // 过滤 matKey 非空的条目，若有 sourceId 则只保留匹配的条目
    const relevant = entries.filter((e) => {
      if (!e.matKey) return false
      if (sourceId && e.modelId !== sourceId) return false
      return true
    })
    if (relevant.length === 0) return 0

    // meshName → matKey 快速查找
    const meshMap = new Map()
    for (const e of relevant) {
      meshMap.set(e.meshName, e.matKey)
    }

    let appliedCount = 0
    model.traverse((obj) => {
      const mesh = obj
      if (!mesh.isMesh || !mesh.name) return

      const matKey = meshMap.get(mesh.name.trim())
      if (!matKey) return

      const mat = this.getMaterialByKey(matKey)
      if (!mat) return

      // 线框材质是配置标记对象（非 THREE.Material），需要边线覆盖层处理，此处仅记录 matKey
      if (!(mat instanceof THREE.Material)) {
        mesh.userData._matKey = matKey
        return
      }

      mesh.material = mat
      mesh.userData._matKey = matKey
      appliedCount++
    })

    return appliedCount
  }

  /**
   * 根据 matKey 获取材质实例（缓存复用）。
   *
   * 同一 matKey 始终返回同一实例，多个 mesh 共享引用，
   * 避免重复创建材质和纹理导致的 GPU 内存暴涨。
   *
   * @param {string} matKey
   * @returns {THREE.Material | Object | null}
   */
  getMaterialByKey(matKey) {
    // 命中缓存直接返回
    if (this.materialCache.has(matKey)) {
      return this.materialCache.get(matKey)
    }

    let mat = null

    // 优先按 ID 格式查找（材质编辑器导出的 "mN" 格式）
    const idEntry = this.idMap.get(matKey)
    if (idEntry) {
      mat = this.createMaterial(idEntry.type, idEntry.idx)
    } else {
      // 回退到 type_idx 格式
      const sepIdx = matKey.lastIndexOf('_')
      if (sepIdx >= 0) {
        const type = matKey.slice(0, sepIdx)
        const idx = parseInt(matKey.slice(sepIdx + 1), 10)
        if (!isNaN(idx)) {
          mat = this.createMaterial(type, idx)
        }
      }
    }

    if (mat) this.materialCache.set(matKey, mat)
    return mat
  }

  /**
   * 按类型和索引创建材质实例（底层工厂方法）。
   * 每次调用返回新实例。上层应优先使用 getMaterialByKey（带缓存）。
   *
   * @param {string} type
   * @param {number} idx
   * @returns {THREE.Material | Object | null}
   */
  createMaterial(type, idx) {
    const items = this.lib[type]
    if (!items || idx < 0 || idx >= items.length) return null

    switch (type) {
      case 'solid':
        return createSolidMaterial(items[idx])
      case 'tex':
        return createTexMaterial(items[idx], this.renderer)
      case 'metal':
        return createMetalMaterial(items[idx])
      case 'trans':
        return createTransMaterial(items[idx])
      case 'glass':
        return createGlassMaterial(items[idx])
      case 'wireframe':
        return createWireframeMaterial(items[idx])
      case 'other':
        return createOtherMaterial(items[idx])
      default:
        return null
    }
  }

  /** 获取材质库（只读引用，可直接读取各分类列表） */
  getLibrary() {
    return this.lib
  }

  /** 替换整个材质库（用于从外部导入材质定义），同时清除已缓存的材质实例 */
  setLibrary(lib) {
    Object.assign(this.lib, lib)
    this.buildIdMap()
    this.clearCache()
  }

  /** 清除材质实例缓存（释放 GPU 资源，下次 getMaterialByKey 会重新创建） */
  clearCache() {
    for (const mat of this.materialCache.values()) {
      if (mat && typeof mat.dispose === 'function') mat.dispose()
    }
    this.materialCache.clear()
  }
}

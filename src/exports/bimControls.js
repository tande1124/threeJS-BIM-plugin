/**
 * BIM 查看器外部操作类
 *
 * 外部项目通过该对象在 InsBimPlusViewer 组件外部直接调用查看器相关方法
 * （模型操作、材质、标注、标签、环境控制等）。
 *
 * 使用方式：
 *   import { bimControls } from '@ins/vam2-plugin-bim'
 *   bimControls.highlightPart('some-part-name')
 */
import { getViewer } from './internal/viewerRegistry'
import { MaterialConfigurator } from '../core/loaders/MaterialConfigurator'

/** 材质配置器缓存实例（避免重复构建） */
let _matCfgInstance = null
/** 当前材质配置（配置数组），供后续 loadGltfModels 自动应用 */
let _materialConfig = null


const ServerService = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_SERVICE) || ''

/**
 * 根据当前页面地址动态计算服务基址。
 * 取当前 URL 的目录部分，效果和浏览器解析相对链接的 base 一致，
 * 确保 WMS / 3DTiles 请求能自动带上应用部署路径前缀。
 */
export function getServiceBaseUrl() {
  const cleanHref = window.location.href.split('#')[0].split('?')[0]
  return new URL('.', cleanHref).href.replace(/\/$/, '')
}

/**
 * BIM 查看器外部操作接口
 */
const bimControls = {
  // TODO ========== 数据加载 ==========

  /**
   * 加载 3D Tiles 地形。
   * @param {Array<{id: string, url: string, name?: string, visible?: boolean}>} sources
   */
  async loadTilesets(sources) {
    const c = getViewer()
    if (!c || !sources?.length) return
    const mapped = sources.map((s) => ({
      id: s.id,
      name: s.name || s.id,
      kind: 'terrain',
      url: /^https?:\/\//i.test(s.url) ? s.url : getServiceBaseUrl() + `/${ServerService}${s.url}`,
    }))
    await c.loadScene(mapped)

    // 加载完成后应用显隐配置（visible 为 null/undefined 时默认显示）
    for (const s of sources) {
      if (s.visible === false) {
        c.setModelVisible(s.id, false, '3dtiles')
      }
    }

    // 地形加载后刷新阴影（设置 mesh castShadow/receiveShadow + 适配阴影相机范围）
    this.refreshSceneShadows()
  },

  /**
   * 依次加载 GLTF 模型。
   * 若之前调用过 applyMaterialConfig，会自动将材质配置应用到新加载的模型。
   * @param {Array<{id: string, url: string, name?: string, visible?: boolean}>} sources
   * @param {Object} [geoOrigin] - 地理配准原点
   * @param {Object} [callbacks] - 可选回调（供 Vue 组件注入 $emit）
   * @param {Function} [callbacks.onModelLoaded] - 单个模型加载成功 (id, url)
   * @param {Function} [callbacks.onError] - 单个模型加载失败 (error, id, url)
   */
  async loadGltfModels(sources, geoOrigin, callbacks) {
    const c = getViewer()
    if (!c || !sources?.length) return
    const loader = c.getGltfModelLoader()

    for (const source of sources) {
      try {
        const model = await loader.loadGltf(source.url, { geo: geoOrigin, id: source.id, name: source.name })

        // 自动应用已缓存的材质配置
        if (_materialConfig && _matCfgInstance) {
          _matCfgInstance.applyConfig(_materialConfig, model, source.id)
        }

        // 应用显隐配置（visible 为 null/undefined 时默认显示）
        if (source.visible === false) {
          model.visible = false
        }

        if (callbacks?.onModelLoaded) {
          callbacks.onModelLoaded(source.id, source.url)
        } else {
          console.log(`已加载模型: ${source.id} (${source.url})`)
        }
      } catch (error) {
        if (callbacks?.onError) {
          callbacks.onError(error, source.id, source.url)
        } else {
          console.error(`模型加载失败: ${source.url}`, error)
        }
      }
    }
  },

  /**
   * 加载并渲染 3D 标签，完成后自动飞行到标签位置。
   * @param {Object} config - 标签配置对象（含 type、list 字段）
   */
  async renderLabels(config) {
    const loader = getViewer()?.getLabelRenderer()
    if (!loader) return
    await loader.renderFromConfig(config)
  },

  // TODO ========== 配置管理（整体替换） ==========

  /**
   * 应用环境配置（天空/HDR/光照/曝光）。
   * @param {Object} config - 配置对象
   */
  async applyEnvConfig(config) {
    await getViewer()?.applyEnvConfig(config)
  },
  
  /**
   * 应用材质映射配置，并重新应用到所有已加载 GLB 模型。
   * 后续调用 loadGltfModels 时也会自动应用此配置。
   * @param {Array} config - 配置数组
   */
  async applyMaterialConfig(config) {
    const c = getViewer()
    if (!c) return
    if (!_matCfgInstance) {
      _matCfgInstance = new MaterialConfigurator(c.renderer)
    }
    _materialConfig = config
    // 重新应用到所有已加载的 GLB 模型（按 sourceId 过滤配置条目）
    const root = c.getGltfModelLoader()?.root
    if (root) {
      for (const model of root.children) {
        _matCfgInstance.applyConfig(config, model, model.userData?.sourceId)
      }
    }
  },

  /**
   * 设置相机位置和观察目标。
   * @param {{ position?: {x,y,z}, target?: {x,y,z} }} cfg
   */
  applyCameraConfig(cfg) {
    getViewer()?.applyCameraConfig(cfg)
  },

  /**
   * 获取当前相机位置和观察目标。
   * 返回格式与 biz-config.js 的 camera 配置一致，可直接用于 applyCameraConfig。
   * @returns {{ position: {x,y,z}, target: {x,y,z} } | null}
   */
  getCameraInfo() {
    const c = getViewer()
    if (!c?.cameraManager?.camera) return null
    const pos = c.cameraManager.camera.position
    const tgt = c.cameraManager.controls?.target
    if (!tgt) return null
    return {
      position: { x: pos.x, y: pos.y, z: pos.z },
      target: { x: tgt.x, y: tgt.y, z: tgt.z },
    }
  },

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
    getViewer()?.resetCamera(cameraConfig, duration)
  },


  // TODO========== 运行时细粒度调参 ==========

  /**
   * 修改单个环境参数并立即生效。
   * key 支持点分路径，如 'envLight.exposure'、'dirLight.intensity'。
   * @param {string} key
   * @param {*} value
   */
  setEnvParam(key, value) {
    const env = getViewer()?.environment
    if (!env?.config) return
    const parts = key.split('.')
    let obj = env.config
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]]
      if (!obj) return
    }
    obj[parts.at(-1)] = value
    env.applyAllParams()
  },

  /**
   * 返回当前环境配置对象（只读快照）。
   * @returns {Object|null}
   */
  getEnvConfig() {
    return getViewer()?.environment?.getConfig() ?? null
  },


  // TODO ========== 部件操作 ==========

  /**
   * 通过来源 ID 获取模型结构树。
   * @param {string} id - 模型来源 ID（对应 gltfSources[].id）
   * @returns {Object|null} 树结构数据
   */
  getModelTreeById(id) {
    return getViewer()?.getGltfModelLoader()?.getModelTreeById(id) ?? null
  },

  /**
   * 按名称查找部件，返回结构化信息（与 gltf-pick 事件 info 格式一致）。
   * @param {string} name - 部件名称
   * @returns {Object|null} { object, name, path, worldPosition, localPosition, screenPosition, model }
   */
  findPartByName(name) {
    return getViewer()?.getGltfModelLoader()?.findPartByName(name) ?? null
  },

  /**
   * 按 name 修改部件材质。
   * @param {string} name - mesh name
   * @param {string|THREE.Material} matKey - 材质库 ID（如 'm5'）或 THREE.Material 实例
   * @returns {boolean}
   */
  setPartMaterial(name, matKey) {
    const info = this.findPartByName(name)
    if (!info) {
      console.warn(`部件 "${name}" 未找到`)
      return false
    }
    const part = info.object

    // matKey 为空：重置回 GLB 原始材质
    if (!matKey) {
      part.traverse((c) => {
        if (c.isMesh && c.userData._gltfOriginalMaterial) {
          c.material = c.userData._gltfOriginalMaterial
        }
      })
      return true
    }

    if (typeof matKey === 'string') {
      const c = getViewer()
      if (!_matCfgInstance && c) {
        _matCfgInstance = new MaterialConfigurator(c.renderer)
      }
      if (!_matCfgInstance) return false
      const mat = _matCfgInstance.getMaterialByKey(matKey)
      if (!mat || !mat.isMaterial) return false
      part.traverse((c) => { if (c.isMesh) c.material = mat })
      return true
    }

    part.traverse((c) => { if (c.isMesh) c.material = matKey })
    return true
  },

  /**
   * 按 name 高亮部件（半透明 + 轮廓线）并飞行聚焦。
   * @param {string} name - 部件名称
   * @returns {Object|false} 部件信息或 false
   */
  highlightPart(name) {
    const c = getViewer()
    const loader = c?.getGltfModelLoader()
    const info = this.findPartByName(name)
    if (!info || !loader) return false
    loader.highlight(info.object)
    loader.flyToObject(info.object)
    console.log(`已高亮部件 "${name}"`, info)
    return info
  },

  /** 清除当前高亮 */
  clearHighlight() {
    getViewer()?.clearGltfHighlight()
  },


  // TODO ========== 标注管理 ==========

  /** 
   * 添加 HTML 标注（位置，元素）。
   * @param {THREE.Vector3} position - 世界坐标
   * @param {HTMLElement} element - DOM 元素
   * @param {Object} [vueApp] - 关联的 Vue app 实例，清理时自动 unmount
   */
  addAnnotation(position, element, vueApp) {
    getViewer()?.addAnnotation(position, element, vueApp)
  },

  /** 清除所有标注 */
  clearAnnotations() {
    getViewer()?.clearAnnotations()
  },



  // TODO ========== 图层控制 ==========

  /** 控制环境贴图是否启用 */
  controlEnvEnabled(enabled) {
    getViewer()?.environment.controlEnvMapEnabled(enabled)
  },

  /** 显示/隐藏灯光方向辅助线 */
  toggleLightHelper(show) {
    getViewer()?.environment.toggleLightHelper(show)
  },

  /**
   * 刷新场景阴影设置（模型加载后调用）。
   * 遍历场景所有 mesh 设置 castShadow/receiveShadow，并重新适配阴影相机范围。
   */
  refreshSceneShadows() {
    const env = getViewer()?.environment
    if (!env?.dirLight) return
    const shadowEnabled = env.config?.dirLight?.shadow?.enabled ?? true
    env._setMeshShadows(shadowEnabled)
    env._autoFitShadowCamera()
  },

  /**
   * 根据来源 ID 设置模型显隐。
   * @param {string} id - 数据源 ID
   * @param {boolean} visible - 是否可见
   * @param {'3dtiles'|'glb'|'gltf'} [type] - 模型类型；省略时同时在两端查找
   * @returns {boolean}
   */
  setModelVisible(id, visible, type) {
    return getViewer()?.setModelVisible(id, visible, type) ?? false
  },

  /**
   * 按类型批量设置所有模型的显隐。
   * @param {'3dtiles'|'glb'|'gltf'} type - 模型类型
   * @param {boolean} visible - 是否可见
   */
  setModelVisibleByType(type, visible) {
    const c = getViewer()
    if (!c) return

    if (type === '3dtiles') {
      for (const tr of c.tileModelLoader.tilesRenderers) {
        tr.group.visible = visible
      }
      return
    }

    if (type === 'glb' || type === 'gltf') {
      const loader = c.getGltfModelLoader()
      if (!loader) return
      for (const model of loader.root.children) {
        model.visible = visible
      }
    }
  },

  /**
   * 根据来源 ID 移除模型。
   * @param {string} id - 数据源 ID
   * @param {'3dtiles'|'glb'|'gltf'} [type] - 模型类型；省略时同时尝试移除 3DTiles 和 GLB
   * @returns {boolean} 是否成功移除
   */
  removeModel(id, type) {
    return getViewer()?.removeModel(id, type) ?? false
  },

  /** 切换双相机透视渲染模式 */
  setDualPass(enabled) {
    getViewer()?.setDualPass(enabled)
  },

  /**
   * 切换标签图层的显隐。
   * @param {string} type - 图层组 ID（对应配置中的 type 字段）
   * @param {boolean} visible
   */
  setLabelVisible(type, visible) {
    getViewer()?.getLabelRenderer()?.setGroupVisible(type, visible)
  },

  /**
   * 根据来源 ID 飞行定位到指定模型。
   * @param {string} id - 数据源 ID
   * @param {number} [duration=3000] - 飞行动画时长（毫秒）
   * @param {'3dtiles'|'glb'|'gltf'} [type] - 模型类型；省略时同时在两端查找
   * @returns {boolean}
   */
  flyToModel(id, duration = 3000, type) {
    return getViewer()?.flyToModel(id, duration, type) ?? false
  },

  /**
   * 动态更新所有 GLB 模型的场景偏移配置（无需重新加载模型）。
   * 首次设置（无 geoOrigin）时直接应用绝对配准矩阵；
   * 已有 geoOrigin 时计算增量矩阵统一更新。仅影响 GLB，3D Tiles 不受影响。
   * @param {Object} newGeoInfo - 新的地理配准参数
   * @param {number} newGeoInfo.centralMeridianDeg - 中央子午线经度（度）
   * @param {number} newGeoInfo.offsetX - 东坐标（米）
   * @param {number} newGeoInfo.offsetY - 北坐标（米）
   * @param {number} [newGeoInfo.offsetZ=0] - 高程（米）
   * @param {number} [newGeoInfo.verticalScale=1] - 垂直缩放比例
   * @returns {Promise<boolean>}
   */
  async setGltfGeoOrigin(newGeoInfo) {
    return getViewer()?.setGltfGeoOrigin(newGeoInfo) ?? false
  },

  /**
   * 根据标签 ID 飞行定位到对应 3D 标签。
   * @param {number|string} id - 标签 ID
   * @param {number} [duration=3000] - 飞行动画时长（毫秒）
   */
  flyToLabel(id, duration = 3000) {
    const c = getViewer()
    const loader = c?.getLabelRenderer()
    if (!loader || !c) return
    const target = loader.flyToLabel(id)
    if (target) {
      c.cameraManager.flyTo(target.center, target.distance / 12, duration)
    }
  },

  // ========== 生命周期 ==========

  /**
   * 释放 bimControls 内部缓存的 GPU 资源。
   * 清除材质配置器缓存（含纹理）、重置材质配置引用。
   * 应在查看器销毁时调用。
   */
  dispose() {
    if (_matCfgInstance) {
      _matCfgInstance.clearCache()
      _matCfgInstance = null
    }
    _materialConfig = null
  },
}

export { bimControls }

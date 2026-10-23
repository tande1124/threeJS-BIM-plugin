/**
 * BIM 查看器外部操作类
 *
 * 外部项目通过该对象在 InsBimPlusViewer 组件外部直接调用查看器相关方法
 * （模型操作、材质、标注、标签、环境控制等）。
 *
 * 使用方式：
 *   import { bimControls } from '@ins/vam2-plugin-bim'
 *   bimControls.highlightPart('some-part-name')            // 单实例，省略 viewerId
 *   bimControls.highlightPart('some-part-name', viewerId)  // 多实例，指定 viewerId
 *
 * 所有方法最后一个参数为 viewerId（可选，省略时操作第一个注册的实例）。
 */
import { getViewer } from './internal/viewerRegistry'
import { MaterialConfigurator } from '../core/loaders/MaterialConfigurator'

/** 材质配置器缓存实例，按 viewerId 隔离 */
const _matCfgCache = new Map()
/** 当前材质配置，按 viewerId 隔离 */
const _materialConfigCache = new Map()


const ServerService = ''

/**
 * 根据当前页面地址动态计算服务基址。
 */
export function getServiceBaseUrl() {
	const cleanHref = window.location.href.split('#')[0].split('?')[0]
	return new URL('.', cleanHref).href.replace(/\/$/, '')
}

/** 获取指定 viewer 的材质配置器（懒创建） */
function _getMatCfg(viewerId) {
	const c = getViewer(viewerId)
	if (!c) return null
	if (!_matCfgCache.has(viewerId)) {
		_matCfgCache.set(viewerId, new MaterialConfigurator(c.renderer))
	}
	return _matCfgCache.get(viewerId)
}

/**
 * BIM 查看器外部操作接口
 */
const bimControls = {
	// TODO ========== 数据加载 ==========

	/**
	 * 加载 3D Tiles 地形。
	 * @param {Array<{id: string, url: string, name?: string, visible?: boolean}>} sources
	 * @param {string} [viewerId]
	 */
	async loadTilesets(sources, viewerId, callbacks) {
		const c = getViewer(viewerId)
		if (!c || !sources?.length) return
		const mapped = sources.map((s) => {
			let url = s.url
			if (!/^https?:\/\//i.test(url)) {
				url = /^https?:\/\//i.test(ServerService)
					? `${ServerService.replace(/\/$/, '')}${s.url}`
					: getServiceBaseUrl() + `/${ServerService}${s.url}`
			}
			return { id: s.id, name: s.name || s.id, kind: 'terrain', url }
		})
		await c.loadScene(mapped)

		for (const s of sources) {
			if (s.visible === false) {
				c.setModelVisible(s.id, false, '3dtiles')
			}
		}

		this.refreshSceneShadows(viewerId)
	},

	/**
	 * 依次加载 GLTF 模型。
	 * @param {Array<{id: string, url: string, name?: string, visible?: boolean}>} sources
	 * @param {Object} [geoOrigin] - 地理配准原点
	 * @param {Object} [callbacks] - 可选回调
	 * @param {string} [viewerId]
	 */
	async loadGltfModels(sources, geoOrigin, viewerId, callbacks) {
		const c = getViewer(viewerId)
		if (!c || !sources?.length) return
		const loader = c.getGltfModelLoader()
		const matCfg = _matCfgCache.get(viewerId)
		const matConfig = _materialConfigCache.get(viewerId)

		for (const source of sources) {
			try {
				const model = await loader.loadGltf(source.url, { geo: geoOrigin || window._geoInfoConfig, id: source.id, name: source.name })

				if (matConfig && matCfg) {
					matCfg.applyConfig(matConfig, model, source.id)
				}

				if (source.visible === false) {
					model.visible = false
				}
				if (callbacks?.onModelLoaded) {
					callbacks.onModelLoaded(source.id, source.url, model)
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
	 * @param {Object} config
	 * @param {string} [viewerId]
	 */
	async renderLabels(config, viewerId) {
		const loader = getViewer(viewerId)?.getLabelRenderer()
		if (!loader) return
		await loader.renderFromConfig(config)
	},

	// TODO ========== 配置管理（整体替换） ==========

	/**
	 * 应用环境配置（天空/HDR/光照/曝光）。
	 * @param {Object} config
	 * @param {string} [viewerId]
	 */
	async applyEnvConfig(config, viewerId) {
		const env = config || window._envConfig
		await getViewer(viewerId)?.applyEnvConfig(env)
	},

	/**
	 * 应用材质映射配置，并重新应用到所有已加载 GLB 模型。
	 * @param {Array} config
	 * @param {string} [viewerId]
	 */
	async applyMaterialConfig(config, viewerId) {
		const c = getViewer(viewerId)
		if (!c) return
		const matCfg = _getMatCfg(viewerId)
		if (!matCfg) return
		_materialConfigCache.set(viewerId, config)
		const root = c.getGltfModelLoader()?.root
		if (root) {
			for (const model of root.children) {
				matCfg.applyConfig(config, model, model.userData?.sourceId)
			}
		}
	},

	/**
	 * 设置相机位置和观察目标。
	 * @param {{ position?: {x,y,z}, target?: {x,y,z} }} cfg
	 * @param {string} [viewerId]
	 */
	applyCameraConfig(cfg, viewerId) {
		getViewer(viewerId)?.applyCameraConfig(cfg)
	},

	/**
	 * 获取当前相机位置和观察目标。
	 * @param {string} [viewerId]
	 * @returns {{ position: {x,y,z}, target: {x,y,z} } | null}
	 */
	getCameraInfo(viewerId) {
		const c = getViewer(viewerId)
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
	 * @param {Object} [cameraConfig]
	 * @param {number} [duration=3000]
	 * @param {string} [viewerId]
	 */
	resetCamera(cameraConfig, duration = 3000, viewerId) {
		getViewer(viewerId)?.resetCamera(cameraConfig, duration)
	},


	// TODO========== 运行时细粒度调参 ==========

	/**
	 * 修改单个环境参数并立即生效。
	 * @param {string} key
	 * @param {*} value
	 * @param {string} [viewerId]
	 */
	setEnvParam(key, value, viewerId) {
		const env = getViewer(viewerId)?.environment
		if (!env?.config) return

		const parts = key.split('.')
		let obj = env.config
		for (let i = 0; i < parts.length - 1; i++) {
			if (!obj[parts[i]]) obj[parts[i]] = {}
			obj = obj[parts[i]]
		}
		obj[parts.at(-1)] = value

		if (parts[0] === 'bloom') {
			env.applyBloom(env.config.bloom)
		} else {
			env.applyAllParams()
		}
	},

	/**
	 * 返回当前环境配置对象（只读快照）。
	 * @param {string} [viewerId]
	 * @returns {Object|null}
	 */
	getEnvConfig(viewerId) {
		return getViewer(viewerId)?.environment?.getConfig() ?? null
	},


	// TODO ========== 部件操作 ==========

	/**
	 * 通过来源 ID 获取模型结构树。
	 * @param {string} id
	 * @param {string} [viewerId]
	 * @returns {Object|null}
	 */
	getModelTreeById(id, viewerId) {
		return getViewer(viewerId)?.getGltfModelLoader()?.getModelTreeById(id) ?? null
	},

	/**
	 * 按名称查找部件，返回结构化信息。
	 * @param {string} name
	 * @param {string} [viewerId]
	 * @returns {Object|null}
	 */
	findPartByName(name, viewerId) {
		return getViewer(viewerId)?.getGltfModelLoader()?.findPartByName(name) ?? null
	},

	/**
	 * 按 name 修改部件材质。
	 * @param {string} name
	 * @param {string|THREE.Material} matKey
	 * @param {string} [viewerId]
	 * @returns {boolean}
	 */
	setPartMaterial(name, matKey, viewerId) {
		const info = this.findPartByName(name, viewerId)
		if (!info) {
			console.warn(`部件 "${name}" 未找到`)
			return false
		}
		const part = info.object

		if (!matKey) {
			part.traverse((c) => {
				if (!c.isMesh) return
				const oldEdge = c.children.find(ch => ch.name === '_wireframeEdge')
				if (oldEdge) {
					oldEdge.geometry.dispose()
					c.remove(oldEdge)
				}
				if (c.userData._gltfOriginalMaterial) {
					if (c.material !== c.userData._gltfOriginalMaterial && typeof c.material.dispose === 'function') {
						c.material.dispose()
					}
					c.material = c.userData._gltfOriginalMaterial
				}
			})
			return true
		}

		if (typeof matKey === 'string') {
			const matCfg = _getMatCfg(viewerId)
			if (!matCfg) return false
			const mat = matCfg.getMaterialByKey(matKey)
			if (!mat) return false

			if (mat.isWireframe) {
				part.traverse((mesh) => {
					if (mesh.isMesh) matCfg.applyWireframeToMesh(mesh, mat)
				})
				return true
			}

			if (!mat.isMaterial) return false
			part.traverse((c) => { if (c.isMesh) c.material = mat })
			return true
		}

		part.traverse((c) => { if (c.isMesh) c.material = matKey })
		return true
	},

	/**
	 * 按 name 设置部件显隐。
	 * @param {string} name
	 * @param {boolean} visible
	 * @param {string} [viewerId]
	 * @returns {boolean}
	 */
	setPartVisible(name, visible, viewerId) {
		this.clearHighlight(viewerId)
		const info = this.findPartByName(name, viewerId)
		if (!info) return false
		info.object.visible = visible
		return true
	},

	/**
	 * 按 name 高亮部件（半透明 + 轮廓线）并飞行聚焦。
	 * @param {string} name
	 * @param {string} [viewerId]
	 * @returns {Object|false}
	 */
	highlightPart(name, viewerId) {
		const c = getViewer(viewerId)
		const loader = c?.getGltfModelLoader()
		const info = this.findPartByName(name, viewerId)
		if (!info || !loader) return false
		loader.highlight(info.object)
		loader.flyToObject(info.object)
		console.log(`已高亮部件 "${name}"`, info)
		return info
	},

	/** 清除当前高亮 */
	clearHighlight(viewerId) {
		getViewer(viewerId)?.clearGltfHighlight()
	},


	// TODO ========== 标注管理 ==========

	/** 
	 * 添加 HTML 标注（位置，元素）。
	 * @param {THREE.Vector3} position
	 * @param {HTMLElement} element
	 * @param {Object} [vueApp]
	 * @param {string} [viewerId]
	 */
	addAnnotation(position, element, vueApp, viewerId) {
		getViewer(viewerId)?.addAnnotation(position, element, vueApp)
	},

	/** 清除所有标注 */
	clearAnnotations(viewerId) {
		getViewer(viewerId)?.clearAnnotations()
	},



	// TODO ========== 图层控制 ==========

	/** 控制环境贴图是否启用 */
	controlEnvEnabled(enabled, viewerId) {
		getViewer(viewerId)?.environment.controlEnvMapEnabled(enabled)
	},

	/** 显示/隐藏灯光方向辅助线 */
	toggleLightHelper(show, viewerId) {
		getViewer(viewerId)?.environment.toggleLightHelper(show)
	},

	/**
	 * 刷新场景阴影设置（模型加载后调用）。
	 * @param {string} [viewerId]
	 */
	refreshSceneShadows(viewerId) {
		const env = getViewer(viewerId)?.environment
		if (!env?.dirLight) return
		const shadowEnabled = env.config?.dirLight?.shadow?.enabled ?? true
		env._setMeshShadows(shadowEnabled)
		env._autoFitShadowCamera()
	},

	/**
	 * 根据来源 ID 设置模型显隐。
	 * @param {string} id
	 * @param {boolean} visible
	 * @param {'3dtiles'|'glb'|'gltf'} [type]
	 * @param {string} [viewerId]
	 * @returns {boolean}
	 */
	setModelVisible(id, visible, type, viewerId) {
		return getViewer(viewerId)?.setModelVisible(id, visible, type) ?? false
	},

	/**
	 * 按类型批量设置所有模型的显隐。
	 * @param {'3dtiles'|'glb'|'gltf'} type
	 * @param {boolean} visible
	 * @param {string} [viewerId]
	 */
	setModelVisibleByType(type, visible, viewerId) {
		const c = getViewer(viewerId)
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
	 * 设置所有地形瓦片的透明度。
	 * @param {number} opacity - 0~1
	 * @param {string} [viewerId]
	 */
	setTilesOpacity(opacity, viewerId) {
		getViewer(viewerId)?.setTilesOpacity(opacity)
	},

	/**
	 * 根据来源 ID 移除模型。
	 * @param {string} id
	 * @param {'3dtiles'|'glb'|'gltf'} [type]
	 * @param {string} [viewerId]
	 * @returns {boolean}
	 */
	removeModel(id, type, viewerId) {
		return getViewer(viewerId)?.removeModel(id, type) ?? false
	},

	/** 获取当前双透视模式状态 */
	getDualPass(viewerId) {
		return getViewer(viewerId)?.getDualPass() ?? false
	},

	/** 切换双相机透视渲染模式 */
	setDualPass(enabled, viewerId) {
		getViewer(viewerId)?.setDualPass(enabled)
	},

	/**
	 * 切换标签图层的显隐。
	 * @param {string} type
	 * @param {boolean} visible
	 * @param {string} [viewerId]
	 */
	setLabelVisible(type, visible, viewerId) {
		getViewer(viewerId)?.getLabelRenderer()?.setGroupVisible(type, visible)
	},

	/**
	 * 根据来源 ID 飞行定位到指定模型。
	 * @param {string} id
	 * @param {number} [duration=3000]
	 * @param {'3dtiles'|'glb'|'gltf'} [type]
	 * @param {string} [viewerId]
	 * @returns {boolean}
	 */
	flyToModel(id, duration = 3000, type, viewerId) {
		return getViewer(viewerId)?.flyToModel(id, duration, type) ?? false
	},

	/**
	 * 动态更新所有 GLB 模型的场景偏移配置（无需重新加载模型）。
	 * @param {Object} newGeoInfo
	 * @param {string} [viewerId]
	 * @returns {Promise<boolean>}
	 */
	async setGltfGeoOrigin(newGeoInfo, viewerId) {
		// 关闭全局描边，避免影响模型偏移效果
		this.setGlobalOutline(false, viewerId)
		return getViewer(viewerId)?.setGltfGeoOrigin(newGeoInfo) ?? false
	},

	/**
	 * 根据标签 ID 飞行定位到对应 3D 标签。
	 * @param {number|string} id
	 * @param {number} [duration=3000]
	 * @param {string} [viewerId]
	 */
	flyToLabel(id, duration = 3000, viewerId) {
		const c = getViewer(viewerId)
		const loader = c?.getLabelRenderer()
		if (!loader || !c) return
		const target = loader.flyToLabel(id)
		if (target) {
			c.cameraManager.flyTo(target.center, target.distance / 12, duration)
		}
	},

	// ========== 全局描边 ==========

	/**
	 * 开启或关闭全局描边（EdgesGeometry 边线覆盖层）。
	 * 仅对 GLB/GLTF 模型生效，不影响 3D Tiles 地形。
	 * @param {boolean} enabled - 是否开启
	 * @param {string} [viewerId] - 查看器 ID，省略时操作第一个实例
	 */
	setGlobalOutline(enabled, viewerId) {
		getViewer(viewerId)?.setGlobalOutline(enabled)
	},

	// ========== 生命周期 ==========

	/**
	 * 释放指定查看器的 bimControls 内部缓存 GPU 资源。
	 * @param {string} [viewerId] - 省略时释放所有
	 */
	dispose(viewerId) {
		if (viewerId !== undefined) {
			const matCfg = _matCfgCache.get(viewerId)
			if (matCfg) {
				matCfg.clearCache()
				_matCfgCache.delete(viewerId)
			}
			_materialConfigCache.delete(viewerId)
		} else {
			for (const [, matCfg] of _matCfgCache) matCfg.clearCache()
			_matCfgCache.clear()
			_materialConfigCache.clear()
		}
	},
}

export { bimControls }

<template>
	<div class="viewer-panel">
		<div :id="viewerId" class="threejs-viewer-canvas"></div>
		<!-- 加载遮罩 -->
		<div v-if="loading" class="viewer-loading-overlay">
			<div class="viewer-loading-spinner"></div>
			<div class="viewer-loading-text">{{ loadingText }}</div>
		</div>
	</div>
</template>

<script>
import { defineComponent, markRaw } from 'vue'
import { BimViewerController } from '../../core/viewer/BimViewerController'
import { bimControls } from '../../exports/bimControls'
import { registerViewer, unregisterViewer } from '../../exports/internal/viewerRegistry'
export default defineComponent({
	name: 'InsBimPlusViewer',
	emits: ['ready', 'gltf-pick', 'label-click', 'model-loaded', 'error'],
	props: {
		viewerId: { type: String, default: 'ins-bim-plus-viewer' },
	},
	data() {
		return {
			controller: null,
			loading: false,
			loadingText: '',
		}
	},
	async mounted() {
		await this.bootstrap()
	},
	beforeUnmount() {
		this._destroy()
	},
	methods: {
		/** 初始化 Three.js 场景（仅挂载 DOM + 启动渲染循环），完成后 emit ready */
		async bootstrap() {
			const viewerRoot = document.getElementById(this.viewerId)
			if (!viewerRoot) return

			this.loading = true
			this.loadingText = '正在初始化场景…'

			this.controller = markRaw(
				new BimViewerController({
					onGltfPick: (info) => {
						console.log('Gltf 模型点击事件', info)
						if (!info) this.clearAnnotations()
						this.$emit('gltf-pick', info)
					},
					onLabelClick: (info) => {
						console.log('3D 标签点击事件', info)
						this.clearAnnotations()
						this.$emit('label-click', info)
						this.flyToLabel(info.id)
					},
				}),
			)
			// 仅挂载 DOM + 启动渲染循环，不加载任何环境配置
			await this.controller.mount(viewerRoot)

			// 注册到全局注册中心，供 bimControls 外部 API 使用
			registerViewer(this.viewerId, this.controller)

			this.loading = false
			this.$emit('ready', this.controller)
		},



		// ==================================== 数据加载（外部通过 ref 调用） =================================

		/**
		 * 加载 3D Tiles 地形。
		 * @param {Array<{id: string, url: string, name?: string, visible?: boolean}>} sources
		 */
		loadTilesets(sources) {
			return bimControls.loadTilesets(sources, this.viewerId)
		},

		/**
		 * 依次加载 GLTF 模型。
		 * 若之前调用过 applyMaterialConfig，会自动将材质配置应用到新加载的模型。
		 * @param {Array<{id: string, url: string, name?: string, visible?: boolean}>} sources
		 * @param {Object} [geoOrigin] - 地理配准原点（对应 sceneConfig.geoOrigin）
		 */
		loadGltfModels(sources, geoOrigin) {
			const vid = this.viewerId
			return bimControls.loadGltfModels(sources, geoOrigin, vid, {
				onModelLoaded: (id, url, model) => {
					bimControls.refreshSceneShadows(vid)
					this.$emit('model-loaded', { id, url })
				},
				onError: (error, id, url) => {
					this.$emit('error', { type: 'gltf', error, id, url })
				},
			}, vid)
		},

		// ========== 配置管理（整体替换） ==========

		/**
		 * 应用环境配置（天空/HDR/光照/曝光）。
		 * @param {Object} config - 配置对象
		 */
		async applyEnvConfig(config) {
			await bimControls.applyEnvConfig(config, this.viewerId)
		},

		/**
		 * 应用材质映射配置，并重新应用到所有已加载 GLB 模型。
		 * 后续调用 loadGltfModels 时也会自动应用此配置。
		 * @param {Array} config - 配置数组
		 */
		applyMaterialConfig(config) {
			bimControls.applyMaterialConfig(config, this.viewerId)
		},

		/**
		 * 设置相机位置和观察目标。
		 * @param {{ position?: {x,y,z}, target?: {x,y,z} }} cfg
		 */
		applyCameraConfig(cfg) {
			bimControls.applyCameraConfig(cfg, this.viewerId)
		},

		/**
		 * 获取当前相机位置和观察目标。
		 * 返回格式与 camera 配置一致，可直接用于 applyCameraConfig。
		 * @returns {{ position: {x,y,z}, target: {x,y,z} } | null}
		 */
		getCameraInfo() {
			return bimControls.getCameraInfo(this.viewerId)
		},

		/**
		 * 回归视角。
		 * 传入 cameraConfig 时平滑飞行到指定位置，否则自动聚焦到已加载场景的包围盒中心。
		 * @param {Object} [cameraConfig] - 相机配置（可选）
		 * @param {{ x?: number, y?: number, z?: number }} [cameraConfig.position] - 相机位置
		 * @param {{ x?: number, y?: number, z?: number }} [cameraConfig.target] - 观察目标点
		 * @param {number} [duration=3000] - 飞行动画时长（毫秒）
		 */
		resetCamera(cameraConfig, duration = 3000) {
			bimControls.resetCamera(cameraConfig, duration, this.viewerId)
		},

		// ========== 运行时细粒度调参 ==========

		/**
		 * 修改单个环境参数并立即生效。
		 * key 支持点分路径，如 'envLight.exposure'、'dirLight.intensity'。
		 * @param {string} key
		 * @param {*} value
		 */
		setEnvParam(key, value) {
			bimControls.setEnvParam(key, value, this.viewerId)
		},

		/**
		 * 返回当前环境配置对象（只读快照）。
		 * @returns {Object|null}
		 */
		getEnvConfig() {
			return bimControls.getEnvConfig(this.viewerId)
		},

		// ========== 加载遮罩 ==========

		/** 显示加载遮罩 */
		showLoading(text = '加载中…') {
			this.loadingText = text
			this.loading = true
		},

		/** 隐藏加载遮罩 */
		hideLoading() {
			this.loading = false
		},

		/**
		 * 通过来源 ID 获取模型结构树。
		 * @param {string} id - 模型来源 ID（对应 gltfSources[].id）
		 * @returns {Object|null} 树结构数据
		 */
		getModelTreeById(id) {
			const modelTree = bimControls.getModelTreeById(id, this.viewerId)
			console.log('已获取模型树:', modelTree)
			return modelTree
		},

		/**
		 * 按名称查找部件，返回结构化信息（与 gltf-pick 事件 info 格式一致）。
		 * @param {string} name - 部件名称
		 * @returns {Object|null} { object, name, path, worldPosition, localPosition, screenPosition, model }
		 */
		findPartByName(name) {
			return bimControls.findPartByName(name, this.viewerId)
		},

		/**
		 * 按 name 修改部件材质。
		 * @param {string} name - mesh name
		 * @param {string|THREE.Material} matKey - 材质库 ID（如 'm5'）或 THREE.Material 实例
		 * @returns {boolean}
		 */
		setPartMaterial(name, matKey) {
			return bimControls.setPartMaterial(name, matKey, this.viewerId)
		},

		/**
		 * 按 name 设置部件显隐。
		 * @param {string} name - 部件名称
		 * @param {boolean} visible - 是否可见
		 * @returns {boolean}
		 */
		setPartVisible(name, visible) {
			return bimControls.setPartVisible(name, visible, this.viewerId)
		},

		/**
		 * 按 name 高亮部件（半透明 + 轮廓线）并飞行聚焦。
		 * @param {string} name - 部件名称
		 * @param {Object} [options={}] - 高亮配置选项
		 * @param {number|string} [options.color=0xadff2f] - 轮廓线/线框颜色
		 * @param {boolean} [options.edgeHighlight=false] - 是否使用 EdgesGeometry 线框边缘高亮
		 * @returns {Object|false}
		 */
		highlightPart(name, options = {}) {
			return bimControls.highlightPart(name, this.viewerId)
		},

		/** 清除当前高亮 */
		clearHighlight() {
			bimControls.clearHighlight(this.viewerId)
		},

		/** 添加html标注（位置，元素）
		 * @param {THREE.Vector3} position - 世界坐标
		 * @param {HTMLElement} element - DOM 元素
		 * @param {Object} [vueApp] - 关联的 Vue app 实例，清理时自动 unmount
		 */
		addAnnotation(position, element, vueApp) {
			bimControls.addAnnotation(position, element, vueApp, this.viewerId)
		},

		/** 清除所有标注 */
		clearAnnotations() {
			bimControls.clearAnnotations(this.viewerId)
		},


		/**
		 * 根据来源 ID 移除模型。
		 * @param {string} id - 数据源 ID
		 * @param {'3dtiles'|'glb'|'gltf'} [type] - 模型类型；省略时同时尝试移除 3DTiles 和 GLB
		 * @returns {boolean} 是否成功移除
		 */
		removeModel(id, type) {
			return bimControls.removeModel(id, type, this.viewerId)
		},

		/** 控制环境贴图是否启用 */
		controlEnvEnabled(enabled) {
						bimControls.controlEnvEnabled(enabled, this.viewerId)
		},

		/**
		 * 根据来源 ID 设置模型显隐。
		 * @param {string} id - 数据源 ID
		 * @param {boolean} visible - 是否可见
		 * @param {'3dtiles'|'glb'|'gltf'} [type] - 模型类型；省略时同时在两端查找
		 * @returns {boolean}
		 */
		setModelVisible(id, visible, type) {
			return bimControls.setModelVisible(id, visible, type, this.viewerId)
		},

		/**
		 * 按类型批量设置所有模型的显隐。
		 * @param {'3dtiles'|'glb'|'gltf'} type - 模型类型
		 * @param {boolean} visible - 是否可见
		 */
		setModelVisibleByType(type, visible) {
			bimControls.setModelVisibleByType(type, visible, this.viewerId)
		},

		/**
		 * 设置所有地形瓦片的透明度。
		 * @param {number} opacity - 0~1
		 */
		setTilesOpacity(opacity) {
			bimControls.setTilesOpacity(opacity, this.viewerId)
		},

		/** 切换双相机透视渲染模式 */
		setDualPass(enabled) {
			bimControls.setDualPass(enabled, this.viewerId)
		},

		/**
		 * 开启或关闭全局描边（EdgesGeometry 边线覆盖层）。
		 * @param {boolean} enabled - 是否开启
		 */
		setGlobalOutline(enabled) {
			bimControls.setGlobalOutline(enabled, this.viewerId)
		},

		/**
		 * 根据来源 ID 飞行定位到指定模型。
		 * @param {string} id - 数据源 ID
		 * @param {number} [duration=3000] - 飞行动画时长（毫秒）
		 * @param {'3dtiles'|'glb'|'gltf'} [type] - 模型类型；省略时同时在两端查找
		 * @returns {boolean}
		 */
		flyToModel(id, duration = 3000, type) {
			return bimControls.flyToModel(id, duration, type, this.viewerId)
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
			return bimControls.setGltfGeoOrigin(newGeoInfo, this.viewerId)
		},

		/**
		 * 加载并渲染 3D 标签，完成后自动飞行到标签位置。
		 * 图标路径由配置对象的 list[].icon 字段指定。
		 * @param {Object} config - 标签配置对象（含 type、list 字段）
		 */
		async renderLabels(config) {
			await bimControls.renderLabels(config, this.viewerId)
		},

		/**
		 * 切换标签图层的显隐。
		 * @param {string} type - 图层组 ID（对应配置中的 type 字段）
		 * @param {boolean} visible
		 */
		setLabelVisible(type, visible) {
			bimControls.setLabelVisible(type, visible, this.viewerId)
		},

		/**
		 * 根据标签 ID 飞行定位到对应 3D 标签。
		 * @param {number|string} id - 标签 ID
		 * @param {number} [duration=3000] - 飞行动画时长（毫秒）
		 */
		flyToLabel(id, duration = 3000) {
			bimControls.flyToLabel(id, duration, this.viewerId)
		},


		// ========== 生命周期 ==========

		/**
		 * 销毁查看器，释放所有 GPU 资源与 DOM 监听。
		 * 组件卸载时会自动调用，也可通过 ref 手动调用提前销毁。
		 */
		_destroy() {
			unregisterViewer(this.viewerId)
			this.controller?.destroy()
			this.controller = null
			bimControls.dispose(this.viewerId)
			this.loading = false
			this.loadingText = ''
		},
	},
})
</script>

<style>
.viewer-panel {
	position: relative;
}

.viewer-panel,
.viewer-panel .threejs-viewer-canvas {
	width: 100%;
	height: 100%;
	margin: 0;
	padding: 0;
	overflow: hidden;
}

/* 加载遮罩 */
.viewer-loading-overlay {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: rgba(10, 14, 26, 0.75);
	z-index: 100;
	pointer-events: none;
}

.viewer-loading-spinner {
	width: 36px;
	height: 36px;
	border: 3px solid rgba(255, 255, 255, 0.15);
	border-top-color: rgba(32, 160, 255, 0.9);
	border-radius: 50%;
	animation: viewer-spin 0.8s linear infinite;
}

@keyframes viewer-spin {
	to {
		transform: rotate(360deg);
	}
}

.viewer-loading-text {
	margin-top: 12px;
	color: rgba(255, 255, 255, 0.7);
	font-size: 13px;
}
</style>

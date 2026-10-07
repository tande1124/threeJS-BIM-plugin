/**
 * 查看器实例注册中心
 *
 * 外部 API（bimControls）通过该模块获取 BimViewerController 实例，
 * InsBimPlusViewer 在场景就绪后调用 registerViewer，在组件销毁时调用 unregisterViewer。
 */

/** @type {import('../../core/viewer/BimViewerController').BimViewerController|null} */
let controller = null

/**
 * 注册查看器实例（InsBimPlusViewer 初始化完成后调用）
 * @param {import('../../core/viewer/BimViewerController').BimViewerController} instance
 */
export function registerViewer(instance) {
  controller = instance
}

/**
 * 注销查看器实例（InsBimPlusViewer 销毁时调用）
 */
export function unregisterViewer() {
  controller = null
}

/**
 * 获取当前查看器实例
 * @returns {import('../../core/viewer/BimViewerController').BimViewerController|null}
 */
export function getViewer() {
  return controller
}

/**
 * 查看器实例注册中心（多实例）
 *
 * 外部 API（bimControls）通过该模块获取 BimViewerController 实例，
 * InsBimPlusViewer 在场景就绪后调用 registerViewer，在组件销毁时调用 unregisterViewer。
 */

/** @type {Map<string, import('../../core/viewer/BimViewerController').BimViewerController>} */
const viewers = new Map()

/** 记录第一个注册的 ID，getViewer() 省略 id 时返回该实例（主场景优先） */
let _primaryId = null

/**
 * 注册查看器实例（InsBimPlusViewer 初始化完成后调用）
 * @param {string} id - 查看器唯一标识
 * @param {import('../../core/viewer/BimViewerController').BimViewerController} instance
 */
export function registerViewer(id, instance) {
  viewers.set(id, instance)
  if (_primaryId === null) _primaryId = id
}

/**
 * 注销查看器实例（InsBimPlusViewer 销毁时调用）
 * @param {string} id - 查看器唯一标识
 */
export function unregisterViewer(id) {
  viewers.delete(id)
  if (_primaryId === id) {
    _primaryId = viewers.size ? [...viewers.keys()][0] : null
  }
}

/**
 * 获取查看器实例
 * @param {string} [id] - 查看器 ID；省略时返回第一个注册的实例
 * @returns {import('../../core/viewer/BimViewerController').BimViewerController|null}
 */
export function getViewer(id) {
  if (id !== undefined) return viewers.get(id) ?? null
  return _primaryId ? viewers.get(_primaryId) ?? null : null
}

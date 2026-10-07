import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/** 相机最远缩小倍数（相对初始聚焦距离） */
const ZOOM_LIMITS = {
  maxDistanceFactor: 1,
}

// ========== 相机管理器 ==========

/**
 * 场景相机统一管理器。
 *
 * 管理主透视相机、OrbitControls、相机聚焦（fitToBox）、平滑飞行（flyTo）、
 * 自动聚焦防抖（scheduleFit）及视口自适应（resize）。
 *
 * 用法：
 * ```js
 * const cam = new CameraManager(domElement, {
 *   onGrounding: () => pointMarkerRenderer.refreshGrounding(),
 * })
 * scene.add(cam.camera)
 * cam.resize(width, height)
 * cam.fitToBox(sceneBounds)
 * ```
 */
export class CameraManager {
  /** 主透视相机 */
  camera
  /** 轨道控制器 */
  controls

  /** 用户手动操作后禁止后续自动聚焦覆盖视角 */
  hasSettledView = false
  fitTimerId = 0

  flyAnimation = {
    active: false,
    startTime: 0,
    duration: 0,
    fromPosition: new THREE.Vector3(),
    toPosition: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
  }

  /**
   * @param {HTMLElement} domElement
   */
  constructor(domElement) {

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 1e7)
    this.camera.position.set(0, 3000, 4000)

    this.controls = new OrbitControls(this.camera, domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 1
    this.controls.maxDistance = 50000
    this.controls.target.set(0, 0, 0)

    // 限制俯仰角，防止相机转到地形下方看到穿透天空
    // this.controls.minPolarAngle = 0              // 正上方俯视
    // this.controls.maxPolarAngle = Math.PI * 0.5  // 略低于水平线，禁止从下方仰视

    // 用户手动操作后禁止后续自动聚焦覆盖视角
    this.controls.addEventListener('start', () => {
      this.hasSettledView = true
    })
  }

  // ========== 视口自适应 ==========

  /**
   * 同步相机宽高比与投影矩阵。
   * 控制器调用时传入容器尺寸，同时处理内相机与渲染目标的同步。
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  // ========== 聚焦 ==========

  /**
   * 根据包围盒调整相机位置、裁剪面和 OrbitControls 范围。
   * 返回 true 表示成功聚焦（包围盒非空）。
   * @param {THREE.Box3} box
   * @returns {boolean}
   */
  fitToBox(box) {
    if (box.isEmpty()) return false

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z)
    const safeDimension = maxDimension > 0 ? maxDimension : 10

    const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5)
    const distance = safeDimension / (2 * Math.tan(halfFov))
    const fitDistance = distance * 1.65

    const offset = new THREE.Vector3(1.2, 0.9, 1.4).normalize().multiplyScalar(fitDistance)

    this.camera.position.copy(center).add(offset)
    this.camera.near = Math.max(safeDimension / 500, 0.1)
    this.camera.far = Math.max(safeDimension * 50, 5000)
    this.camera.updateProjectionMatrix()

    this.controls.minDistance = Math.max(safeDimension / 200, 1)
    this.controls.maxDistance = Math.max(fitDistance * ZOOM_LIMITS.maxDistanceFactor, safeDimension)
    this.controls.target.copy(center)
    this.controls.update()

    return true
  }

  /**
   * 平滑飞行到指定包围盒位置（带动画）。
   * 与 fitToBox 计算逻辑一致，但使用 flyTo 动画平滑过渡。
   *
   * @param {THREE.Box3} box - 目标包围盒（世界坐标）
   * @param {number} [duration=1500] - 飞行动画时长（ms）
   * @returns {boolean}
   */
  flyToBox(box, duration = 1500) {
    if (box.isEmpty()) return false

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z)
    const safeDimension = maxDimension > 0 ? maxDimension : 10

    const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5)
    const distance = safeDimension / (2 * Math.tan(halfFov))
    const fitDistance = distance * 1.65

    // 更新裁剪面和控制器限制（与 fitToBox 一致）
    this.camera.near = Math.max(safeDimension / 500, 0.1)
    this.camera.far = Math.max(safeDimension * 50, 5000)
    this.camera.updateProjectionMatrix()
    this.controls.minDistance = Math.max(safeDimension / 200, 1)
    this.controls.maxDistance = Math.max(fitDistance * ZOOM_LIMITS.maxDistanceFactor, safeDimension)

    // 计算目标相机位置（正上方视角，降低高度）
    const offset = new THREE.Vector3(0, 1, 0).multiplyScalar(fitDistance * 0.5)
    const targetPosition = center.clone().add(offset)

    // 使用飞行动画
    this.hasSettledView = true
    const anim = this.flyAnimation
    anim.active = true
    anim.startTime = performance.now()
    anim.duration = duration
    anim.fromPosition.copy(this.camera.position)
    anim.toPosition.copy(targetPosition)
    anim.fromTarget.copy(this.controls.target)
    anim.toTarget.copy(center)

    return true
  }

  /**
   * 延迟触发相机自动聚焦（防抖 160ms）。
   * 用于 GLTF 加载等后续场景变更后自动重新聚焦。
   *
   * @param {Function} computeBox - 返回当前场景合并包围盒的回调（控制器提供地形 + GLB 合并逻辑）
   */
  scheduleFit(computeBox) {
    if (this.hasSettledView) return

    window.clearTimeout(this.fitTimerId)
    this.fitTimerId = window.setTimeout(() => {
      if (this.hasSettledView) return

      const box = computeBox()
      if (!box.isEmpty()) {
        this.fitToBox(box)
      }
    }, 160)
  }

  // ========== 飞行 ==========

  /**
   * 平滑飞行到指定位置和目标点（带动画）。
   *
   * @param {THREE.Vector3} position - 目标相机位置
   * @param {THREE.Vector3} target - 目标观察点
   * @param {number} [duration=1500] - 飞行动画时长（ms）
   */
  flyToPosition(position, target, duration = 1500) {
    this.hasSettledView = true
    const anim = this.flyAnimation
    anim.active = true
    anim.startTime = performance.now()
    anim.duration = duration
    anim.fromPosition.copy(this.camera.position)
    anim.toPosition.copy(position)
    anim.fromTarget.copy(this.controls.target)
    anim.toTarget.copy(target)
  }

  /**
   * 平滑飞行到目标点，保持当前观察角度。
   *
   * @param {THREE.Vector3} target - 目标世界坐标
   * @param {number} [markerScale=10] - 点位标记缩放因子（决定飞行距离偏移）
   * @param {number} [duration=900] - 飞行动画时长（ms）
   */
  flyTo(target, markerScale = 10, duration = 900) {
    this.hasSettledView = true

    const distance = Math.max(markerScale * 12, 120)
    const direction = new THREE.Vector3()
    this.camera.getWorldDirection(direction)

    const anim = this.flyAnimation
    anim.active = true
    anim.startTime = performance.now()
    anim.duration = duration
    anim.fromPosition.copy(this.camera.position)
    anim.toPosition.copy(target).addScaledVector(direction, -distance)
    anim.fromTarget.copy(this.controls.target)
    anim.toTarget.copy(target)
  }

  /**
   * 每帧推进飞行动画（easeInOutCubic）。
   * 在渲染循环中调用；未激活时直接返回。
   * @returns {boolean} true 表示飞行动画仍在进行中
   */
  tickFlyAnimation() {
    const anim = this.flyAnimation
    if (!anim.active) return false

    const elapsed = performance.now() - anim.startTime
    const t = Math.min(elapsed / anim.duration, 1)
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    this.camera.position.lerpVectors(anim.fromPosition, anim.toPosition, eased)
    this.controls.target.lerpVectors(anim.fromTarget, anim.toTarget, eased)
    this.camera.lookAt(this.controls.target)

    if (t >= 1) {
      anim.active = false
      this.camera.position.copy(anim.toPosition)
      this.controls.target.copy(anim.toTarget)
      this.controls.update()
    }

    return true
  }

  /** 飞行动画是否正在进行 */
  isFlying() {
    return this.flyAnimation.active
  }

  // ========== 状态查询 ==========

  /** 用户是否已手动操作过视角（手动操作后自动聚焦不再覆盖） */
  isViewSettled() {
    return this.hasSettledView
  }

  /** 重置 settled 状态（允许后续自动聚焦，如 GLTF 加载后） */
  markUnsettled() {
    this.hasSettledView = false
  }

  // ========== 生命周期 ==========

  /** 释放定时器与控制器资源 */
  dispose() {
    window.clearTimeout(this.fitTimerId)
    this.controls.dispose()
  }
}

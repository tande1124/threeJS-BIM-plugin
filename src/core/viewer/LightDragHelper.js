import * as THREE from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'

const _raycaster = new THREE.Raycaster()
const _pointer = new THREE.Vector2()
const _UP_Y = new THREE.Vector3(0, 1, 0)
const _tmpDir = new THREE.Vector3()

/**
 * 灯光方向可拖拽控制器（使用 TransformControls）。
 *
 * - 场景中显示光源→目标点的连线和箭头
 * - 点击端点球体后挂接 TransformControls 三轴坐标系
 * - 拖拽时自动禁用 OrbitControls，完成后同步灯光位置
 */
export default class LightDragHelper {
  /** @type {THREE.Group} */
  group = null
  /** @type {THREE.Mesh} */  posMarker = null
  /** @type {THREE.Mesh} */  targetMarker = null
  /** @type {THREE.Line} */  line = null
  /** @type {THREE.Mesh} */  arrow = null
  /** @type {TransformControls} */
  transformControls = null
  isDragging = false

  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {THREE.WebGLRenderer} renderer
   * @param {Object} orbitControls - OrbitControls 实例
   * @param {(lightPos: THREE.Vector3, targetPos: THREE.Vector3) => void} onChange
   */
  constructor(scene, camera, renderer, orbitControls, onChange) {
    this._scene = scene
    this._camera = camera
    this._orbitControls = orbitControls
    this._domElement = renderer.domElement
    this.onChange = onChange

    // ---- 可视化组 ----
    this.group = new THREE.Group()
    this.group.name = '灯光方向控制线'

    // 光源标记（橙色）
    this.posMarker = this._createMarker(0xff8822, '光源标记')
    this.posMarker.userData.isControlHandle = true
    this.posMarker.castShadow = false
    this.posMarker.receiveShadow = false
    this.group.add(this.posMarker)

    // 目标点标记（蓝色）
    this.targetMarker = this._createMarker(0x44aaff, '目标点标记')
    this.targetMarker.userData.isControlHandle = true
    this.targetMarker.castShadow = false
    this.targetMarker.receiveShadow = false
    this.group.add(this.targetMarker)

    // 连线（预分配几何体，拖拽时只更新顶点位置避免每帧 GC）
    this._linePositions = new Float32Array(6)
    const lineGeom = new THREE.BufferGeometry()
    lineGeom.setAttribute('position', new THREE.BufferAttribute(this._linePositions, 3))
    this.line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
      color: 0xffaa44, transparent: true, opacity: 0.8, depthTest: false,
    }))
    this.line.renderOrder = 9
    this.group.add(this.line)

    // 箭头锥体（+Y 朝向，后续旋转对齐方向）
    this.arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1, 14),
      new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.95, depthTest: false }),
    )
    this.arrow.renderOrder = 9
    this.arrow.userData.isControlHandle = true
    this.arrow.castShadow = false
    this.arrow.receiveShadow = false
    this.group.add(this.arrow)

    scene.add(this.group)

    // ---- TransformControls 三轴坐标系 ----
    this.transformControls = new TransformControls(camera, renderer.domElement)
    this.transformControls.setSize(1.5)
    this.transformControls.setSpace('world')
    this.transformControls.setMode('translate')
    // 新版 Three.js 需要用 getHelper() 添加可视化部分到场景
    scene.add(this.transformControls.getHelper ? this.transformControls.getHelper() : this.transformControls)
    this.transformControls.visible = false
    // 标记 TransformControls 所有内部 mesh，避免被 _getModelBounds 算进包围盒
    const helper = this.transformControls.getHelper ? this.transformControls.getHelper() : this.transformControls
    helper.traverse((obj) => {
      if (obj.isMesh || obj.isLine) {
        obj.userData.isControlHandle = true
        obj.castShadow = false
        obj.receiveShadow = false
      }
    })

    // 拖拽状态联动
    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.isDragging = e.value
      if (this._orbitControls) this._orbitControls.enabled = !e.value
      // 拖拽结束时同步灯光
      if (!e.value && this.onChange) {
        this.onChange(this.posMarker.position.clone(), this.targetMarker.position.clone())
      }
    })

    // 拖拽过程中实时更新灯光和连线
    this.transformControls.addEventListener('change', () => {
      if (this.onChange) {
        this.onChange(this.posMarker.position.clone(), this.targetMarker.position.clone())
      }
      this._updateVisuals(this.posMarker.position, this.targetMarker.position)
    })

    // 点击球体 → 挂接 TransformControls
    this._boundPointerDown = this._onPointerDown.bind(this)
    this._domElement.addEventListener('pointerdown', this._boundPointerDown)
  }

  // ========== 公共方法 ==========

  /** 根据灯光位置和目标点更新所有可视化元素 */
  syncFromLight(light, target) {
    if (!light) return
    const targetPos = target ? target.position : new THREE.Vector3()
    this.posMarker.position.copy(light.position)
    this.targetMarker.position.copy(targetPos)
    this._updateVisuals(light.position, targetPos)
  }

  dispose() {
    this._domElement.removeEventListener('pointerdown', this._boundPointerDown)
    if (this.transformControls) {
      this.transformControls.detach()
      this._scene.remove(this.transformControls.getHelper ? this.transformControls.getHelper() : this.transformControls)
      this.transformControls.dispose()
    }
    if (this._scene && this.group) {
      this._scene.remove(this.group)
    }
    this.group?.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      }
    })
  }

  // ========== 内部方法 ==========

  _createMarker(color, name) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 20),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.92, depthTest: false,
      }),
    )
    mesh.name = name
    mesh.renderOrder = 11
    return mesh
  }

  _updateVisuals(lightPos, targetPos) {
    // 连线（复用预分配的 Float32Array，避免每帧 dispose + new）
    this._linePositions[0] = lightPos.x
    this._linePositions[1] = lightPos.y
    this._linePositions[2] = lightPos.z
    this._linePositions[3] = targetPos.x
    this._linePositions[4] = targetPos.y
    this._linePositions[5] = targetPos.z
    this.line.geometry.attributes.position.needsUpdate = true
    this.line.geometry.computeBoundingSphere()

    // 尺寸自适应：距离越远标记越大
    const len = Math.max(lightPos.distanceTo(targetPos), 1)
    const markerR = Math.max(len * 0.04, 8)
    this.posMarker.scale.setScalar(markerR)
    this.targetMarker.scale.setScalar(markerR)

    // 箭头锥体
    _tmpDir.subVectors(targetPos, lightPos).normalize()
    const arrowLen = Math.min(Math.max(len * 0.12, markerR * 2), len * 0.35)
    this.arrow.scale.set(markerR * 1.3, arrowLen, markerR * 1.3)
    this.arrow.position.copy(targetPos).addScaledVector(_tmpDir, -(markerR + arrowLen * 0.5))
    this.arrow.quaternion.setFromUnitVectors(_UP_Y, _tmpDir)
  }

  // ---- 点击交互 ----

  _onPointerDown(e) {
    if (this.isDragging || !this.group?.visible) return

    const rect = this._domElement.getBoundingClientRect()
    _pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    _raycaster.setFromCamera(_pointer, this._camera)
    const hits = _raycaster.intersectObjects([this.posMarker, this.targetMarker], false)

    if (hits.length > 0) {
      const target = hits[0].object
      this.transformControls.detach()
      this.transformControls.attach(target)
      this.transformControls.visible = true
      e.stopPropagation()
    }
  }
}

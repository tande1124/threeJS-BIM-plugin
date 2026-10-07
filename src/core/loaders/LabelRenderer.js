import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { disposeObject3D } from '../../utils/three-dispose'
import { lonLatHeightToEcef } from '../../utils/geo-coordinate'

// ========== 常量 ==========

const RING_SCALE = 0.8
const BOUNCE_AMPLITUDE = 0.15
const BOUNCE_SPEED = 2.5
const ROTATION_SPEED = 1.8
const RIPPLE_SPEED = 0.45

// ========== 自适应缩放 ==========

const ADAPTIVE_MIN_SCALE = 0.3   // 最小缩放倍率
const ADAPTIVE_MAX_SCALE = 5.0   // 最大缩放倍率
const ADAPTIVE_LERP = 0.08       // 平滑插值系数

// ========== 默认 opts ==========

const DEFAULT_OPTS = {
    color: '#88ddff',
    animation: 'bounce',       // bounce | rotate | both | none
    animEnabled: true,
    scale: 50,
    labelHeight: 0.3,
    ripple: true,
    phase: null,               // null = 随机
    rotation: 0,               // Y 轴旋转（度）
    showName: true,
    nameStyle: 'bubble',       // bubble | glow
    nameTagHeight: 1.3,
    nameTagSize: 0.65,
    nameTagRot: 0,
}

// ========== 辅助：底部圆环 ==========

function createRing(color = '#88ddff') {
    const group = new THREE.Group()
    const s = RING_SCALE

    const ringGeo = new THREE.RingGeometry(0.15 * s, 0.22 * s, 32)
    const ringMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.7,
        side: THREE.DoubleSide, depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.005
    ring.userData.baseOpacity = 0.7
    group.add(ring)

    const glowGeo = new THREE.RingGeometry(0.22 * s, 0.28 * s, 32)
    const glowMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.2,
        side: THREE.DoubleSide, depthWrite: false,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    glow.rotation.x = -Math.PI / 2
    glow.position.y = 0.003
    glow.userData.baseOpacity = 0.2
    group.add(glow)

    const dotGeo = new THREE.CircleGeometry(0.04 * s, 12)
    const dotMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, depthWrite: false,
    })
    const dot = new THREE.Mesh(dotGeo, dotMat)
    dot.rotation.x = -Math.PI / 2
    dot.position.y = 0.008
    dot.userData.baseOpacity = 0.5
    group.add(dot)

    group.userData.isRing = true
    return group
}

// ========== 辅助：涟漪 ==========

function createRipples(color = '#88ddff') {
    const group = new THREE.Group()
    const geo = new THREE.RingGeometry(0.88, 1.0, 48)

    for (let i = 0; i < 2; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0,
            side: THREE.DoubleSide, depthWrite: false,
        })
        const ripple = new THREE.Mesh(geo, mat)
        ripple.rotation.x = -Math.PI / 2
        ripple.position.y = 0.002 + i * 0.0015
        ripple.userData.ripplePhase = i * 0.5
        ripple.userData.baseScale = RING_SCALE
        group.add(ripple)
    }

    group.userData.isRipple = true
    return group
}

// ========== 辅助：名称牌（Canvas Sprite） ==========

const NAME_TAG_FONT = '600 44px "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
const NAME_TAG_PADDING = 26
const NAME_TAG_HEIGHT = 0.5

function measureText(text) {
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.font = NAME_TAG_FONT
    return Math.ceil(ctx.measureText(text).width)
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

/**
 * 创建名称牌 Sprite。
 * @param {string} text - 显示文字
 * @param {string} accent - 主题色
 * @param {string} style - 'bubble' 气泡牌 | 'glow' 光晕牌 | 'plaque' 名牌 | 'stacked' 立体字
 * @returns {THREE.Sprite}
 */
function createNameTag(text, accent = '#88ddff', style = 'plaque') {
    const textW = measureText(text)
    const bgW = textW + NAME_TAG_PADDING * 2
    const bgH = Math.ceil(44 * 1.7)
    const triH = style === 'bubble' ? Math.round(bgH * 0.24) : 0
    const dpr = Math.min(window.devicePixelRatio || 1, 3)

    const canvas = document.createElement('canvas')
    canvas.width = bgW * dpr
    canvas.height = (bgH + triH) * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.font = NAME_TAG_FONT
    ctx.textBaseline = 'middle'

    if (style === 'glow') {  // 银辉样式
        ctx.fillStyle = 'rgba(6, 6, 18, 0.78)'
        roundRect(ctx, 0, 0, bgW, bgH, bgH / 2)
        ctx.fill()
        ctx.shadowColor = accent
        ctx.shadowBlur = 14
        ctx.strokeStyle = accent
        ctx.lineWidth = 2.5
        roundRect(ctx, 0, 0, bgW, bgH, bgH / 2)
        ctx.stroke()
        ctx.fillStyle = accent
        ctx.fillText(text, NAME_TAG_PADDING, bgH / 2)
    } else if (style === 'plaque') {
        // 铭牌面板：深色渐变底 + 主题色内描边 + 白字（作为盒体正面贴图）
        const grad = ctx.createLinearGradient(0, 0, 0, bgH);
        grad.addColorStop(0, 'rgba(32, 36, 56, 0.98)');
        grad.addColorStop(1, 'rgba(12, 14, 26, 0.98)');
        ctx.fillStyle = grad;
        roundRect(ctx, 0, 0, bgW, bgH, 8);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        roundRect(ctx, 4, 4, bgW - 8, bgH - 8, 6);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, NAME_TAG_PADDING, bgH / 2);
    } else {
        // bubble: 胶囊底 + 左侧竖条 + 底部三角
        ctx.fillStyle = 'rgba(10, 10, 26, 0.72)'
        roundRect(ctx, 0, 0, bgW, bgH, bgH / 2)
        ctx.fill()
        ctx.fillStyle = accent
        roundRect(ctx, 10, bgH / 2 - 10, 4, 20, 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(bgW / 2 - 9, bgH - 1)
        ctx.lineTo(bgW / 2 + 9, bgH - 1)
        ctx.lineTo(bgW / 2, bgH + triH - 2)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.fillText(text, NAME_TAG_PADDING, bgH / 2)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4

    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
    )
    sprite.scale.set(NAME_TAG_HEIGHT * canvas.width / canvas.height, NAME_TAG_HEIGHT, 1)
    sprite.userData.isNameTag = true
    return sprite
}

// ========== LabelRenderer ==========

/**
 * 3D 标签渲染器。
 *
 * 加载 GLB 图标模板，根据配置在指定经纬度/高程处放置标签，
 * 包含底部圆环 + 涟漪动画 + 弹跳/旋转 + 名称牌。
 *
 * 标签按图层组（type）组织，支持按组显隐。
 * 每个标签可通过 opts 独立配置所有视觉参数。
 */
export class LabelRenderer {
    deps
    root = new THREE.Group()
    groups = new Map()

    /** GLB 图标模板缓存 Map<url, Object3D> */
    iconCache = new Map()
    /** 已加载的图标模板中的子节点 Map<nodeName, Object3D> */
    templates = new Map()

    labels = []
    loader = new GLTFLoader()
    prevTime = 0

    /** 自适应缩放：参考距离（首次 update 时捕获） */
    referenceDistance = 0
    /** 自适应缩放：当前缩放倍率（平滑后） */
    scaleMultiplier = 1
    /** 场景中心点（复用，避免每帧 new） */
    _sceneCenter = new THREE.Vector3()

    /** 射线拾取 */
    raycaster = new THREE.Raycaster()
    pickCamera = null
    pickDomElement = null
    pickPointerStart = new THREE.Vector2()

    constructor(deps) {
        this.deps = deps
        this.root.name = 'label-root'
        // 标签放在 Layer 2，主渲染不包含标签，最后独立渲染保证始终在最上层
        this.root.layers.set(2)
        // 射线拾取需要检测所有图层
        this.raycaster.layers.enableAll()
        deps.scene.add(this.root)
    }

    // ========== 图标加载 ==========

    /**
     * 加载单个 GLB 图标文件，提取标签模板节点并缓存。
     * 同一 URL 只加载一次。
     * @param {string} url - GLB 文件路径
     */
    async loadIcon(url) {
        if (this.iconCache.has(url)) return

        console.log('[LabelRenderer] 加载图标:', url)
        const gltf = await this.loader.loadAsync(url)
        const sceneRoot = gltf.scene
        this.iconCache.set(url, sceneRoot)

        // 提取命名标签节点
        sceneRoot.traverse((node) => {
            const name = node.name || ''
            const isLabel =
                name.includes('标签_') || name.includes('Label_') || name.includes('label_')
            if (isLabel && !this.templates.has(name)) {
                const cloned = node.clone(true)
                cloned.traverse((c) => {
                    if (c.isMesh) { c.castShadow = true; c.receiveShadow = true }
                })
                this.templates.set(name, cloned)
                console.log(`[LabelRenderer]   提取模板: "${name}"`)
            }
        })

        // 如果该文件没有命名节点，以 URL 最后一段为 key 存整个场景
        const hasNamed = [...this.templates.values()].some(
            (t) => this.findInScene(sceneRoot, t),
        )
        if (!hasNamed) {
            const key = url.split('/').pop().replace('.glb', '')
            sceneRoot.traverse((c) => {
                if (c.isMesh) { c.castShadow = true; c.receiveShadow = true }
            })
            this.templates.set(key, sceneRoot)
            console.log(`[LabelRenderer]   未找到命名节点，使用 "${key}" 作为模板`)
        }

        console.log(`[LabelRenderer]   模板总数: ${this.templates.size}`)
    }

    /** 检查 target 是否是 root 的子孙（辅助判断） */
    findInScene(root, target) {
        let found = false
        root.traverse((n) => { if (n === target) found = true })
        return found
    }

    /**
     * 获取第一个可用模板（兜底用）
     * @returns {string}
     */
    getFirstTemplateName() {
        return this.templates.keys().next().value
    }

    // ========== 配置加载与渲染 ==========

    /**
     * 根据配置对象渲染标签。
     * @param {Object} config - 配置对象（含 type、list 字段）
     */
    async renderFromConfig(config) {
        const type = config.type || 'label'
        const list = config.list || []

        await this.renderLabels(type, list)
    }

    /**
     * 根据标签列表渲染一组标签。
     * @param {string} type - 图层组 ID
     * @param {Array<Object>} list - 标签列表
     */
    async renderLabels(type, list) {
        if (!list || list.length === 0) return

        this.removeGroup(type)

        const group = new THREE.Group()
        group.name = type
        group.layers.set(2) // 图层不继承，必须显式设置
        this.root.add(group)
        this.groups.set(type, group)

        // 预加载所有 icon（去重）
        const iconUrls = [...new Set(list.map((item) => item.icon).filter(Boolean))]
        for (const url of iconUrls) {
            await this.loadIcon(url)
        }

        // 等待地形就绪
        await this.deps.whenTerrainReady?.()
        const ecefToScene = this.deps.getEcefToSceneTransform?.()
        if (!ecefToScene) {
            console.warn('[LabelRenderer] ECEF → 场景变换不可用，无法定位标签。')
            return
        }

        const fallbackTemplate = this.getFirstTemplateName()

        for (const item of list) {
            this.createLabel(item, ecefToScene, group, fallbackTemplate)
        }

        console.log(`[LabelRenderer] 图层组 "${type}" 已创建，共 ${this.labels.length} 个标签`)
    }

    // ========== 单个标签创建 ==========

    /**
     * @param {Object} item - list 中的一项
     * @param {THREE.Matrix4} ecefToScene
     * @param {THREE.Group} group
     * @param {string} fallbackTemplate - 兜底模板名
     */
    createLabel(item, ecefToScene, group, fallbackTemplate) {
        // ---- 合并 opts（item.opts 覆盖默认值） ----
        const opts = { ...DEFAULT_OPTS, ...item.opts }

        // ---- 确定图标模板 ----
        let templateName = fallbackTemplate
        if (opts.template && this.templates.has(opts.template)) {
            templateName = opts.template
        } else if (item.icon) {
            const fileKey = item.icon.split('/').pop().replace('.glb', '')
            if (this.templates.has(fileKey)) {
                templateName = fileKey
            }
        }

        const template = this.templates.get(templateName)
        if (!template) {
            console.warn(`[LabelRenderer] 模板 "${templateName}" 不存在，跳过标签 ${item.id}`)
            return
        }

        const color = opts.color
        const scale = opts.scale
        const labelHeight = opts.labelHeight
        const phase = opts.phase ?? Math.random() * Math.PI * 2

        // ---- 坐标转换 ----
        const ecef = lonLatHeightToEcef(item.longitude, item.latitude, item.altitude ?? 0)
        ecef.applyMatrix4(ecefToScene)

        // ---- 容器 ----
        const container = new THREE.Group()
        container.userData.labelId = item.id
        container.userData.labelData = { id: item.id, name: item.name, longitude: item.longitude, latitude: item.latitude, altitude: item.altitude }
        container.userData.baseScale = scale  // 基础缩放，用于自适应缩放计算
        container.position.copy(ecef)
        container.scale.set(scale, scale, scale)
        if (opts.rotation) {
            container.rotation.y = THREE.MathUtils.degToRad(opts.rotation)
        }

        // ---- 克隆图标 ----
        const iconClone = template.clone(true)
        iconClone.rotation.x = -Math.PI / 2
        iconClone.position.y = labelHeight
        container.add(iconClone)

        // ---- 底部圆环 ----
        const ring = createRing(color)
        container.add(ring)

        // ---- 涟漪 ----
        let rippleGroup = null
        if (opts.ripple) {
            rippleGroup = createRipples(color)
            container.add(rippleGroup)
        }

        // ---- 名称牌 ----
        if (opts.showName && item.name) {
            const nameTag = createNameTag(item.name, color, opts.nameStyle)
            nameTag.position.set(0, labelHeight + opts.nameTagHeight, 0)
            nameTag.scale.multiplyScalar(opts.nameTagSize)
            if (opts.nameTagRot) {
                nameTag.material.rotation = THREE.MathUtils.degToRad(opts.nameTagRot)
            }
            container.add(nameTag)
        }

        // ---- 缓存动画引用（避免每帧 children.find 遍历） ----
        const anim = {
            icon: iconClone,
            ripples: rippleGroup ? rippleGroup.children : [],
            rippleEnabled: !!opts.ripple,
            animEnabled: opts.animEnabled,
            animType: opts.animation || 'bounce',
            labelHeight,
            phase,
        }
        container.userData._anim = anim

        // 标签所有节点设为 Layer 2，独立渲染通道始终在最上层
        // Three.js 图层不继承，必须逐个设置
        container.layers.set(2)
        container.traverse((c) => c.layers.set(2))

        group.add(container)
        this.labels.push(container)
    }

    // ========== 图层管理 ==========

    /**
     * 设置图层组可见性。
     * @param {string} type - 图层组 ID
     * @param {boolean} visible - 是否可见
     */
    setGroupVisible(type, visible) {
        const group = this.groups.get(type)
        if (group) group.visible = visible
    }

    /**
     * 移除图层组。
     * @param {string|string[]|null} type - 图层组 ID、ID 数组，null 则移除全部
     */
    removeGroup(type) {
        const removeOne = (t) => {
            const group = this.groups.get(t)
            if (!group) return
            this.labels = this.labels.filter((label) => {
                if (label.parent === group) { disposeObject3D(label); return false }
                return true
            })
            this.root.remove(group)
            disposeObject3D(group)
            this.groups.delete(t)
        }

        if (type == null) {
            const keys = [...this.groups.keys()]
            for (const key of keys) removeOne(key)
            return
        }
        const types = Array.isArray(type) ? type : [type]
        for (const t of types) removeOne(t)
    }

    // ========== 动画更新 ==========

    update(elapsedTime) {
        const delta = elapsedTime - this.prevTime
        this.prevTime = elapsedTime

        // ---- 自适应缩放：根据相机距离动态调整标签大小 ----
        const camera = this.deps.getCamera?.()
        if (camera && this.labels.length > 0) {
            // 计算相机到场景中心的距离
            const camPos = camera.position
            const currentDistance = camPos.distanceTo(this._sceneCenter)

            // 首次捕获参考距离
            if (this.referenceDistance === 0) {
                this.referenceDistance = currentDistance
            }

            // 计算目标缩放倍率并平滑插值
            const targetMultiplier = Math.max(
                ADAPTIVE_MIN_SCALE,
                Math.min(ADAPTIVE_MAX_SCALE, currentDistance / this.referenceDistance),
            )
            this.scaleMultiplier += (targetMultiplier - this.scaleMultiplier) * ADAPTIVE_LERP

            // 应用到每个标签
            for (const c of this.labels) {
                const baseScale = c.userData.baseScale
                if (baseScale) {
                    const s = baseScale * this.scaleMultiplier
                    c.scale.set(s, s, s)
                }
            }
        }

        for (const container of this.labels) {
            // 可见性：容器自身 + 所属图层组（直接检查 parent.visible，O(1)）
            if (!container.visible) continue
            if (container.parent && !container.parent.visible) continue

            const anim = container.userData._anim
            if (!anim) continue

            // ---- 涟漪 ----
            if (anim.rippleEnabled) {
                const ripples = anim.ripples
                for (let i = 0, len = ripples.length; i < len; i++) {
                    const rip = ripples[i]
                    const t = (elapsedTime * RIPPLE_SPEED + rip.userData.ripplePhase) % 1
                    rip.scale.setScalar((0.25 + t) * rip.userData.baseScale)
                    rip.material.opacity = 0.55 * (1 - t) * (1 - t)
                }
            }

            // ---- 弹跳 / 旋转 ----
            if (!anim.animEnabled) continue

            const icon = anim.icon
            const type = anim.animType

            if (type === 'bounce' || type === 'both') {
                icon.position.y =
                    anim.labelHeight +
                    BOUNCE_AMPLITUDE * Math.sin(BOUNCE_SPEED * elapsedTime + anim.phase)
            }
            if (type === 'rotate' || type === 'both') {
                icon.rotation.z += ROTATION_SPEED * delta
            }
        }
    }

    // ========== 拾取 ==========

    /**
     * 用归一化设备坐标（NDC）对标签做射线拾取。
     * @param {THREE.Camera} camera
     * @param {THREE.Vector2} ndc
     * @returns {{ id, name, longitude, latitude, altitude, container: THREE.Group } | null}
     */
    pick(camera, ndc) {
        if (this.labels.length === 0) return null
        this.raycaster.setFromCamera(ndc, camera)
        // 收集所有标签下的 Mesh
        const meshes = []
        for (const c of this.labels) {
            if (!c.visible) continue
            c.traverse((obj) => { if (obj.isMesh) meshes.push(obj) })
        }
        const hits = this.raycaster.intersectObjects(meshes, false)
        if (hits.length === 0) return null
        // 沿命中链向上找到标签容器（带 labelId 的 Group）
        let node = hits[0].object
        while (node) {
            if (node.userData?.labelId !== undefined) {
                return { ...node.userData.labelData, container: node }
            }
            node = node.parent
        }
        return null
    }

    /**
     * 启用标签点击拾取。
     * @param {THREE.Camera} camera
     * @param {HTMLElement} domElement
     */
    enablePicking(camera, domElement) {
        if (this.pickDomElement === domElement) return
        this.disablePicking()
        this.pickCamera = camera
        this.pickDomElement = domElement
        domElement.addEventListener('pointerdown', this._handlePointerDown)
        domElement.addEventListener('click', this._handleClick)
    }

    /** 停止标签点击拾取 */
    disablePicking() {
        if (this.pickDomElement) {
            this.pickDomElement.removeEventListener('pointerdown', this._handlePointerDown)
            this.pickDomElement.removeEventListener('click', this._handleClick)
        }
        this.pickCamera = null
        this.pickDomElement = null
    }

    /** @private */
    _handlePointerDown = (event) => {
        this.pickPointerStart.set(event.clientX, event.clientY)
    }

    /** @private */
    _handleClick = (event) => {
        if (!this.pickCamera || !this.pickDomElement) return
        // 拖拽不触发点击
        if (Math.hypot(event.clientX - this.pickPointerStart.x, event.clientY - this.pickPointerStart.y) > 5) return
        const rect = this.pickDomElement.getBoundingClientRect()
        const ndc = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        )
        const info = this.pick(this.pickCamera, ndc)
        if (info) {
            this.deps.onLabelClick?.(info)
        }
    }

    // ========== 查询 ==========

    /**
     * 根据标签 ID 查找并飞行定位到对应 3D 标签。
     * @param {number|string} id - 标签 ID（对应配置中 list 项的 id）
     * @returns {{ center: THREE.Vector3, distance: number } | null} 飞行目标，未找到返回 null
     */
    flyToLabel(id) {
        const label = this.labels.find((c) => c.userData.labelId === id)
        if (!label) {
            console.warn(`[LabelRenderer] 未找到 ID=${id} 的标签`)
            return null
        }
        // 计算标签包围球，得到合适的观察距离
        label.updateWorldMatrix(true, true)
        const box = new THREE.Box3().setFromObject(label)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z, 50)
        return { center, distance: maxDim * 2 }
    }

    // ========== 生命周期 ==========

    dispose() {
        this.disablePicking()
        for (const [, group] of this.groups) disposeObject3D(group)
        this.groups.clear()
        this.labels = []
        this.templates.clear()
        this.iconCache.clear()
        if (this.root.parent) this.root.parent.remove(this.root)
        disposeObject3D(this.root)
    }
}

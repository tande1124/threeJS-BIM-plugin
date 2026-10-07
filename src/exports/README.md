# InsBimPlusViewer 外部 API 文档

在 InsBimPlusViewer 组件外部操作 3D 场景的工具类，通过相对路径引入即可使用。

## 引入方式

```js
import { bimControls } from '@/exports/bimControls'
```

> 需在 `<InsBimPlusViewer>` 组件的 `@ready` 事件触发后才能调用，此时查看器实例已注册。

---

## 组件事件

`<InsBimPlusViewer>` 组件通过 Vue 事件向外通知状态变化：

| 事件 | payload | 触发时机 |
|------|---------|----------|
| `ready` | `BimViewerController` | 场景初始化完成（DOM 挂载 + 渲染循环启动），可查看器实例 |
| `gltf-pick` | `Object \| null` | 点击 GLB 模型部件时触发；点击空白处 payload 为 `null` |
| `label-click` | `Object` | 点击 3D 标签时触发，含 `{ id, name, ... }` |
| `model-loaded` | `{ id, url }` | 单个 GLB 模型加载完成 |
| `error` | `{ type, error, id?, url? }` | 加载失败时触发，`type` 为 `'tileset'` 或 `'gltf'` |

**gltf-pick 的 info 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `object` | `THREE.Object3D` | 被点击的网格对象 |
| `name` | `string` | 网格名称 |
| `path` | `string` | 层级路径（如 `Root/Building/Wall_001`） |
| `worldPosition` | `THREE.Vector3` | 点击点世界坐标 |
| `localPosition` | `THREE.Vector3` | 点击点局部坐标 |
| `screenPosition` | `{x, y}` | 点击点屏幕坐标（像素） |
| `model` | `THREE.Group` | 所属模型根节点 |

```vue
<InsBimPlusViewer
    @ready="onReady"
    @gltf-pick="onPick"
    @label-click="onLabelClick"
    @model-loaded="onModelLoaded"
    @error="onError"
/>
```

```js
methods: {
    onReady(controller) {
        // controller 为底层 BimViewerController 实例
        // 也可直接使用 bimControls 操作
    },
    onPick(info) {
        if (!info) return // 点击了空白处
        console.log(`点击了部件: ${info.name} (${info.path})`)
        console.log('世界坐标:', info.worldPosition)
    },
    onLabelClick(info) {
        console.log(`点击了标签: ${info.name} (ID: ${info.id})`)
    },
    onModelLoaded({ id, url }) {
        console.log(`模型加载完成: ${id}`)
    },
    onError({ type, error, id, url }) {
        console.warn(`${type} 加载失败:`, error)
    },
}
```

---

## 数据加载

### `loadTilesets(sources)`

加载 3D Tiles 地形数据。

| 参数 | 类型 | 说明 |
|------|------|------|
| `sources` | `Array<{id, url, name?, visible?}>` | 地形数据源列表 |

**sources 字段说明：**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | — | 数据源唯一标识 |
| `url` | `string` | — | tileset.json 地址 |
| `name` | `string` | `id` | 显示名称 |
| `visible` | `boolean` | `true` | 加载后是否可见（`null`/`undefined` 视为 `true`） |

```js
bimControls.loadTilesets([
    { id: 'rm-tileset', name: 'RM地形', url: 'http://server/data/3dtiles/rm/tileset.json' },
    { id: 'bg-tileset', name: '背景地形', url: 'http://server/data/3dtiles/bg/tileset.json', visible: false },
])
```

---

### `loadGltfModels(sources, geoOrigin?)`

依次加载 GLTF/GLB 模型。若之前调用过 `applyMaterialConfig`，会自动将材质配置应用到新加载的模型。

| 参数 | 类型 | 说明 |
|------|------|------|
| `sources` | `Array<{id, url, name?, visible?}>` | 模型数据源列表 |
| `geoOrigin` | `Object` | 可选，地理配准原点（对应 `sceneConfig.geoOrigin`），不传则不做地理配准 |

**sources 字段说明：**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | — | 数据源唯一标识 |
| `url` | `string` | — | GLB/GLTF 文件地址 |
| `name` | `string` | — | 显示名称（用于模型树和路径展示） |
| `visible` | `boolean` | `true` | 加载后是否可见（`null`/`undefined` 视为 `true`） |

**geoOrigin 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `centralMeridianDeg` | `number` | 高斯-克吕格中央子午线经度（度） |
| `offsetX` | `number` | 模型原点投影东坐标（米） |
| `offsetY` | `number` | 模型原点投影北坐标（米） |
| `offsetZ` | `number` | 模型原点高程（米），默认 `0` |
| `verticalScale` | `number` | 垂直缩放比例，默认 `1` |

```js
// 不传 geoOrigin（无地理配准）
bimControls.loadGltfModels([
    { id: 'rm-glb', name: 'RM模型', url: 'http://server/data/gltf/rm/RM_.glb' },
    { id: 'rm-model', name: '隧道模型', url: 'http://server/data/gltf/rm/model.glb', visible: false },
])

// 传入 geoOrigin（加载时即完成地理配准）
bimControls.loadGltfModels(
    [{ id: 'rm-glb', name: 'RM模型', url: 'http://server/data/gltf/rm/RM_.glb' }],
    { centralMeridianDeg: 99, offsetX: 436200, offsetY: 3282400, offsetZ: 2000 }
)
```

---

### `renderLabels(config)`

加载并渲染 3D 标签，完成后自动飞行到标签位置。

| 参数 | 类型 | 说明 |
|------|------|------|
| `config` | `Object` | 标签配置对象（含 `type`、`list` 字段） |

```js
bimControls.renderLabels({
    type: 'label',
    list: [
        {
            id: 1,
            name: '料仓场地',
            longitude: 98.348505,
            latitude: 29.633465,
            altitude: 2711.1,
            icon: './assets/icon/label.glb',
            opts: {
                template: '标签_C',
                color: '#88ddff',
                animation: 'bounce',
                scale: 200,
                showName: true,
                nameStyle: 'glow',
            },
        },
    ],
})
```

---

## 配置管理（整体替换）

### `applyEnvConfig(config)`

应用环境配置（天空/HDR/光照/曝光），覆盖当前所有环境参数。

| 参数 | 类型 | 说明 |
|------|------|------|
| `config` | `Object` | 配置对象 |

```js
import sceneConfig from './config/bim-scene-config.js'
bimControls.applyEnvConfig(sceneConfig.envConfig)
```

---

### `applyMaterialConfig(config)`

应用材质映射配置，并重新应用到所有已加载的 GLB 模型。后续调用 `loadGltfModels` 时也会自动应用此配置。

| 参数 | 类型 | 说明 |
|------|------|------|
| `config` | `Array` | 配置数组 |

```js
import materialConfig from './config/material-config.js'
bimControls.applyMaterialConfig(materialConfig)
```

---

### `applyCameraConfig(cfg)`

设置相机位置和观察目标。缺省项保持当前值。

| 参数 | 类型 | 说明 |
|------|------|------|
| `cfg` | `Object` | `{ position?: {x,y,z}, target?: {x,y,z} }` |

```js
bimControls.applyCameraConfig({
    position: { x: 100, y: 200, z: 300 },
    target: { x: 0, y: 0, z: 0 },
})
```

---

### `getCameraInfo()`

获取当前相机位置和观察目标，返回格式与 `biz-config.js` 的 `camera` 配置一致，可直接用于 `applyCameraConfig`。

| 参数 | 类型 | 说明 |
|------|------|------|
| **返回** | `Object \| null` | `{ position: {x,y,z}, target: {x,y,z} }` |

```js
const info = bimControls.getCameraInfo()
console.log(info)
// { position: { x: 0, y: 3000, z: 4000 }, target: { x: 0, y: 0, z: 0 } }

// 保存当前视角，稍后恢复
const savedView = bimControls.getCameraInfo()
// ... 操作后恢复
bimControls.applyCameraConfig(savedView)
```

---

### `resetCamera(cameraConfig?, duration?)`

回归视角。传入 cameraConfig 时平滑飞行到指定位置，否则优先读取 `biz-config.js` 配置，均无配置时自动聚焦到已加载场景的包围盒中心。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cameraConfig` | `Object` | — | 相机配置（可选） |
| `cameraConfig.position` | `{ x, y, z }` | — | 相机位置 |
| `cameraConfig.target` | `{ x, y, z }` | — | 观察目标点 |
| `duration` | `number` | `3000` | 飞行动画时长（毫秒） |

```js
// 回归初始视角（默认 3 秒平滑飞行）
bimControls.resetCamera()

// 飞行到指定位置
bimControls.resetCamera({
    position: { x: -4166, y: 2500, z: 5035 },
    target: { x: 0, y: 0, z: 0 },
})

// 自定义飞行时长
bimControls.resetCamera(null, 1000)
```

---

## 运行时细粒度调参

### `setEnvParam(key, value)`

修改单个环境参数并立即生效。`key` 支持点分路径。

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 点分路径（如 `'envLight.exposure'`） |
| `value` | `any` | 参数值 |

**支持的 key：**

| key | 说明 | 取值范围 |
|-----|------|----------|
| `dirLight.intensity` | 主方向光强度 | 0~10 |
| `dirLight.yaw` | 主方向光水平角度 | 0~360 度 |
| `dirLight.pitch` | 主方向光俯仰角度 | 0~90 度 |
| `dirLight.color` | 主方向光颜色 | CSS 颜色值 |
| `envLight.intensity` | IBL 环境光强度 | 0~5 |
| `envLight.bgIntensity` | 背景强度 | 0~5 |
| `envLight.exposure` | 色调映射曝光 | 0.1~5 |
| `envMapEnabled` | 环境贴图/背景显隐 | true/false |

```js
// 微调曝光
bimControls.setEnvParam('envLight.exposure', 2.0)

// 调整光照方向和强度
bimControls.setEnvParam('dirLight.intensity', 3.0)
bimControls.setEnvParam('dirLight.yaw', 120)

// 关闭环境贴图
bimControls.setEnvParam('envMapEnabled', false)
```

> **规则**：`applyEnvConfig` 会覆盖所有参数重建基准；`setEnvParam` 是在当前基准上局部修改。两者可交替使用。

---

### `getEnvConfig()`

返回当前环境配置对象（只读快照），可用于读取当前参数值。

```js
const cfg = bimControls.getEnvConfig()
console.log(cfg.envLight.exposure) // 1.3
```

---

## 部件操作

### `getModelTreeById(id)`

通过来源 ID 获取模型结构树，返回递归树形数据。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 模型来源 ID（对应 `gltfSources[].id`） |
| **返回** | `Object \| null` | 树结构数据，含 `id`、`name`、`type`、`children` 字段 |

```js
const tree = bimControls.getModelTreeById('rm-model')
if (tree) {
    console.log(tree.name)   // '隧道模型'
    console.log(tree.children) // 子节点数组
}
```

---

### `findPartByName(name)`

按名称查找部件，返回结构化信息（与 `gltf-pick` 事件 info 格式一致）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 部件名称 |
| **返回** | `Object \| null` | `{ object, name, path, worldPosition, localPosition, screenPosition, model }` |

```js
const info = bimControls.findPartByName('Wall_001')
if (info) {
    console.log(info.worldPosition)
}
```

---

### `setPartMaterial(name, matKey)`

按部件名称修改材质。

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 网格名称 |
| `matKey` | `string \| THREE.Material` | 材质库 ID（如 `'m5'`）或 THREE.Material 实例 |
| **返回** | `boolean` | 是否成功 |

```js
// 使用材质库 ID
bimControls.setPartMaterial('Wall_001', 'm5')

// 使用自定义材质
const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 })
bimControls.setPartMaterial('Wall_001', mat)
```

---

### `highlightPart(name)`

按名称高亮部件（半透明 + 轮廓线）并飞行聚焦。

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 部件名称 |
| **返回** | `Object \| false` | 部件信息或 false |

```js
const info = bimControls.highlightPart('Roof_001')
```

---

### `clearHighlight()`

清除当前高亮状态。

```js
bimControls.clearHighlight()
```

---

## 标注管理

### `addAnnotation(position, element, vueApp?)`

在 3D 世界坐标处添加 HTML 标注。

| 参数 | 类型 | 说明 |
|------|------|------|
| `position` | `THREE.Vector3` | 世界坐标 |
| `element` | `HTMLElement` | DOM 元素 |
| `vueApp` | `Object` | 可选，关联的 Vue app 实例，清理时自动 unmount |

```js
import { createApp } from 'vue'
import PartInfoLabel from './PartInfoLabel.vue'

const el = document.createElement('div')
const app = createApp(PartInfoLabel, { name: '部件A', path: '/root/wall' })
app.mount(el)

bimControls.addAnnotation(info.worldPosition, el, app)
```

---

### `clearAnnotations()`

清除所有 HTML 标注（自动 unmount 关联的 Vue 组件）。

```js
bimControls.clearAnnotations()
```

---

## 图层控制

### `controlEnvEnabled(enabled)`

控制环境贴图是否启用。

| 参数 | 类型 | 说明 |
|------|------|------|
| `enabled` | `boolean` | 是否启用环境贴图 |

```js
bimControls.controlEnvEnabled(false)
```

---

### `setModelVisible(id, visible, type?)`

根据来源 ID 设置模型显隐，支持 3D Tiles 和 GLB/GLTF。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 数据源 ID（加载时传入的 `id`） |
| `visible` | `boolean` | 是否可见 |
| `type` | `'3dtiles' \| 'glb' \| 'gltf'` | 可选，模型类型；省略时同时在两端查找 |
| **返回** | `boolean` | 是否成功设置 |

```js
// 控制 3D Tiles 显隐
bimControls.setModelVisible('rm-tileset', false, '3dtiles')

// 控制 GLB 模型显隐
bimControls.setModelVisible('rm-glb', false, 'glb')

// 不指定类型，自动在两端查找
bimControls.setModelVisible('rm-glb', true)
```

---

### `setModelVisibleByType(type, visible)`

按类型批量设置所有模型的显隐。

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | `'3dtiles' \| 'glb' \| 'gltf'` | 模型类型 |
| `visible` | `boolean` | 是否可见 |

```js
// 隐藏所有地形
bimControls.setModelVisibleByType('3dtiles', false)

// 隐藏所有 GLB 模型
bimControls.setModelVisibleByType('glb', false)

// 显示所有 GLB 模型
bimControls.setModelVisibleByType('gltf', true)
```

---

### `removeModel(id, type?)`

根据来源 ID 移除模型，释放相关资源。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 数据源 ID（加载时传入的 `id`） |
| `type` | `'3dtiles' \| 'glb' \| 'gltf'` | 可选，模型类型；省略时同时尝试移除 3DTiles 和 GLB |
| **返回** | `boolean` | 是否成功移除 |

```js
// 移除指定类型的模型
bimControls.removeModel('rm-tileset', '3dtiles')
bimControls.removeModel('rm-glb', 'glb')

// 不指定类型，自动在两端查找
bimControls.removeModel('rm-glb')
```

---

### `setDualPass(enabled)`

切换双相机透视渲染模式。ON 时 GLB 透明叠加在 3D Tiles 外壳上，OFF 时单层渲染。

| 参数 | 类型 | 说明 |
|------|------|------|
| `enabled` | `boolean` | 是否启用双透视 |

```js
bimControls.setDualPass(true)
```

---

### `setLabelVisible(type, visible)`

切换标签图层的显隐。

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | `string` | 图层组 ID（对应标签配置中的 `type` 字段） |
| `visible` | `boolean` | 是否可见 |

```js
bimControls.setLabelVisible('label', false)
```

---

### `flyToModel(id, duration?, type?)`

根据来源 ID 飞行定位到指定模型。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | — | 数据源 ID（加载时传入的 `id`） |
| `duration` | `number` | `3000` | 飞行动画时长（毫秒） |
| `type` | `'3dtiles' \| 'glb' \| 'gltf'` | — | 可选，模型类型；省略时先在 GLB 中查找，再在 3DTiles 中查找 |
| **返回** | `boolean` | — | 是否成功飞行 |

```js
// 飞行到 3D Tiles
bimControls.flyToModel('rm-tileset', 2000, '3dtiles')

// 飞行到 GLB 模型
bimControls.flyToModel('rm-glb', 2000, 'glb')

// 不指定类型，自动查找
bimControls.flyToModel('rm-model')
```

---

### `flyToLabel(id, duration?)`

根据标签 ID 飞行定位到对应 3D 标签。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `number \| string` | — | 标签 ID |
| `duration` | `number` | `3000` | 飞行动画时长（毫秒） |

```js
bimControls.flyToLabel(1, 2000)
```

---

### `setGltfGeoOrigin(newGeoInfo)`

动态更新所有 GLB 模型的场景偏移配置（无需重新加载模型）。支持两种模式：

- **首次设置**：模型加载时未传 geo 参数，直接应用绝对配准矩阵
- **增量更新**：模型已有 geoOrigin 时，计算 delta 矩阵统一更新

所有模型共享同一套地理配准参数，只计算一次矩阵，毫秒级完成。仅影响 GLB 模型，3D Tiles 不受影响。

| 参数 | 类型 | 说明 |
|------|------|------|
| `newGeoInfo` | `Object` | 新的地理配准参数 |
| **返回** | `Promise<boolean>` | 是否成功更新 |

**newGeoInfo 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `centralMeridianDeg` | `number` | 高斯-克吕格中央子午线经度（度） |
| `offsetX` | `number` | 模型原点投影东坐标（米） |
| `offsetY` | `number` | 模型原点投影北坐标（米） |
| `offsetZ` | `number` | 模型原点高程（米），默认 `0` |
| `verticalScale` | `number` | 垂直缩放比例，默认 `1` |

```js
// 设置/更新模型地理位置（异步等待地形就绪）
await bimControls.setGltfGeoOrigin({
    centralMeridianDeg: 99,
    offsetX: 436200,
    offsetY: 3282400,
    offsetZ: 2000,
    verticalScale: 1,
})
```

---

## 完整示例

```vue
<template>
    <div style="width: 100%; height: 100%">
        <InsBimPlusViewer
            ref="bimViewer"
            @ready="onReady"
            @gltf-pick="onPick"
            @label-click="onLabelClick"
            @model-loaded="onModelLoaded"
            @error="onError"
        />
    </div>
</template>

<script>
import { bimControls } from '@/exports/bimControls'
import InsBimPlusViewer from '@/components/InsBimViewer/index.vue'

export default {
    components: { InsBimPlusViewer },
    data() {
        return {
            tilesetSources: [
                { id: 'rm-tileset', url: 'http://server/data/3dtiles/rm/tileset.json' },
            ],
            gltfSources: [
                { id: 'rm-glb', url: 'http://server/data/gltf/rm/RM_.glb' },
            ],
        }
    },
    methods: {
        /**
         * 场景初始化完成回调
         * @param {BimViewerController} controller - 底层查看器实例
         */
        async onReady(controller) {
            // 1. 加载环境配置（天空/HDR/光照/曝光）
            await bimControls.applyEnvConfig(window.BizConfig?.sceneConfig?.envConfig)

            // 2. 加载材质配置（自动应用到后续加载的模型）
            bimControls.applyMaterialConfig(window.BizConfig?.sceneConfig?.materialConfig)

            // 3. 加载 3D Tiles 地形
            await bimControls.loadTilesets(this.tilesetSources)

            // 4. 加载 GLB 模型
            await bimControls.loadGltfModels(this.gltfSources)

            // 5. 渲染 3D 标签
            bimControls.renderLabels({ type: 'label', list: [...] })

            // 6. 运行时调参（可在任意时刻调用）
            bimControls.setEnvParam('envLight.exposure', 1.5)
        },

        /**
         * 点击 GLB 模型部件回调
         * @param {Object|null} info - 点击信息，点击空白处时为 null
         */
        onPick(info) {
            if (!info) return
            // 高亮部件并飞行聚焦
            bimControls.highlightPart(info.name)
        },

        /**
         * 点击 3D 标签回调
         * @param {Object} info - 标签信息，含 { id, name, ... }
         */
        onLabelClick(info) {
            // 飞行定位到标签
            bimControls.flyToLabel(info.id)
        },

        /**
         * 单个 GLB 模型加载完成回调
         * @param {Object} payload - { id: 模型ID, url: 模型路径 }
         */
        onModelLoaded({ id, url }) {
            console.log(`模型加载完成: ${id} (${url})`)
        },

        /**
         * 加载失败回调
         * @param {Object} payload - { type: 'tileset'|'gltf', error, id?, url? }
         */
        onError({ type, error, id, url }) {
            console.warn(`[${type}] 加载失败:`, id, url, error)
        },
    },
}
</script>
```

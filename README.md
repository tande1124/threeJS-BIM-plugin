# threeJS-BIM-plugin

基于 Vue 3 + Vite + Element Plus + Three.js 的 BIM 查看器，提供 3D Tiles 地形 + GLB 模型加载、3D 标签、环境控制、部件交互等能力。

## 安装

```bash
npm install
```

## 快速开始

### 1. 启动开发服务

```bash
npm run dev
```

访问 `http://localhost:3000`。

### 2. 配置业务参数

在 `public/biz-config.js` 中挂载场景配置，供页面读取：

```javascript
import sceneConfig from './scene-config.js'

window.BizConfig = {
    sceneConfig,
}
```

`sceneConfig`（`public/scene-config.js`）包含以下模块：

| 模块 | 说明 |
|------|------|
| `envConfig` | 环境配置（天空/HDR/光照/曝光） |
| `cameraConfig` | 相机初始位置和观察目标 |
| `geoOrigin` | 地理坐标原点（中央子午线、投影偏移、高程等） |

## 使用方式

### 组件方式（通过 ref 调用）

```vue
<template>
    <InsBimPlusViewer
        ref="bimViewer"
        @ready="onReady"
        @gltf-pick="onPick"
        @label-click="onLabelClick"
        @model-loaded="onModelLoaded"
        @error="onError"
    />
</template>

<script>
import InsBimPlusViewer from '../components/InsBimViewer/index.vue'

export default {
    components: { InsBimPlusViewer },
    methods: {
        async onReady(controller) {
            const v = this.$refs.bimViewer

            // 1. 环境配置
            v.applyEnvConfig(this.envConfig)

            // 2. 加载地形
            await v.loadTilesets(this.tilesetSources)

            // 3. 加载模型（传入 geoOrigin 进行地理配准）
            await v.loadGltfModels(this.gltfSources, this.geoOrigin)

            // 4. 渲染标签
            await v.renderLabels(this.labelConfig)
        },
    },
}
</script>
```

### 外部 API 方式（bimControls）

```js
import { bimControls } from './exports/bimControls'

// 需在 @ready 事件触发后才能调用
await bimControls.loadTilesets([...])
await bimControls.loadGltfModels([...], geoOrigin)
await bimControls.renderLabels({...})
```

> 详细 API 文档见 [src/exports/README.md](./src/exports/README.md)

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务 |
| `npm run build` | 构建生产包 |
| `npm run preview` | 预览构建产物 |

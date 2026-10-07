# threeJS-BIM-plugin

基于 Vue 3 + Vite + Element Plus + Three.js 的 BIM 查看器，提供 3D Tiles 地形 + GLB 模型加载、3D 标签、环境控制、部件交互等能力。

## 技术栈


| 技术              | 说明                    |
| ----------------- | ----------------------- |
| Vue 3             | 前端框架（Options API） |
| Vite              | 构建工具                |
| Element Plus      | UI 组件库               |
| Three.js          | 3D 渲染引擎             |
| 3d-tiles-renderer | 3D Tiles 地形渲染       |
| Vue Router        | 路由管理                |

## 功能特性

### 模型加载

- **3D Tiles 地形加载**：支持多数据源并行加载，自动适配 CGCS2000 高斯-克吕格投影坐标
- **GLB/GLTF 模型加载**：支持 Draco 压缩网格 + KTX2/Basis Universal 压缩纹理
- **地理配准**：WGS84 经纬度 → ECEF → 场景局部坐标自动转换，支持 CGCS2000 投影偏移
- **材质配置**：材质库管理，按部件名称批量分配/重置材质

### 场景渲染

- **HDR 环境光照**：EXR 环境贴图 + IBL 全局光照，可调曝光/强度/背景强度
- **方向光与阴影**：可调光照方向（yaw/pitch）、强度、颜色，支持阴影开关及自动适配范围
- **双相机透视渲染**：GLB 透明叠加在 3D Tiles 地形外壳上，单层/双层模式切换
- **环境贴图显隐控制**：独立开关 HDR 背景与环境反射

### 3D 标签

- **GLB 图标标签**：3D 空间中渲染 GLB 图标 + 涟漪动画 + 名称牌
- **标签飞行定位**：按标签 ID 飞行聚焦，可调飞行动画时长
- **标签图层显隐**：按图层组批量控制标签可见性

### 部件交互

- [ ]  **部件拾取**：点击 GLB 模型部件，返回层级路径、世界/局部/屏幕坐标
- [ ]  **部件高亮**：半透明 + 轮廓线高亮效果，自动飞行聚焦到目标部件
- [ ]  **部件材质替换**：按名称修改单个部件材质，支持材质库 ID 或自定义 THREE.Material
- [ ]  **模型结构树**：展开查看 GLB 模型层级结构，点击节点高亮定位

### 相机控制

- **OrbitControls 轨道控制**：鼠标拖拽旋转、缩放、平移
- **飞行动画**：平滑插值飞行到指定位置/模型/标签，可调时长
- **回归视角**：一键回到初始相机位置，或自动聚焦场景包围盒中心
- **相机信息读取**：获取当前相机位置和观察目标坐标，可保存/恢复视角

### 图层管理

- **模型显隐控制**：按数据源 ID 或类型（3dtiles/glb/gltf）批量显隐
- **模型移除**：按 ID 移除模型并释放 GPU 资源
- **标注管理**：在 3D 坐标处添加 HTML 标注，支持 Vue 组件自动卸载

### 页面 UI（Element Plus）

- **工具栏**：加载地形/模型/标签、环境开关、双透视切换、标签显隐
- **模型结构面板**：树形展示模型层级，点击节点交互
- **环境设置面板**：实时调整光照、曝光、环境贴图等参数
- **部件信息标签**：点击部件后弹出浮动信息卡
- **相机参数弹窗**：显示/编辑相机坐标，支持复制和一键飞行

## 快速开始

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

### 配置业务参数

在 `public/biz-config.js` 中挂载场景配置：

```javascript
import sceneConfig from './scene-config.js'

window.BizConfig = {
    sceneConfig,
}
```

`sceneConfig`（`public/scene-config.js`）字段说明：


| 字段             | 说明                                       |
| ---------------- | ------------------------------------------ |
| `envConfig`      | 环境配置（天空/HDR/光照/曝光）             |
| `cameraConfig`   | 相机初始位置和观察目标                     |
| `geoOrigin`      | 地理坐标原点（中央子午线、投影偏移、高程） |
| `materialConfig` | 材质映射配置                               |

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
import InsBimPlusViewer from '@/components/InsBimViewer/index.vue'

export default {
    components: { InsBimPlusViewer },
    methods: {
        async onReady(controller) {
            const v = this.$refs.bimViewer
            v.applyEnvConfig(this.envConfig)
            await v.loadTilesets(this.tilesetSources)
            await v.loadGltfModels(this.gltfSources, this.geoOrigin)
            await v.renderLabels(this.labelConfig)
        },
    },
}
</script>
```

### 外部 API 方式（bimControls）

```js
import { bimControls } from '@/exports/bimControls'

// 需在 @ready 事件触发后调用
await bimControls.loadTilesets([...])
await bimControls.loadGltfModels([...], geoOrigin)
await bimControls.renderLabels({...})
bimControls.highlightPart('Wall_001')
bimControls.setEnvParam('envLight.exposure', 2.0)
```

> 详细 API 文档见 [src/exports/README.md](./src/exports/README.md)

## 项目结构

```
src/
├── main.js                          # Vue 应用入口
├── App.vue                          # 根组件
├── router/index.js                  # Vue Router 路由
├── pages/
│   ├── index.vue                    # 主页面（工具栏 + 查看器）
│   ├── ModelTree.vue                # 模型结构树面板
│   ├── PartInfoLabel.vue            # 部件信息标签
│   └── SceneEnvPanel.vue            # 环境设置面板
├── components/
│   ├── InsBimViewer/index.vue       # BIM 查看器核心组件
│   └── common/CameraInfoDialog.vue  # 相机参数弹窗
├── core/
│   ├── viewer/
│   │   ├── BimViewerController.js   # 场景控制器（渲染循环、双相机）
│   │   ├── CameraManager.js         # 相机管理（飞行、OrbitControls）
│   │   ├── EnvironmentManager.js    # 环境管理（HDR、光照、阴影）
│   │   └── LightDragHelper.js       # 灯光方向拖拽辅助
│   └── loaders/
│       ├── GltfModelLoader.js       # GLB/GLTF 加载与拾取
│       ├── TileModelLoader.js       # 3D Tiles 地形加载
│       ├── LabelRenderer.js         # 3D 标签渲染
│       └── MaterialConfigurator.js  # 材质配置器
├── exports/
│   ├── bimControls.js               # 外部操作 API
│   └── internal/viewerRegistry.js   # 查看器注册中心
└── utils/
    ├── geo-coordinate.js            # 地理坐标转换
    └── three-dispose.js             # Three.js 资源释放
```

## 开发命令


| 命令              | 说明                           |
| ----------------- | ------------------------------ |
| `npm run dev`     | 启动开发服务（localhost:3000） |
| `npm run build`   | 构建生产包                     |
| `npm run preview` | 预览构建产物                   |

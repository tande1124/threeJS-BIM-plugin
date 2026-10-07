<template>
    <InsBimPlusViewer ref="bimViewer" :sceneCode="code" @ready="onReady" @model-loaded="onModelLoaded" @error="onError"
        @gltf-pick="onPartClick" @label-click="onLabelClick" />
    <div class="toolbar" v-show="!code">
        <div class="toolbar-group">
            <el-button type="primary" size="small" @click="loadTilesets">加载地形</el-button>
            <el-button type="primary" size="small" @click="loadBIM">加载bim</el-button>
            <el-button type="primary" size="small" @click="loadLabels">加载标签</el-button>
        </div>
        <div class="toolbar-group">
            <el-switch v-model="envShow" active-text="环境" @change="handleSceneEvent" />
            <el-checkbox v-model="tileShow" @change="handleLayerToggle">地形</el-checkbox>
            <el-checkbox v-model="canansShow" @change="handleDualPassToggle">双透视</el-checkbox>
            <el-checkbox v-model="labelsVisible" @change="handleRenderLabels">标签</el-checkbox>
        </div>
        <div class="toolbar-group">
            <el-button type="danger" size="small" @click="setSceneCoordinate">场景坐标配置</el-button>
            <el-button type="danger" size="small" @click="openSceneEnv">环境设置</el-button>
        </div>
        <div class="toolbar-group">
            <el-button type="success" size="small" @click="getModelInfo">模型信息</el-button>
            <el-button type="success" size="small" @click="resetView">回归视角</el-button>
            <el-button type="success" size="small" @click="flyToTileset">定位地形</el-button>
            <el-button type="success" size="small" @click="setModelMaterial">模型材质</el-button>
            <el-button type="success" size="small" @click="resetMaterial">重置材质</el-button>
        </div>
    </div>
    <div v-if="showModelTree" class="model-tree-panel">
        <div class="panel-header">
            <span>模型结构</span>
            <el-button type="info" link @click="showModelTree = false">关闭</el-button>
        </div>
        <div class="panel-body">
            <ModelTree :node="modelTreeData" :bimViewer="$refs.bimViewer" />
        </div>
    </div>
    <div v-if="showSceneEnvPanel" class="scene-env-panel">
        <div class="panel-header">
            <span>环境设置</span>
            <el-button type="info" link @click="showSceneEnvPanel = false">关闭</el-button>
        </div>
        <div class="panel-body">
            <SceneEnvPanel @close="showSceneEnvPanel = false" />
        </div>
    </div>
</template>

<script>
import { createApp } from "vue";
import PartInfoLabel from "./PartInfoLabel.vue";
import ModelTree from "./ModelTree.vue";
import SceneEnvPanel from "./SceneEnvPanel.vue";
import InsBimPlusViewer from "../components/InsBimViewer/index.vue";

export default {
    components: {
        ModelTree,
        SceneEnvPanel,
        InsBimPlusViewer,
    },
    data() {
        return {
            code: "",
            tilesetSources: [
                {
                    id: "rm-tileset",
                    name: "RM地形",
                    visible: true,
                    url: 'http://192.168.8.77:3000/data/3dtiles/rm/tileset.json',
                },
            ],
            gltfSources: [
                {
                    id: "RM_",
                    name: "RM模型",
                    visible: true,
                    url: "http://192.168.8.77:3000/data/gltf/rm/RM_.glb",
                }
            ],
            envConfig: window.BizConfig?.sceneConfig?.envConfig,
            materialConfig: window.BizConfig?.sceneConfig?.materialConfig,


            controller: null, // 底层控制器实例
            envShow: true, // 环境显示
            tileShow: true, // 地形显示
            canansShow: true, // 双透视显示
            labelsVisible: true, // 标签显示
            modelTreeData: null, // 模型树数据
            showModelTree: false, // 是否显示模型树面板
            showSceneEnvPanel: false,

            labelConfig: {
                // 图层组类型（同类型标签归为一组，便于整体显隐控制）
                type: "label",
                list: [
                    {
                        id: 1,
                        name: "料仓场地", // 标签名称（显示在名称牌上）
                        longitude: 98.348505, // 经度
                        latitude: 29.633465, // 纬度
                        altitude: 2711.1, // 高程（米）
                        icon: "./assets/icon/label.glb", // GLB 图标文件路径
                        opts: {
                            template: "标签_C", // GLB 中的模板节点名，如 标签_A / 标签_B / 标签_C / 标签_D
                            color: "#88ddff", // 圆环/涟漪颜色，CSS 颜色值
                            animation: "bounce", // 动画类型：bounce(弹跳) / rotate(旋转) / both(两者) / none(无)
                            animEnabled: true, // 是否启用动画
                            scale: 200, // 整体缩放，BIM 场景较大建议 30-80
                            labelHeight: 0.3, // 图标离地高度
                            ripple: true, // 是否显示底部涟漪扩散动画
                            showName: true, // 是否显示名称牌
                            nameStyle: "glow", // 名称牌样式：bubble(气泡) / glow(霓虹发光)
                            nameTagHeight: 1.3, // 名称牌距离标签顶部的高度
                            nameTagSize: 1.5, // 名称牌大小缩放
                            rotation: 0, // 整体 Y 轴旋转角度（度）
                        },
                    },
                    {
                        id: 2,
                        name: "边坡", // 标签名称（显示在名称牌上）
                        longitude: 98.345574, // 经度
                        latitude: 29.650348, // 纬度
                        altitude: 2829.9, // 高程（米）
                        icon: "./assets/icon/label.glb", // GLB 图标文件路径
                        opts: {
                            template: "标签_D", // GLB 中的模板节点名，如 标签_A / 标签_B / 标签_C / 标签_D
                            color: "#88ddff", // 圆环/涟漪颜色，CSS 颜色值
                            animation: "bounce", // 动画类型：bounce(弹跳) / rotate(旋转) / both(两者) / none(无)
                            animEnabled: true, // 是否启用动画
                            scale: 200, // 整体缩放，BIM 场景较大建议 30-80
                            labelHeight: 0.3, // 图标离地高度
                            ripple: true, // 是否显示底部涟漪扩散动画
                            showName: true, // 是否显示名称牌
                            nameStyle: "plaque", // 名称牌样式：bubble(气泡) / glow(霓虹发光)
                            nameTagHeight: 1.3, // 名称牌距离标签顶部的高度
                            nameTagSize: 1.5, // 名称牌大小缩放
                            rotation: 0, // 整体 Y 轴旋转角度（度）
                        },
                    },
                ],
            },
        };
    },
    methods: {
        // 场景就绪后，按顺序加载环境、材质、地形、模型、标签
        async onReady(controller) {
            this.controller = controller;
            const v = this.$refs.bimViewer;
            if (!v) return;

            // 环境配置
            v.applyEnvConfig(this.envConfig);
        },
        onModelLoaded() {

        },
        onError({ type, error }) { },
        onPartClick(info) {
            if (!info || !this.controller) return;

            // 创建 DOM 容器，挂载 Vue 组件，添加到 3D 场景
            const el = document.createElement("div");
            const app = createApp(PartInfoLabel, {
                name: info.name,
                path: info.path,
            });
            app.mount(el);

            if (this.$refs.bimViewer) {
                // const pos = info.worldPosition.clone()
                // pos.z += 0  // 抬高值，可根据需要调整
                // pos.y += 50  // 抬高值，可根据需要调整
                this.$refs.bimViewer.addAnnotation(info.worldPosition, el, app);
            }
        },

        onLabelClick(info) {

        },

        async loadTilesets() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.showLoading('正在加载地形…');
            await this.$refs.bimViewer.loadTilesets(this.tilesetSources);
            this.$refs.bimViewer.hideLoading();
        },
        async loadBIM() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.showLoading('正在加载模型…');
            await this.$refs.bimViewer.loadGltfModels(this.gltfSources);
            this.$refs.bimViewer.hideLoading();
        },

        async loadLabels() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.showLoading('正在加载标签…');
            await this.$refs.bimViewer.renderLabels(this.labelConfig);
            this.$refs.bimViewer.hideLoading();
        },

        handleSceneEvent() {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.controlEnvEnabled(this.envShow);
            }
        },
        handleLayerToggle() {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.setModelVisible("rm-tileset", this.tileShow);
            }
        },
        handleDualPassToggle() {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.setDualPass(this.canansShow);
            }
        },
        async handleRenderLabels() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.setLabelVisible("label", this.labelsVisible);
        },
        getModelInfo() {
            const id = this.gltfSources[0]?.id;
            if (!id || !this.$refs.bimViewer) return;
            this.modelTreeData = this.$refs.bimViewer.getModelTreeById(id);
            this.showModelTree = !!this.modelTreeData;
        },
        flyToTileset() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.flyToModel("rm-tileset");
        },
        resetView() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.resetCamera({
                position: { x: -4166.70, y: 2500.09, z: 5035.86 },
                target: { x: 0.00, y: 0.00, z: 0.00 }
            });
        },

        async setSceneCoordinate() {
            if (!this.$refs.bimViewer) return;
            await this.$refs.bimViewer.setGltfGeoOrigin({
                centralMeridianDeg: 99,
                offsetX: 436200,
                offsetY: 3282400,
                offsetZ: 2000,
                verticalScale: 1,
            });
        },

        openSceneEnv() {
            this.showSceneEnvPanel = !this.showSceneEnvPanel;
        },
        setModelMaterial() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.applyMaterialConfig(this.materialConfig);
        },
        // 测试根据名称设置材质
        resetMaterial() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.setPartMaterial('泄洪洞工程', '');
        },
    },
};
</script>

<style>
html,
body,
#app {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
}

.toolbar {
    position: absolute;
    top: 10px;
    left: 10px;
    display: flex;
    gap: 16px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 100;
    align-items: center;
}

.toolbar-group {
    display: flex;
    gap: 12px;
    align-items: center;
}

.toolbar-group+.toolbar-group {
    padding-left: 16px;
    border-left: 1px solid #dcdfe6;
}

.model-tree-panel {
    position: absolute;
    top: 60px;
    right: 10px;
    width: 300px;
    max-height: calc(100% - 80px);
    background: rgba(255, 255, 255, 0.95);
    border-radius: 6px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    z-index: 100;
}

.model-tree-panel .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid #ebeef5;
    font-size: 14px;
    font-weight: 500;
}

.model-tree-panel .panel-body {
    flex: 1;
    overflow: auto;
    padding: 8px;
}

.scene-env-panel {
    position: fixed;
    top: 150px;
    right: 30px;
    width: 340px;
    max-height: calc(100% - 80px);
    background: rgba(255, 255, 255, 0.95);
    border-radius: 6px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    z-index: 9999;
}

.scene-env-panel .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid #ebeef5;
    font-size: 14px;
    font-weight: 500;
}

.scene-env-panel .panel-body {
    flex: 1;
    overflow: visible;
    padding: 8px 12px;
}
</style>

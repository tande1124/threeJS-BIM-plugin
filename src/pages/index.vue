<template>
    <div class="bim-plus-container">
        <!-- 场景A -->
        <InsBimPlusViewer class="bim-viewer" ref="bimViewer" @ready="onReady"
            @model-loaded="onModelLoaded" @error="onError" @gltf-pick="onPartClick" @label-click="onLabelClick" />
        <div class="toolbar">
            <div class="toolbar-group">
                <el-button type="primary" size="small" @click="loadTilesets">加载地形</el-button>
                <el-button type="primary" size="small" @click="loadBIM">加载bim</el-button>
                <el-button type="primary" size="small" @click="loadBIMOverlay">叠加载bim</el-button>
                <el-button type="primary" size="small" @click="loadLabels">加载标签</el-button>
            </div>

            <div class="toolbar-group">
                <el-button type="warning" size="small" @click="setSceneCoordinate">场景坐标配置</el-button>
                <el-button type="warning" size="small" @click="openSceneEnv">环境设置</el-button>
            </div>
            <div class="toolbar-group">
                <el-button type="success" size="small" @click="getModelInfo">模型信息</el-button>
                <el-button type="success" size="small" @click="resetView">回归视角</el-button>
                <el-button type="success" size="small" @click="flyToTileset">定位地形</el-button>
                <el-button type="success" size="small" @click="setModelMaterial">模型材质</el-button>
                <el-button type="success" size="small" @click="resetMaterial">重置材质</el-button>
            </div>
            <div class="toolbar-group">
                <el-button type="danger" size="small" @click="deleteModel">删除模型</el-button>
            </div>
        </div>
        <div class="operate-bar">
            <div class="toolbar-group">
                <el-switch v-model="envShow" active-text="环境" @change="handleSceneEvent" />
                <el-checkbox v-model="canansShow" @change="handleDualPassToggle">双透视</el-checkbox>
                <el-checkbox v-model="labelsVisible" @change="handleRenderLabels">标签</el-checkbox>
            </div>
            <div class="toolbar-group">
                <el-checkbox v-model="globalOutline" @change="handleGlobalOutline">全局描边</el-checkbox>
                <el-checkbox v-model="tileShow" @change="handleLayerToggle">地形</el-checkbox>
                <el-slider size="small" v-show="tileShow" v-model="tileOpacity" :min="0" :max="100" :step="1"
                    style="width: 80px;margin-right: 20px;" @input="handleTileOpacity" />
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
    </div>
</template>

<script>
import { createApp } from "vue";
import PartInfoLabel from "./PartInfoLabel.vue";
import ModelTree from "./ModelTree.vue";
import SceneEnvPanel from "./SceneEnvPanel.vue";
import { bimControls } from '../exports/bimControls'
import sceneConfig from '../config/scene-config'
import InsBimPlusViewer from "../components/InsBimViewer/index.vue";

export default {
    components: {
        InsBimPlusViewer,
        ModelTree,
        SceneEnvPanel,
    },
    data() {
        return {
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
            envConfig: sceneConfig.envConfig,
            controller: null, // 底层控制器实例
            envShow: true, // 环境显示
            tileShow: false, // 地形显示
            tileOpacity: 100, // 地形透明度 (0~100)
            canansShow: false, // 双透视显示
            globalOutline: false, // 全局描边
            labelsVisible: false, // 标签显示
            modelTreeData: null, // 模型树数据
            showModelTree: false, // 是否显示模型树面板
            showSceneEnvPanel: false,

            labelConfig: {
                // 图层组类型（同类型标签归为一组，便于整体显隐控制）
                type: "label",
                list: [
                    {
                        id: 1,
                        name: "料仓场地",
                        longitude: 98.348505,
                        latitude: 29.633465,
                        altitude: 2711.1,
                        model: "L05",
                        opts: {
                            ringColor: "#fff", // 圆环/涟漪/名称牌主题色
                            animationType: "bounce", // 动画类型：bounce / rotate / both / none
                            animEnabled: false, // 是否启用动画
                            scale: 200, // 整体缩放，BIM 场景较大建议 30-80
                            labelHeight: 0.2, // 图标离地高度
                            rippleEnabled: true, // 底部涟漪开关（原 ripple）
                            showName: true, // 是否显示名称牌
                            nameTagStyle: "stacked", // 名称牌样式：bubble / glow / plaque / stacked
                            nameTagHeight: 1.5, // 名称牌偏移距离
                            nameTagScale: 1, // 名称牌大小
                            nameTagRot: 0, // 名称牌旋转角度（度）
                            nameTagOrientation: "vertical", // 名称牌方向：vertical / horizontal
                            texture: "T0538", // 智能轻便型便携球机
                            rotation: 0, // 整体 Y 轴旋转角度（度）
                        },
                    },
                    {
                        id: 2,
                        name: "边坡", // 标签名称（显示在名称牌上）
                        longitude: 98.345574, // 经度
                        latitude: 29.650348, // 纬度
                        altitude: 2829.9, // 高程（米）
                        model: "L06",
                        opts: {
                            ringColor: "#fff", // 圆环/涟漪/名称牌主题色
                            animationType: "both", // 动画类型：bounce / rotate / both / none
                            animEnabled: true, // 是否启用动画
                            scale: 200, // 整体缩放，BIM 场景较大建议 30-80
                            labelHeight: 0.2, // 图标离地高度
                            rippleEnabled: true, // 底部涟漪开关（原 ripple）
                            showName: true, // 是否显示名称牌
                            nameTagStyle: "stacked", // 名称牌样式：bubble / glow / plaque / stacked
                            nameTagHeight: 1.5, // 名称牌偏移距离
                            nameTagScale: 1, // 名称牌大小
                            nameTagRot: 0, // 名称牌旋转角度（度）
                            nameTagOrientation: "vertical", // 名称牌方向：vertical / horizontal
                            texture: "T0513", // 固定球型摄像头（防爆）
                            rotation: 0, // 整体 Y 轴旋转角度（度）
                        },
                    },
                    {
                        id: 3,
                        name: "定位", // 标签名称（显示在名称牌上）
                        longitude: 98.351632, // 经度
                        latitude: 29.618925, // 纬度
                        altitude: 2632.9, // 高程（米）
                        model: "L01",
                        opts: {
                            ringColor: "#fff", // 圆环/涟漪/名称牌主题色
                            animationType: "both", // 动画类型：bounce / rotate / both / none
                            animEnabled: true, // 是否启用动画
                            scale: 200, // 整体缩放，BIM 场景较大建议 30-80
                            labelHeight: 0.2, // 图标离地高度
                            rippleEnabled: true, // 底部涟漪开关（原 ripple）
                            showName: true, // 是否显示名称牌
                            nameTagStyle: "stacked", // 名称牌样式：bubble / glow / plaque / stacked
                            nameTagHeight: 1.5, // 名称牌偏移距离
                            nameTagScale: 1, // 名称牌大小
                            nameTagRot: 0, // 名称牌旋转角度（度）
                            nameTagOrientation: "vertical", // 名称牌方向：vertical / horizontal
                            rotation: 0, // 整体 Y 轴旋转角度（度）
                        },
                    },
                ],
            },
        };
    },
    methods: {
        // 场景就绪后，给触发的那个 viewer 应用环境配置
        async onReady(controller) {
            const v = this.$refs.bimViewer;
            this.controller = controller;
            if (!v) return;
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
            this.$refs.bimViewer.showLoading('正加载地形…');
            await this.$refs.bimViewer.loadTilesets(this.tilesetSources);
            this.$refs.bimViewer.hideLoading();
        },
        async loadBIM() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.showLoading('正加载模型…');
            await this.$refs.bimViewer.loadGltfModels(this.gltfSources);
            this.$refs.bimViewer.hideLoading();
        },
        async loadBIMOverlay() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.showLoading('正加载模型…');
            await this.$refs.bimViewer.loadGltfModels([{
                id: "RM_1",
                name: "RM模型",
                url: "http://192.168.8.77:3000/data/gltf/rm/RM(1).glb",
            }]);
            this.$refs.bimViewer.hideLoading();
        },

        async deleteModel() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.removeModel("rm-tileset");
        },


        async loadLabels() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.showLoading('正加载标签…');
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
                this.$refs.bimViewer.setModelVisibleByType("3dtiles", this.tileShow);
            }
        },
        handleTileOpacity(val) {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.setTilesOpacity(val / 100);
            }
        },
        handleGlobalOutline(val) {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.setGlobalOutline(val);
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
            this.$refs.bimViewerA.resetCamera({
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
            this.$refs.bimViewer.setPartMaterial('引水工程', 'm29');
        },
        // 测试根据名称设置材质
        resetMaterial() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.setPartMaterial('引水工程', '');
        },
    },
};
</script>

<style lang="scss">
html,
body,
#app {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
}

.bim-plus-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
}

.bim-plus-container>.bim-viewer {
    flex: 1;
    min-width: 0;
    height: 100%;
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

.operate-bar {
    position: absolute;
    top: 60px;
    left: 10px;
    display: flex;
    gap: 8px;
    padding: 5px 12px;
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
    top: 120px;
    right: 20px;
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

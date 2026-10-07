<template>
  <el-form label-width="72px" size="small" @submit.prevent>
    <!-- 基础 -->
    <div class="env-section">基础</div>
    <el-form-item label="HDR 贴图">
      <el-switch v-model="cfg.envMapEnabled" @change="applyEnvMap" />
    </el-form-item>

    <!-- 主方向光 -->
    <div class="env-section">主方向光</div>
    <el-form-item label="强度">
      <el-input-number v-model="cfg.dirLight.intensity" :min="0" :max="10" :step="0.1" :precision="1" controls-position="right"
        @change="apply('dirLight.intensity', cfg.dirLight.intensity)" />
    </el-form-item>
    <el-form-item label="水平角度">
      <el-input-number v-model="cfg.dirLight.yaw" :min="0" :max="360" :step="5" controls-position="right"
        @change="apply('dirLight.yaw', cfg.dirLight.yaw)" />
    </el-form-item>
    <el-form-item label="俯仰角度">
      <el-input-number v-model="cfg.dirLight.pitch" :min="0" :max="90" :step="5" controls-position="right"
        @change="apply('dirLight.pitch', cfg.dirLight.pitch)" />
    </el-form-item>
    <el-form-item label="颜色">
      <el-color-picker v-model="cfg.dirLight.color" :show-alpha="false" :teleported="false"
        @change="apply('dirLight.color', cfg.dirLight.color)" />
    </el-form-item>
    
    <!-- 方向控制 -->
    <div class="env-section">方向控制</div>
    <el-form-item label="控制线">
      <el-switch v-model="showLightHelper" @change="onToggleLightHelper" />
    </el-form-item>

    <!-- 阴影 -->
    <div class="env-section">阴影</div>
    <el-form-item label="启用">
      <el-switch v-model="cfg.dirLight.shadow.enabled"
        @change="apply('dirLight.shadow.enabled', cfg.dirLight.shadow.enabled)" />
    </el-form-item>
    <template v-if="cfg.dirLight.shadow.enabled">
      <el-form-item label="分辨率">
        <el-select v-model="cfg.dirLight.shadow.resolution" :teleported="false"
          @change="apply('dirLight.shadow.resolution', cfg.dirLight.shadow.resolution)">
          <el-option label="1024" :value="1024" />
          <el-option label="2048" :value="2048" />
          <el-option label="4096" :value="4096" />
        </el-select>
      </el-form-item>
      <el-form-item label="范围">
        <el-input-number v-model="cfg.dirLight.shadow.range" :min="1" :step="10" controls-position="right"
          @change="apply('dirLight.shadow.range', cfg.dirLight.shadow.range)" />
      </el-form-item>
      <el-form-item label="X 偏移">
        <el-input-number v-model="cfg.dirLight.shadow.offsetX" :step="1" controls-position="right"
          @change="apply('dirLight.shadow.offsetX', cfg.dirLight.shadow.offsetX)" />
      </el-form-item>
      <el-form-item label="Y 偏移">
        <el-input-number v-model="cfg.dirLight.shadow.offsetY" :step="1" controls-position="right"
          @change="apply('dirLight.shadow.offsetY', cfg.dirLight.shadow.offsetY)" />
      </el-form-item>
      <el-form-item label="深度偏移">
        <el-input-number v-model="cfg.dirLight.shadow.bias" :min="-0.01" :max="0" :step="0.0001"
          :precision="4" controls-position="right"
          @change="apply('dirLight.shadow.bias', cfg.dirLight.shadow.bias)" />
      </el-form-item>
    </template>

    <!-- 环境光照 -->
    <div class="env-section">环境光照</div>
    <el-form-item label="IBL 强度">
      <el-input-number v-model="cfg.envLight.intensity" :min="0" :max="5" :step="0.1" :precision="1" controls-position="right"
        @change="apply('envLight.intensity', cfg.envLight.intensity)" />
    </el-form-item>
    <el-form-item label="背景强度">
      <el-input-number v-model="cfg.envLight.bgIntensity" :min="0" :max="5" :step="0.1" :precision="1" controls-position="right"
        @change="apply('envLight.bgIntensity', cfg.envLight.bgIntensity)" />
    </el-form-item>
    <el-form-item label="曝光度">
      <el-input-number v-model="cfg.envLight.exposure" :min="0" :max="5" :step="0.1" :precision="1" controls-position="right"
        @change="apply('envLight.exposure', cfg.envLight.exposure)" />
    </el-form-item>

    <el-button type="primary" plain class="w-full" @click="getCurrentEnv">打印环境配置</el-button>
  </el-form>
</template>

<script>
import { bimControls } from '../exports/bimControls'

export default {
  name: 'SceneEnvPanel',
  emits: ['close'],
  data() {
    return {
      cfg: this.defaultCfg(),
      showLightHelper: false,
    }
  },
  mounted() {
    this.loadConfig()
  },
  methods: {
    loadConfig() {
      const src = bimControls.getEnvConfig() ?? window.BizConfig?.sceneConfig?.envConfig
      if (src) {
        this.cfg = JSON.parse(JSON.stringify(src))
        // 防御：配置缺少 shadow 块时补全默认值，避免模板访问 undefined 属性崩溃
        if (!this.cfg.dirLight) {
          this.cfg.dirLight = { intensity: 1, yaw: 45, pitch: 50, color: '#ffffff' }
        }
        if (!this.cfg.dirLight.shadow) {
          this.cfg.dirLight.shadow = { enabled: true, resolution: 4096, range: 62, offsetX: 0, offsetY: 0, bias: -0.001 }
        }
        if (this.cfg.envMapEnabled === undefined) {
          this.cfg.envMapEnabled = true
        }
        if (!this.cfg.envLight) {
          this.cfg.envLight = { intensity: 1, bgIntensity: 1.5, exposure: 1 }
        }
      }
    },

    defaultCfg() {
      return {
        envMapEnabled: true,
        dirLight: {
          intensity: 1.5, yaw: 45, pitch: 50, color: '#ffffff',
          shadow: {
            enabled: true, resolution: 4096,
            range: 62, offsetX: 0, offsetY: 0, bias: -0.001,
          },
        },
        envLight: { intensity: 1, bgIntensity: 1.5, exposure: 1.3 },
      }
    },

    apply(key, value) {
      bimControls.setEnvParam(key, value)
    },

    applyEnvMap(val) {
      bimControls.controlEnvEnabled(val)
    },

    onToggleLightHelper(val) {
      bimControls.toggleLightHelper(val)
    },
    getCurrentEnv() {
        console.log(bimControls.getEnvConfig())
    }
  },
}
</script>

<style scoped>
.env-section {
  font-size: 12px;
  font-weight: 600;
  color: #409eff;
  margin: 12px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #ebeef5;
}
.env-section:first-child {
  margin-top: 2px;
}

:deep(.el-form-item) {
  margin-bottom: 8px;
}
:deep(.el-form-item__label) {
  font-size: 12px;
}
:deep(.el-input-number) {
  width: 140px;
}
:deep(.el-select) {
  width: 140px;
}
</style>

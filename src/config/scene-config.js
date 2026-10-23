/**
 * 场景配置（环境 + 相机）
 *
 * 使用方式：
 *   import sceneConfig from '@/config/scene-config'
 *   bimControls.applyEnvConfig(sceneConfig.envConfig)
 *   bimControls.resetCamera(sceneConfig.cameraConfig)
 */
export default {

  /**
   * 环境配置（天空/HDR/光照/曝光）
   */
  envConfig: {
    envMapEnabled: true,
    envLight: {
      intensity: 0.3,
      bgIntensity: 1.5,
      exposure: 1,
    },
    dirLight: {
      intensity: 1,
      yaw: 45,
      pitch: 50,
      color: '#ffffff',
      shadow: {
        enabled: true,
        resolution: 4096,
        range: 41,
        offsetX: 0,
        offsetY: 0,
        bias: -0.001,
      },
    },
    bloom: {
      enabled: false,
      strength: 0.001,
      radius: 0,
      threshold: 0,
    },
  },

  /**
   * 相机配置（初始位置/观察目标）
   *
   * 配置后场景加载完成时相机将定位到此处，不配置则自动聚焦到场景包围盒。
   */
  cameraConfig: {
    position: { x: 0, y: 3000, z: 4000 },
    target: { x: 0, y: 0, z: 0 },
  },
}

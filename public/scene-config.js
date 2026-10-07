/**
 * 场景配置（环境 + 相机 + 地理坐标）
 *
 * 使用方式：
 *   import sceneConfig from './bim-scene-config.js'
 *   bimControls.applyEnvConfig(sceneConfig.envConfig)
 *   bimControls.resetCamera(sceneConfig.cameraConfig)
 */
export default {

  /**
   * 环境配置（天空/HDR/光照/曝光）
   */
  envConfig: {
    // 启用 HDR 环境贴图
    envMapEnabled: true,

    // 主方向光
    dirLight: {
      intensity: 1,       // 光照强度
      yaw: 45,              // 水平角度（度）
      pitch: 50,            // 俯仰角度（度）
      color: '#ffffff',     // 光照颜色
      shadow: {
        enabled: true,       // 启用阴影
        resolution: 4096,    // 阴影贴图分辨率
        range: 41,           // 阴影投射范围
        offsetX: 0,          // 阴影 X 偏移
        offsetY: 0,          // 阴影 Y 偏移
        bias: -0.001         // 阴影深度偏移
      },
    },

    // 环境光照
    envLight: {
      intensity: 0.3,          // IBL 环境光强度
      bgIntensity: 1.5,      // HDR 背景强度
      exposure: 1       // 全局曝光度
    },
  },

  /**
   * 相机配置（初始位置/观察目标）
   *
   * 配置后场景加载完成时相机将定位到此处，不配置则自动聚焦到场景包围盒。
   */
  cameraConfig: {
    // 相机位置（场景坐标系）
    position: { x: 0, y: 3000, z: 4000 },
    // 相机观察目标点（OrbitControls target）
    target: { x: 0, y: 0, z: 0 },
  },

  // // 地理坐标原点配置
  // geoOrigin: {
  //   // 中央经线带号（度）。
  //   // 投影坐标系（如 CGCS2000 3度带）的中心经线，
  //   // 用于将模型局部坐标对齐到正确的投影带。
  //   centralMeridianDeg: 99,

  //   // 模型原点 (0,0,0) 对应的 CGCS2000 投影东坐标（米，含 500km 假东偏移）。
  //   // 即模型局部坐标零点在真实世界投影坐标系中的 X 位置。
  //   offsetX: 436200,

  //   // 模型原点 (0,0,0) 对应的 CGCS2000 投影北坐标（米）。
  //   // 即模型局部坐标零点在真实世界投影坐标系中的 Y 位置。
  //   offsetY: 3282400,

  //   // 模型原点 (0,0,0) 对应的高程（米）。
  //   // 每 +1 → 模型整体抬高 1 米，每 -1 → 降低 1 米。
  //   // 用于校正模型海拔与实际地形的偏差。
  //   offsetZ: 2000,

  //   // 垂直缩放比例。（1 = 原始比例不变；>1 拉伸地形起伏；<1 压缩地形起伏；参数可以为空）
  //   // 通常保持为 1，仅在需要夸张地形高差时调整。
  //   verticalScale: 1,
  // },
}

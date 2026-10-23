/**
 * 标签资源注册表
 *
 * 通过 ID 标识引用模型和贴图，避免在配置中书写完整路径。
 * ID 体系与 labels.json 对齐（模型 L01~L05，贴图 T0101~T0541）。
 * LabelRenderer 内部自动调用 resolveModel / resolveTexture 解析为实际路径。
 *
 * 使用方式：
 *   { model: 'L05', opts: { texture: 'T0538' } }
 *
 * 也兼容完整路径（包含 / 或 . 的值不经过注册表解析）：
 *   { model: './assets/model/label_e.glb' }
 */

const MODEL_BASE = './cdn/assets/model/'
const IMAGE_BASE = './cdn/assets/model/image/'

// ==================== 模型定义 ====================

/**
 * 模型资源列表（与 labels.json 对齐）。
 * id     — 唯一标识，用于配置中引用
 * key    — 模型代号
 * name   — 显示名称
 * model  — GLB 文件路径
 * textures — 该模型可用的贴图列表
 */
export const LABEL_ASSETS = [
  {
    key: 'label_a',
    id: 'L01',
    name: '标签 A',
    model: MODEL_BASE + 'label_a.glb',
    textures: [
      { file: IMAGE_BASE + 'label_a.jpg', name: '默认贴图', id: 'T0101' },
    ],
  },
  {
    key: 'label_b',
    id: 'L02',
    name: '标签 B',
    model: MODEL_BASE + 'label_b.glb',
    textures: [
      { file: IMAGE_BASE + 'label_b.jpg', name: '默认贴图', id: 'T0201' },
    ],
  },
  {
    key: 'label_c',
    id: 'L03',
    name: '标签 C',
    model: MODEL_BASE + 'label_c.glb',
    textures: [
      { file: IMAGE_BASE + 'label_c.jpg', name: '默认贴图', id: 'T0301' },
    ],
  },
  {
    key: 'label_d',
    id: 'L04',
    name: '标签 D',
    model: MODEL_BASE + 'label_d.glb',
    textures: [
      { file: IMAGE_BASE + 'label_d.jpg', name: '默认贴图', id: 'T0401' },
    ],
  },
  {
    key: 'label_e',
    id: 'L05',
    name: '标签 E',
    model: MODEL_BASE + 'label_e.glb',
    textures: [
      { file: IMAGE_BASE + 'security_computer.jpg', name: '安防计算机', id: 'T0501' },
      { file: IMAGE_BASE + 'helmet_tag.jpg', name: '安全帽型定位标签', id: 'T0502' },
      { file: IMAGE_BASE + 'veh_speed.jpg', name: '车辆测速一体机', id: 'T0503' },
      { file: IMAGE_BASE + 'gate_fence.jpg', name: '车辆道闸（栅栏型）', id: 'T0504' },
      { file: IMAGE_BASE + 'gate_straight.jpg', name: '车辆道闸（直杆型）', id: 'T0505' },
      { file: IMAGE_BASE + 'veh_mon.jpg', name: '车辆监控主体', id: 'T0506' },
      { file: IMAGE_BASE + 'veh_pos.jpg', name: '车载定位终端', id: 'T0507' },
      { file: IMAGE_BASE + 'settle_ring.jpg', name: '沉降环', id: 'T0508' },
      { file: IMAGE_BASE + 'road_warn.jpg', name: '道路预警机', id: 'T0509' },
      { file: IMAGE_BASE + 'hang_tag.jpg', name: '吊牌型定位标签', id: 'T0510' },
      { file: IMAGE_BASE + 'loc_base.jpg', name: '定位基站', id: 'T0511' },
      { file: IMAGE_BASE + 'ind_veh.jpg', name: '工业车辆', id: 'T0512' },
      { file: IMAGE_BASE + 'cam_bullet.jpg', name: '固定枪机', id: 'T0513' },
      { file: IMAGE_BASE + 'cam_expl_dome.jpg', name: '固定球型摄像头（防爆）', id: 'T0514' },
      { file: IMAGE_BASE + 'cam_smart_dome.jpg', name: '固定智能球型摄像头', id: 'T0515' },
      { file: IMAGE_BASE + 'mgmt_staff.jpg', name: '管理人员', id: 'T0516' },
      { file: IMAGE_BASE + 'led_screen.jpg', name: '户外LED大屏', id: 'T0517' },
      { file: IMAGE_BASE + 'env_mon.jpg', name: '环境监控', id: 'T0518' },
      { file: IMAGE_BASE + 'concrete_veh.jpg', name: '混凝土车辆', id: 'T0519' },
      { file: IMAGE_BASE + 'mon_point.jpg', name: '监测点', id: 'T0520' },
      { file: IMAGE_BASE + 'control_host.jpg', name: '控制主机', id: 'T0521' },
      { file: IMAGE_BASE + 'flow_meter.jpg', name: '流量计', id: 'T0522' },
      { file: IMAGE_BASE + 'ord_veh.jpg', name: '普通车辆', id: 'T0523' },
      { file: IMAGE_BASE + 'crane.jpg', name: '起重机', id: 'T0524' },
      { file: IMAGE_BASE + 'weather_mon.jpg', name: '气象监测', id: 'T0525' },
      { file: IMAGE_BASE + 'tri_gate.jpg', name: '三辊闸', id: 'T0526' },
      { file: IMAGE_BASE + 'video_storage.jpg', name: '视频监控存储设备', id: 'T0527' },
      { file: IMAGE_BASE + 'video_server.jpg', name: '视频平台管理服务器', id: 'T0528' },
      { file: IMAGE_BASE + 'comm_terminal.jpg', name: '收扩机（通讯终端）', id: 'T0529' },
      { file: IMAGE_BASE + 't_crane.jpg', name: '塔吊', id: 'T0530' },
      { file: IMAGE_BASE + 'gen_veh.jpg', name: '通用车辆', id: 'T0531' },
      { file: IMAGE_BASE + 'soil_gauge.jpg', name: '土体位移计', id: 'T0532' },
      { file: IMAGE_BASE + 'haz_chem.jpg', name: '危化品', id: 'T0533' },
      { file: IMAGE_BASE + 'wireless_bridge.jpg', name: '无线网桥', id: 'T0534' },
      { file: IMAGE_BASE + 'pressure_vessel.jpg', name: '压力容器', id: 'T0535' },
      { file: IMAGE_BASE + 'dust_mon.jpg', name: '扬尘监测', id: 'T0536' },
      { file: IMAGE_BASE + 'flap_gate.jpg', name: '翼闸（左中右）', id: 'T0537' },
      { file: IMAGE_BASE + 'cam_dome.jpg', name: '智能轻便型便携球机', id: 'T0538' },
      { file: IMAGE_BASE + 'ai_server.jpg', name: '智能巡检AI服务器', id: 'T0539' },
      { file: IMAGE_BASE + 'sewage.jpg', name: '污水', id: 'T0540' },
      { file: IMAGE_BASE + 'dust_noise.jpg', name: '扬尘噪声', id: 'T0541' },
    ],
  },
  {
    key: 'label_e2',
    id: 'L06',
    name: '标签 E2',
    model: MODEL_BASE + 'label_e2.glb',
    textures: [], // 复用 L05 的贴图
  },
]

// ==================== 内部索引 ====================

/** 模型 ID → 资源条目 */
const modelById = new Map()
/** 贴图 ID → { file, name, id } */
const textureById = new Map()

for (const asset of LABEL_ASSETS) {
  modelById.set(asset.id, asset)
  for (const tex of asset.textures) {
    textureById.set(tex.id, tex)
  }
}

/** 默认模型 ID */
export const DEFAULT_MODEL_ID = 'L06'

// ==================== 解析函数 ====================

/**
 * 将模型标识解析为实际文件路径。
 * - 支持 ID（如 `L05`）、key（如 `label_e`）
 * - 包含 `/` 或 `.` 的值视为完整路径，直接返回
 * @param {string} key - 模型 ID、key 或路径
 * @returns {string}
 */
export function resolveModel(key) {
  if (!key) return modelById.get(DEFAULT_MODEL_ID).model
  if (key.includes('/') || key.includes('.')) return key
  // 按 ID 查找
  const byId = modelById.get(key)
  if (byId) return byId.model
  // 按 key 查找
  const byKey = LABEL_ASSETS.find((a) => a.key === key)
  if (byKey) return byKey.model
  return modelById.get(DEFAULT_MODEL_ID).model
}

/**
 * 将贴图标识解析为实际文件路径。
 * - 支持 ID（如 `T0538`）
 * - 包含 `/` 或 `.` 的值视为完整路径，直接返回
 * - 空字符串返回空（不贴图）
 * @param {string} key - 贴图 ID 或路径
 * @returns {string}
 */
export function resolveTexture(key) {
  if (!key) return ''
  if (key.includes('/') || key.includes('.')) return key
  const tex = textureById.get(key)
  return tex ? tex.file : ''
}

import type * as THREE from 'three';

export type Vec3 = [number, number, number];

/** 动画部件：由 build 放到 group.userData.parts，animate 读取。各资产自定义结构 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Parts = Record<string, any>;

export type AssetSource = 'procedural' | 'user';

/** 资产包内的程序化资产定义（键名在包内唯一） */
export interface ProceduralAsset {
  name: string;
  cat: string;
  icon: string;
  color: string;
  build: (color: string) => THREE.Group;
  animate?: (parts: Parts, t: number, dt: number) => void;
  /** 默认锁定（如水域），防止在视口中误选 */
  locked?: boolean;
  /** 放置时的默认高度 */
  placeY?: number;
  tags?: string[];
  /** 静态部件合并优化：默认开启；带动画部件的子树不会被合并 */
  optimize?: boolean;
}

/** 注册表中的统一资产描述（程序化资产与用户资产共用） */
export interface AssetDef {
  /** 全局 ID：`<packId>/<key>` 或 `user/<uuid>` */
  id: string;
  packId: string;
  key: string;
  source: AssetSource;
  name: string;
  /** 分类 ID（包内） */
  cat: string;
  icon: string;
  color: string;
  tags: string[];
  /** 可着色：程序化资产可改主色；用户模型保留原材质 */
  colorable: boolean;
  locked?: boolean;
  placeY?: number;
  build: (color: string) => THREE.Group;
  animate?: (parts: Parts, t: number, dt: number) => void;
  optimize: boolean;
  /** 缩略图（用户资产导入时生成；程序化资产运行时渲染） */
  thumbnail?: string;
}

export interface CategoryDef {
  id: string;
  name: string;
}

/** 行业资产包：新增行业 = 新增一个资产包，不改编辑器内核 */
export interface AssetPack {
  id: string;
  name: string;
  /** 行业标识，如 general / shipbuilding / warehouse / chemical */
  industry: string;
  description?: string;
  categories: CategoryDef[];
  assets: Record<string, ProceduralAsset>;
  scenes?: Record<string, SceneDef>;
}

export interface SceneDef {
  name: string;
  description?: string;
  build: () => LayoutData;
}

// ---------- 布局数据（保存 / 导入导出格式） ----------
export interface EnvSettings {
  name: string;
  ground: { w: number; d: number; cx: number; cz: number };
  groundColor: string;
  background: string;
  fog: boolean;
  grid: boolean;
  shadows: boolean;
  sun: { intensity: number; azimuth: number; elevation: number };
  camera?: { pos: Vec3; target: Vec3 };
}

interface LayoutBase {
  uid?: number;
  name?: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  locked?: boolean;
  hidden?: boolean;
}
export interface ComponentItem extends LayoutBase {
  kind?: 'component';
  /** 资产 ID；兼容旧版不带命名空间的键名（如 "forklift"） */
  type: string;
  color?: string;
}
export interface GroupItem extends LayoutBase {
  kind: 'group';
  children: LayoutItem[];
}
/** v3 旧格式中未持久化的自定义模型引用，载入时以占位框显示 */
export interface LegacyCustomItem extends LayoutBase {
  kind: 'custom';
  ref: string;
}
export type LayoutItem = ComponentItem | GroupItem | LegacyCustomItem;

export interface LayoutData {
  app?: string;
  version?: number;
  env?: Partial<EnvSettings>;
  objects: LayoutItem[];
}

// ---------- 用户 3D 资产（资产管理） ----------
export type UpAxis = 'y' | 'z';
export type PivotMode = 'bottom-center' | 'center' | 'keep';

export interface ImportOptions {
  /** 源文件单位 → 米 的换算系数，如 mm = 0.001 */
  unitScale: number;
  upAxis: UpAxis;
  pivot: PivotMode;
}

export interface ModelStats {
  triangles: number;
  meshes: number;
  materials: number;
  textures: number;
  /** 导入处理后的尺寸（米） */
  size: Vec3;
}

export interface UserAssetMeta {
  id: string;
  name: string;
  cat: string;
  tags: string[];
  industry: string;
  description: string;
  fileName: string;
  fileSize: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  import: ImportOptions;
  stats: ModelStats;
  thumbnail: string;
}

export interface UserAssetRecord extends UserAssetMeta {
  data: ArrayBuffer;
}

/** 项目包：布局 + 引用到的用户资产（base64），便于完整迁移 */
export interface ProjectBundle {
  app: 'FactoryForge';
  format: 'project';
  version: number;
  layout: LayoutData;
  assets: (UserAssetMeta & { dataBase64: string })[];
}

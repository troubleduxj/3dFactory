import type { ImportOptions, LayoutData, ModelStats, ProjectBundle, UserAssetMeta, Vec3 } from '../core/types';

/**
 * 导入数据的运行时 schema 校验（项目包资产、布局文件）。
 * 纯函数模块，不依赖 three.js，便于在 Node 环境中单测。
 */

/** 用户资产 ID：user/<uuid> */
export const USER_ASSET_ID = /^user\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 缩略图只接受 PNG data URI */
export const THUMB_PREFIX = 'data:image/png;base64,';

/** 合法的缩略图原样返回，否则返回空字符串 */
export function safeThumbnail(t: unknown): string {
  if (typeof t !== 'string' || !t.startsWith(THUMB_PREFIX)) return '';
  return /^[A-Za-z0-9+/=]*$/.test(t.slice(THUMB_PREFIX.length)) ? t : '';
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export type BundleAsset = UserAssetMeta & { dataBase64: string };

/** 校验项目包中的单个资产；不合格时抛出中文错误。返回只含白名单字段的新对象 */
export function validateBundleAsset(a: unknown): { asset: BundleAsset; thumbnailOk: boolean } {
  if (!isObj(a)) throw new Error('资产条目不是对象');
  const id = a.id;
  if (typeof id !== 'string' || !USER_ASSET_ID.test(id)) throw new Error(`资产 ID 不合法（必须是 user/<uuid>）：${String(id).slice(0, 60)}`);
  const fail = (field: string, what: string): never => { throw new Error(`资产 ${id} 的字段 ${field} 必须是${what}`); };
  const str = (o: Obj, k: string, field = k, def?: string): string => {
    const v = o[k] === undefined && def !== undefined ? def : o[k];
    return typeof v === 'string' ? v : fail(field, '字符串');
  };
  const num = (o: Obj, k: string, field = k): number => (isNum(o[k]) ? (o[k] as number) : fail(field, '数字'));

  const tags = a.tags;
  if (!Array.isArray(tags) || !tags.every(t => typeof t === 'string')) fail('tags', '字符串数组');

  const version = num(a, 'version');
  if (!Number.isInteger(version) || version < 1) fail('version', '不小于 1 的整数');

  if (!isObj(a.stats)) fail('stats', '对象');
  const s = a.stats as Obj;
  const size = s.size;
  if (!Array.isArray(size) || size.length !== 3 || !size.every(isNum)) fail('stats.size', '3 个数字组成的数组');
  const stats: ModelStats = {
    triangles: num(s, 'triangles', 'stats.triangles'),
    meshes: num(s, 'meshes', 'stats.meshes'),
    materials: num(s, 'materials', 'stats.materials'),
    textures: num(s, 'textures', 'stats.textures'),
    size: [...(size as number[])] as Vec3,
  };

  if (!isObj(a.import)) fail('import', '对象');
  const im = a.import as Obj;
  if (!isNum(im.unitScale) || im.unitScale <= 0) fail('import.unitScale', '正数');
  if (im.upAxis !== 'y' && im.upAxis !== 'z') fail('import.upAxis', ' y 或 z');
  if (im.pivot !== 'bottom-center' && im.pivot !== 'center' && im.pivot !== 'keep') fail('import.pivot', ' bottom-center / center / keep 之一');
  const imp: ImportOptions = { unitScale: im.unitScale as number, upAxis: im.upAxis as ImportOptions['upAxis'], pivot: im.pivot as ImportOptions['pivot'] };

  const thumbnail = safeThumbnail(a.thumbnail);
  const asset: BundleAsset = {
    id,
    name: str(a, 'name'),
    cat: str(a, 'cat'),
    tags: [...(tags as string[])],
    // 早期导出的项目包可能缺少 industry / description
    industry: str(a, 'industry', 'industry', 'general'),
    description: str(a, 'description', 'description', ''),
    fileName: str(a, 'fileName'),
    fileSize: num(a, 'fileSize'),
    version,
    createdAt: num(a, 'createdAt'),
    updatedAt: num(a, 'updatedAt'),
    import: imp,
    stats,
    thumbnail,
    dataBase64: str(a, 'dataBase64'),
  };
  return { asset, thumbnailOk: thumbnail !== '' };
}

const isVec3 = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every(isNum);

function checkItem(item: unknown, path: string): void {
  const bad = (why: string): never => { throw new Error(`布局文件无效：${path} ${why}`); };
  if (!isObj(item)) bad('不是对象');
  const it = item as Obj;
  for (const k of ['name', 'color'] as const) if (it[k] !== undefined && typeof it[k] !== 'string') bad(`的 ${k} 必须是字符串`);
  for (const k of ['position', 'rotation', 'scale'] as const) if (it[k] !== undefined && !isVec3(it[k])) bad(`的 ${k} 必须是 3 个数字`);
  if (it.uid !== undefined && !isNum(it.uid)) bad('的 uid 必须是数字');
  for (const k of ['locked', 'hidden'] as const) if (it[k] !== undefined && typeof it[k] !== 'boolean') bad(`的 ${k} 必须是布尔值`);
  if (it.kind === 'group') {
    if (!Array.isArray(it.children)) bad('的 children 必须是数组');
    (it.children as unknown[]).forEach((c, i) => checkItem(c, `${path}.children[${i}]`));
  } else if (it.kind === 'custom') {
    if (typeof it.ref !== 'string') bad('的 ref 必须是字符串');
  } else if (it.kind === undefined || it.kind === 'component') {
    // 兼容旧版不带命名空间的裸键名（如 "forklift"）
    if (typeof it.type !== 'string') bad('的 type 必须是字符串');
  } else {
    bad(`的 kind 未知：${String(it.kind).slice(0, 30)}`);
  }
}

/** 校验布局数据（兼容 v3 旧格式）；通过后原样返回，不裁剪字段 */
export function validateLayout(data: unknown): LayoutData {
  if (!isObj(data)) throw new Error('布局文件无效：不是对象');
  if (!Array.isArray(data.objects)) throw new Error('布局文件无效：缺少 objects 数组');
  if (data.env !== undefined && !isObj(data.env)) throw new Error('布局文件无效：env 必须是对象');
  data.objects.forEach((it, i) => checkItem(it, `objects[${i}]`));
  return data as unknown as LayoutData;
}

/** 校验项目包外层结构；单个资产由 unpackAssets 逐个校验 */
export function validateProjectBundle(data: unknown): ProjectBundle {
  if (!isObj(data) || data.format !== 'project') throw new Error('项目包无效：format 不是 project');
  const layout = validateLayout(data.layout);
  const assets = data.assets === undefined ? [] : data.assets;
  if (!Array.isArray(assets)) throw new Error('项目包无效：assets 必须是数组');
  return { ...(data as unknown as ProjectBundle), layout, assets };
}

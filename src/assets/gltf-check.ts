/**
 * glTF 自包含检查（纯函数，不依赖 three.js，便于在 Node 环境中单测）。
 * 离线部署要求导入的模型不得引用任何外部资源：buffers / images 的 uri 只允许 data:。
 */
const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'

/** 读出 glTF JSON：GLB 读取第一个 chunk，.gltf 整体按 UTF-8 解码；无法解析时返回 null（交给 GLTFLoader 报格式错误） */
export function readGltfJson(data: ArrayBuffer): unknown | null {
  try {
    const dv = new DataView(data);
    if (data.byteLength >= 20 && dv.getUint32(0, true) === GLB_MAGIC) {
      const len = dv.getUint32(12, true);
      if (dv.getUint32(16, true) !== CHUNK_JSON || 20 + len > data.byteLength) return null;
      return JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, len)));
    }
    const text = new TextDecoder().decode(new Uint8Array(data)).replace(/^\uFEFF/, '');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 找出 buffers[].uri / images[].uri 中非 data: 的 URI（无 uri 的 buffer / 使用 bufferView 的 image 允许） */
export function findExternalUris(json: unknown): string[] {
  const out: string[] = [];
  if (typeof json !== 'object' || json === null) return out;
  for (const key of ['buffers', 'images'] as const) {
    const list = (json as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item !== 'object' || item === null || !('uri' in item)) continue;
      const uri = (item as { uri: unknown }).uri;
      if (uri === undefined) continue;
      if (typeof uri !== 'string') out.push(String(uri));
      else if (!/^data:/i.test(uri.trim())) out.push(uri);
    }
  }
  return out;
}

/** 解析前检查：存在外链时抛出中文错误 */
export function assertSelfContained(data: ArrayBuffer): void {
  const json = readGltfJson(data);
  if (json === null) return;
  const list = findExternalUris(json);
  if (!list.length) return;
  const shown = list.slice(0, 3).map(u => u.slice(0, 120)).join(', ') + (list.length > 3 ? ` 等 ${list.length} 项` : '');
  throw new Error(`模型引用了外部资源，已拒绝导入（离线部署不允许联网加载）：${shown}。请先打包为自包含的 .glb，或将资源以 data URI 内嵌。`);
}

/** URL 修改器的判定：只允许 data: 与 blob: */
export function isAllowedResourceUrl(url: string): boolean {
  return /^(data|blob):/i.test(url);
}

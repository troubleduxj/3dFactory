/**
 * glTF 自包含检查（纯函数，不依赖 three.js，便于在 Node 环境中单测）。
 * 离线部署要求导入的模型不得引用任何外部资源：buffers / images 的 uri 只允许 data:。
 */
const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const GLB_HEADER = 12;
const CHUNK_HEADER = 8;

interface GlbChunk { type: number; offset: number; length: number }

/** 与 GLTFLoader 一致：前 4 字节为 'glTF' 即按 GLB 处理 */
function isGlb(data: ArrayBuffer): boolean {
  return data.byteLength >= 4 && new DataView(data).getUint32(0, true) === GLB_MAGIC;
}

function glbError(reason: string): Error {
  return new Error(`GLB 文件结构异常，已拒绝导入：${reason}。请用常规建模工具重新导出 .glb。`);
}

/**
 * 遍历 GLB 全部 chunk（与 three GLTFBinaryExtension 相同：在头部声明的总长度内依次读取）。
 * 越界或长度未按 4 字节对齐时抛出中文错误，保证预检看到的 chunk 与加载器一致。
 */
function readGlbChunks(data: ArrayBuffer): GlbChunk[] {
  if (data.byteLength < GLB_HEADER) throw glbError('文件头不完整');
  const dv = new DataView(data);
  const total = dv.getUint32(8, true);
  if (total > data.byteLength) throw glbError(`头部声明长度 ${total} 超出文件大小 ${data.byteLength}`);
  const chunks: GlbChunk[] = [];
  let pos = GLB_HEADER;
  while (pos < total) {
    if (pos + CHUNK_HEADER > total) throw glbError(`第 ${chunks.length + 1} 个 chunk 头越界`);
    const length = dv.getUint32(pos, true);
    const type = dv.getUint32(pos + 4, true);
    const offset = pos + CHUNK_HEADER;
    if (length % 4 !== 0) throw glbError(`第 ${chunks.length + 1} 个 chunk 长度未按 4 字节对齐`);
    if (offset + length > total) throw glbError(`第 ${chunks.length + 1} 个 chunk 长度越界`);
    chunks.push({ type, offset, length });
    pos = offset + length;
  }
  return chunks;
}

function parseChunkJson(data: ArrayBuffer, c: GlbChunk): unknown | null {
  try {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(data, c.offset, c.length)));
  } catch {
    return null;
  }
}

/** 读出 glTF JSON：GLB 读取第一个 JSON chunk，.gltf 整体按 UTF-8 解码；无法解析时返回 null（交给 GLTFLoader 报格式错误） */
export function readGltfJson(data: ArrayBuffer): unknown | null {
  try {
    if (isGlb(data)) {
      const c = readGlbChunks(data).find(x => x.type === CHUNK_JSON);
      return c ? parseChunkJson(data, c) : null;
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

function assertNoExternalUris(json: unknown): void {
  const list = findExternalUris(json);
  if (!list.length) return;
  const shown = list.slice(0, 3).map(u => u.slice(0, 120)).join(', ') + (list.length > 3 ? ` 等 ${list.length} 项` : '');
  throw new Error(`模型引用了外部资源，已拒绝导入（离线部署不允许联网加载）：${shown}。请先打包为自包含的 .glb，或将资源以 data URI 内嵌。`);
}

/**
 * 解析前检查：存在外链时抛出中文错误。
 * GLB 会检查全部 JSON chunk（GLTFLoader 使用最后一个），并拒绝结构异常的文件：
 * chunk 越界 / 未对齐、第一个 chunk 不是 JSON、含多个 JSON chunk、没有 JSON chunk。
 */
export function assertSelfContained(data: ArrayBuffer): void {
  if (isGlb(data)) {
    const chunks = readGlbChunks(data);
    const jsons = chunks.filter(c => c.type === CHUNK_JSON);
    for (const c of jsons) {
      const json = parseChunkJson(data, c);
      if (json !== null) assertNoExternalUris(json);
    }
    if (!jsons.length) throw glbError('缺少 JSON chunk');
    if (chunks[0].type !== CHUNK_JSON) throw glbError('第一个 chunk 不是 JSON');
    if (jsons.length > 1) throw glbError(`包含 ${jsons.length} 个 JSON chunk`);
    return;
  }
  const json = readGltfJson(data);
  if (json !== null) assertNoExternalUris(json);
}

/** URL 修改器的判定：只允许 data: 与 blob: */
export function isAllowedResourceUrl(url: string): boolean {
  return /^(data|blob):/i.test(url);
}

/** LoadingManager 的 URL 修改器：非 data: / blob: 的请求一律抛错（纵深防御，预检被绕过时也不会联网） */
export function blockExternalUrl(url: string): string {
  if (isAllowedResourceUrl(url)) return url;
  throw new Error('已阻止外部资源请求：' + url);
}

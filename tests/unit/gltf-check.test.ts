import './setup-dom';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertSelfContained, findExternalUris, isAllowedResourceUrl, readGltfJson } from '../../src/assets/gltf-check';
import { parseModel } from '../../src/assets/importer';

const toBuf = (u8: Uint8Array): ArrayBuffer => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
/** .gltf：JSON 文本 */
const enc = (obj: unknown): ArrayBuffer => toBuf(new TextEncoder().encode(JSON.stringify(obj)));
/** 最小 GLB：12 字节头 + JSON chunk（4 字节对齐，空格补齐），不带 BIN chunk */
function glb(obj: unknown): ArrayBuffer {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  const len = Math.ceil(raw.length / 4) * 4;
  const out = new Uint8Array(20 + len);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, len, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20);
  out.set(raw, 20);
  return out.buffer;
}
const asset = { version: '2.0' };

describe('glTF 自包含检查', () => {
  it('buffers 含 https 外链时拒绝，错误信息包含 URL', () => {
    const url = 'https://evil.example/a.bin';
    expect(() => assertSelfContained(enc({ asset, buffers: [{ uri: url, byteLength: 4 }] }))).toThrow(/外部资源.*evil\.example/);
  });

  it('images 外链、相对路径、协议相对地址都被拒绝', () => {
    for (const uri of ['http://x/t.png', 'scene.bin', '//cdn/x']) {
      const key = uri.endsWith('.png') ? 'images' : 'buffers';
      expect(() => assertSelfContained(enc({ asset, [key]: [{ uri }] }))).toThrow('外部资源');
    }
    expect(findExternalUris({ images: [{ uri: 42 }] })).toEqual(['42']);
  });

  it('data: URI 通过', () => {
    expect(() => assertSelfContained(enc({ asset, buffers: [{ uri: 'data:application/octet-stream;base64,AAAAAA==', byteLength: 4 }] }))).not.toThrow();
  });

  it('GLB：无 uri 的 buffer、bufferView 图片通过；JSON chunk 含外链时拒绝', () => {
    expect(() => assertSelfContained(glb({ asset, buffers: [{ byteLength: 4 }], images: [{ bufferView: 0, mimeType: 'image/png' }] }))).not.toThrow();
    expect(() => assertSelfContained(glb({ asset, images: [{ uri: 'https://evil.example/t.png' }] }))).toThrow('外部资源');
    expect(readGltfJson(glb({ asset }))).toEqual({ asset });
  });

  it('非 glTF 数据返回 null，不在此处报错', () => {
    const junk = new Uint8Array(64).map((_, i) => (i * 37 + 11) % 256).buffer;
    expect(readGltfJson(junk)).toBeNull();
    expect(() => assertSelfContained(junk)).not.toThrow();
  });

  it('真实 GLB fixture 不会被误判', () => {
    const f = readFileSync(fileURLToPath(new URL('../e2e/fixtures/test-block.glb', import.meta.url)));
    expect(() => assertSelfContained(toBuf(f))).not.toThrow();
  });

  it('URL 修改器只放行 data: / blob:', () => {
    expect(isAllowedResourceUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isAllowedResourceUrl('blob:http://localhost/0f8fad5b')).toBe(true);
    for (const u of ['https://a', 'http://localhost/x', 'file:///x', 'scene.bin']) expect(isAllowedResourceUrl(u)).toBe(false);
  });

  it('parseModel 在解析前拒绝外链 .gltf', async () => {
    await expect(parseModel(enc({ asset, buffers: [{ uri: 'https://evil.example/a.bin', byteLength: 4 }] }))).rejects.toThrow('外部资源');
  });
});

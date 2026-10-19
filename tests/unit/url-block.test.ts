import './setup-dom';
import { describe, expect, it, vi } from 'vitest';

// 跳过解析前的预检，直接验证 LoadingManager 的 URL 修改器（纵深防御）能拦下外部请求
vi.mock('../../src/assets/gltf-check', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/assets/gltf-check')>()),
  assertSelfContained: () => {},
}));

import { parseModel } from '../../src/assets/importer';

/** 完整引用链：scene → node → mesh → accessor → bufferView → 外链 buffer，GLTFLoader 解析时一定会请求该 buffer */
const gltf = (uri: string) => ({
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  buffers: [{ uri, byteLength: 36 }],
});
const enc = (obj: unknown): ArrayBuffer => new TextEncoder().encode(JSON.stringify(obj)).buffer as ArrayBuffer;

describe('URL 修改器拦截（预检被绕过时）', () => {
  it('http / 协议相对 / 相对路径的 buffer 请求被拦截', async () => {
    for (const uri of ['http://127.0.0.1:1/a.bin', '//cdn.example/a.bin', 'scene.bin'])
      await expect(parseModel(enc(gltf(uri)))).rejects.toThrow('已阻止外部资源请求');
  });
});

import './setup-dom';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AssetRegistry } from '../../src/core/registry';
import { UserAssetLibrary } from '../../src/assets/library';
import { MemoryAssetStore, bufferToBase64 } from '../../src/assets/store';

const GLB = readFileSync(fileURLToPath(new URL('../e2e/fixtures/test-block.glb', import.meta.url)));
const glbBase64 = bufferToBase64(GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength));

const ID = 'user/0f8fad5b-d9cb-469f-a165-70867728950e';
const asset = (patch: Record<string, unknown> = {}) => ({
  id: ID, name: '设备', cat: 'c', tags: [], industry: 'general', description: '', fileName: 'a.glb', fileSize: GLB.byteLength,
  version: 1, createdAt: 1, updatedAt: 1, import: { unitScale: 1, upAxis: 'y', pivot: 'bottom-center' },
  stats: { triangles: 12, meshes: 1, materials: 1, textures: 0, size: [1, 1, 1] }, thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
  dataBase64: glbBase64, ...patch,
});
const mk = () => {
  const store = new MemoryAssetStore();
  const registry = new AssetRegistry();
  return { store, registry, lib: new UserAssetLibrary(store, registry) };
};

describe('UserAssetLibrary.unpackAssets', () => {
  it('包含非 user/ 前缀资产时整体拒绝，且不写库', async () => {
    const { store, registry, lib } = mk();
    await expect(lib.unpackAssets([asset(), asset({ id: 'common/forklift' })])).rejects.toThrow('已拒绝导入');
    expect(await store.list()).toHaveLength(0);
    expect(registry.byPack('user')).toHaveLength(0);
  });

  it('模型数据无法解析时拒绝，且不写库（先解析后写库）', async () => {
    const { store, lib } = mk();
    await expect(lib.unpackAssets([asset({ dataBase64: btoa('not a model') })])).rejects.toThrow('已拒绝导入');
    await expect(lib.unpackAssets([asset({ dataBase64: '!!!' })])).rejects.toThrow('已拒绝导入');
    expect(await store.list()).toHaveLength(0);
  });

  it('资产列表不是数组时拒绝', async () => {
    const { lib } = mk();
    await expect(lib.unpackAssets({})).rejects.toThrow('资产列表无效');
  });

  it('合法资产导入成功', async () => {
    const { store, registry, lib } = mk();
    expect(await lib.unpackAssets([asset()])).toBe(1);
    expect(await store.list()).toHaveLength(1);
    expect(registry.get(ID)?.thumbnail).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('缩略图含属性注入时仍可导入，但原值被丢弃', async () => {
    const { store, registry, lib } = mk();
    const evil = 'x" onerror="alert(1)';
    expect(await lib.unpackAssets([asset({ thumbnail: evil })])).toBe(1);
    const rec = (await store.list())[0];
    expect(rec.thumbnail).not.toBe(evil);
    expect(registry.get(ID)?.thumbnail).not.toContain('"');
  });
});

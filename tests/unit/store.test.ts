import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IdbAssetStore, MemoryAssetStore, base64ToBuffer, bufferToBase64, metaOf } from '../../src/assets/store';
import type { UserAssetRecord } from '../../src/core/types';

const rec = (id: string, createdAt: number): UserAssetRecord => ({
  id, name: id, cat: 'c', tags: ['t'], industry: 'general', description: '', fileName: 'a.glb', fileSize: 3,
  version: 1, createdAt, updatedAt: createdAt, import: { unitScale: 1, upAxis: 'y', pivot: 'bottom-center' },
  stats: { triangles: 12, meshes: 1, materials: 1, textures: 0, size: [1, 1, 1] }, thumbnail: '',
  data: new Uint8Array([1, 2, 3]).buffer,
});

describe('asset stores', () => {
  for (const [name, mk] of [['IndexedDB', () => new IdbAssetStore(new IDBFactory() as unknown as typeof globalThis.indexedDB)], ['memory', () => new MemoryAssetStore()]] as const) {
    it(`${name}: put / get / list / remove`, async () => {
      const s = mk();
      await s.put(rec('user/b', 2));
      await s.put(rec('user/a', 1));
      expect((await s.list()).map(r => r.id)).toEqual(['user/a', 'user/b']);
      const got = await s.get('user/a');
      expect(new Uint8Array(got!.data)).toEqual(new Uint8Array([1, 2, 3]));
      await s.put({ ...rec('user/a', 1), version: 2 });
      expect((await s.get('user/a'))!.version).toBe(2);
      await s.remove('user/a');
      expect(await s.get('user/a')).toBeUndefined();
      expect((await s.list()).length).toBe(1);
    });
  }

  it('base64 round-trip (large buffer, chunked)', () => {
    const buf = new Uint8Array(200_000).map((_, i) => (i * 31) % 256).buffer;
    expect(new Uint8Array(base64ToBuffer(bufferToBase64(buf)))).toEqual(new Uint8Array(buf));
  });

  it('metaOf strips binary data', () => {
    const m = metaOf(rec('user/x', 1));
    expect('data' in m).toBe(false);
    expect(m.id).toBe('user/x');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { IdbAssetStore, MemoryAssetStore, base64ToBuffer, bufferToBase64, metaOf, openAssetStore } from '../../src/assets/store';
import type { UserAssetRecord } from '../../src/core/types';

const rec = (id: string, createdAt: number): UserAssetRecord => ({
  id, name: id, cat: 'c', tags: ['t'], industry: 'general', description: '', fileName: 'a.glb', fileSize: 3,
  version: 1, createdAt, updatedAt: createdAt, import: { unitScale: 1, upAxis: 'y', pivot: 'bottom-center' },
  stats: { triangles: 12, meshes: 1, materials: 1, textures: 0, size: [1, 1, 1] }, thumbnail: '',
  data: new Uint8Array([1, 2, 3]).buffer,
});
const fakeFactory = () => new IDBFactory() as unknown as globalThis.IDBFactory;
/** open 请求异步失败的桩 */
const failingFactory = () => ({
  open() {
    const r: { error?: DOMException; onerror?: () => void } = {};
    setTimeout(() => { r.error = new DOMException('denied', 'InvalidStateError'); r.onerror?.(); });
    return r;
  },
}) as unknown as globalThis.IDBFactory;
/** open 同步抛错的桩（如浏览器禁用存储） */
const throwingFactory = () => ({ open() { throw new DOMException('blocked', 'SecurityError'); } }) as unknown as globalThis.IDBFactory;

describe('asset stores', () => {
  for (const [name, mk] of [['IndexedDB', () => IdbAssetStore.open(fakeFactory())], ['memory', async () => new MemoryAssetStore()]] as const) {
    it(`${name}: put / get / list / remove`, async () => {
      const s = await mk();
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

describe('IdbAssetStore.open', () => {
  it('IndexedDB 不可用时 reject', async () => {
    await expect(IdbAssetStore.open(null as unknown as globalThis.IDBFactory)).rejects.toThrow('不支持 IndexedDB');
  });
  it('open 请求失败时 reject', async () => {
    await expect(IdbAssetStore.open(failingFactory())).rejects.toThrow('denied');
  });
  it('open 同步抛错时 reject', async () => {
    await expect(IdbAssetStore.open(throwingFactory())).rejects.toThrow('blocked');
  });
});

describe('openAssetStore', () => {
  it('打开失败时降级为内存库，仍可读写', async () => {
    for (const f of [failingFactory(), throwingFactory()]) {
      const r = await openAssetStore(f);
      expect(r.persistent).toBe(false);
      expect(r.error).toBeInstanceOf(Error);
      expect(r.store).toBeInstanceOf(MemoryAssetStore);
      await r.store.put(rec('user/a', 1));
      expect((await r.store.get('user/a'))?.id).toBe('user/a');
    }
  });
  it('IndexedDB 可用时返回持久化实现', async () => {
    const r = await openAssetStore(fakeFactory());
    expect(r.persistent).toBe(true);
    expect(r.store).toBeInstanceOf(IdbAssetStore);
  });
});

describe('IdbAssetStore 写操作等待事务提交', () => {
  /** 请求成功后再中止事务：旧实现会在请求 onsuccess 时 resolve，造成假成功 */
  const abortAfter = (method: 'put' | 'delete') => {
    const orig = FakeObjectStore.prototype[method] as (...a: unknown[]) => IDBRequest;
    return vi.spyOn(FakeObjectStore.prototype, method).mockImplementation(function (this: IDBObjectStore, ...a: unknown[]) {
      const r = orig.apply(this, a);
      r.addEventListener('success', () => this.transaction.abort());
      return r;
    } as never);
  };

  it('put 在事务 abort 时 reject，且数据未写入', async () => {
    const s = await IdbAssetStore.open(fakeFactory());
    const spy = abortAfter('put');
    try {
      await expect(s.put(rec('user/a', 1))).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(await s.get('user/a')).toBeUndefined();
  });

  it('remove 在事务 abort 时 reject，且数据仍在', async () => {
    const s = await IdbAssetStore.open(fakeFactory());
    await s.put(rec('user/a', 1));
    const spy = abortAfter('delete');
    try {
      await expect(s.remove('user/a')).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect((await s.get('user/a'))?.id).toBe('user/a');
  });
});

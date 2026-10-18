import type { UserAssetMeta, UserAssetRecord } from '../core/types';

/**
 * 用户 3D 资产的本地持久化（IndexedDB）。
 * 阶段 2 将提供同样接口的服务端实现（AssetStore），编辑器只依赖该接口。
 */
export interface AssetStore {
  list(): Promise<UserAssetRecord[]>;
  get(id: string): Promise<UserAssetRecord | undefined>;
  put(rec: UserAssetRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_NAME = 'factoryforge';
const STORE = 'assets';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class IdbAssetStore implements AssetStore {
  private db: Promise<IDBDatabase>;

  constructor(factory: IDBFactory = globalThis.indexedDB, dbName = DB_NAME) {
    this.db = new Promise((resolve, reject) => {
      if (!factory) return reject(new Error('当前环境不支持 IndexedDB'));
      const open = factory.open(dbName, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
  }
  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.db).transaction(STORE, mode).objectStore(STORE);
  }
  async list(): Promise<UserAssetRecord[]> {
    const all = await req((await this.tx('readonly')).getAll() as IDBRequest<UserAssetRecord[]>);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }
  async get(id: string): Promise<UserAssetRecord | undefined> {
    return req((await this.tx('readonly')).get(id) as IDBRequest<UserAssetRecord | undefined>);
  }
  async put(rec: UserAssetRecord): Promise<void> {
    await req((await this.tx('readwrite')).put(rec));
  }
  async remove(id: string): Promise<void> {
    await req((await this.tx('readwrite')).delete(id));
  }
}

/** 内存实现：IndexedDB 不可用（如隐私模式）时的降级方案 */
export class MemoryAssetStore implements AssetStore {
  private m = new Map<string, UserAssetRecord>();
  async list() { return [...this.m.values()].sort((a, b) => a.createdAt - b.createdAt); }
  async get(id: string) { return this.m.get(id); }
  async put(rec: UserAssetRecord) { this.m.set(rec.id, rec); }
  async remove(id: string) { this.m.delete(id); }
}

export function metaOf(rec: UserAssetRecord): UserAssetMeta {
  const { data: _data, ...meta } = rec;
  return meta;
}

// ---------- base64（项目包内嵌资产） ----------
export function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBuffer(b64: string): ArrayBuffer {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

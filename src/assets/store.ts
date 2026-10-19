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
  private constructor(private db: IDBDatabase) {}

  /** 打开（或创建）数据库；IndexedDB 不可用 / 被禁用 / 打开失败时 reject */
  static open(factory?: IDBFactory, dbName = DB_NAME): Promise<IdbAssetStore> {
    return new Promise((resolve, reject) => {
      let f: IDBFactory | undefined;
      // 沙箱 iframe 等环境中访问 indexedDB 本身会抛 SecurityError
      try { f = factory === undefined ? globalThis.indexedDB : factory; } catch (e) { return reject(e); }
      if (!f) return reject(new Error('当前环境不支持 IndexedDB'));
      let open: IDBOpenDBRequest;
      try { open = f.open(dbName, 1); } catch (e) { return reject(e); }
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      open.onsuccess = () => resolve(new IdbAssetStore(open.result));
      open.onerror = () => reject(open.error ?? new Error('无法打开资产库'));
    });
  }
  private store(mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }
  async list(): Promise<UserAssetRecord[]> {
    const all = await req(this.store('readonly').getAll() as IDBRequest<UserAssetRecord[]>);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }
  async get(id: string): Promise<UserAssetRecord | undefined> {
    return req(this.store('readonly').get(id) as IDBRequest<UserAssetRecord | undefined>);
  }
  put(rec: UserAssetRecord): Promise<void> {
    return this.write(s => s.put(rec));
  }
  remove(id: string): Promise<void> {
    return this.write(s => s.delete(id));
  }
  /** 写操作：等待事务提交完成；事务中止（如配额不足）或出错时 reject，避免假成功 */
  private write(fn: (s: IDBObjectStore) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = this.db.transaction(STORE, 'readwrite');
        // 事件异步派发，同步绑定即可保证不漏掉
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(txError(tx));
        tx.onerror = () => reject(txError(tx)); // 随后还会触发 abort，重复 reject 无害
        fn(tx.objectStore(STORE));
      } catch (e) {
        reject(e);
      }
    });
  }
}

function txError(tx: IDBTransaction): Error {
  const e = tx.error;
  if (e?.name === 'QuotaExceededError') return new Error('浏览器存储空间不足，资产未保存');
  return new Error(e?.message || '写入资产库失败');
}

/** 打开持久化资产库；失败时降级为内存实现（persistent = false），不会 reject */
export async function openAssetStore(factory?: IDBFactory): Promise<{ store: AssetStore; persistent: boolean; error?: Error }> {
  try {
    return { store: await IdbAssetStore.open(factory), persistent: true };
  } catch (e) {
    return { store: new MemoryAssetStore(), persistent: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** 内存实现：IndexedDB 不可用（如隐私模式）时的降级方案（数据不会持久化） */
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

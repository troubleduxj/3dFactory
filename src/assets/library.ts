import * as THREE from 'three';
import type { AssetDef, ImportOptions, ProjectBundle, UserAssetMeta, UserAssetRecord } from '../core/types';
import type { AssetRegistry } from '../core/registry';
import { invalidatePlan } from '../core/optimize';
import { type AssetStore, base64ToBuffer, bufferToBase64, metaOf } from './store';
import { DEFAULT_IMPORT, guessName, parseModel, processModel, thumbnailOf } from './importer';
import { safeThumbnail, validateBundleAsset } from './validate';

/** 错误提示中用于标识资产的简短文字 */
const idLabel = (raw: unknown): string => {
  const id = (raw as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id.slice(0, 60) : '（无 ID）';
};

export interface ImportRequest {
  file: { name: string; size: number; data: ArrayBuffer };
  options: ImportOptions;
  name?: string;
  cat?: string;
  tags?: string[];
  industry?: string;
  description?: string;
}

const uuid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/**
 * 用户 3D 资产库：导入、版本替换、元数据、重新处理、导出、项目打包。
 * 资产以 `user/<uuid>` 注册到 AssetRegistry，场景只保存资产 ID。
 */
export class UserAssetLibrary {
  private templates = new Map<string, THREE.Group>();
  private metas = new Map<string, UserAssetMeta>();
  private changed = new Set<(id: string) => void>();

  constructor(private store: AssetStore, private registry: AssetRegistry) {}

  /** 启动时载入全部用户资产；损坏的资产跳过并返回错误列表 */
  async init(): Promise<string[]> {
    const errors: string[] = [];
    for (const rec of await this.store.list()) {
      try {
        await this.load(rec);
      } catch (e) {
        errors.push(`${rec.name}: ${(e as Error).message}`);
      }
    }
    return errors;
  }

  list(): UserAssetMeta[] {
    return [...this.metas.values()];
  }
  meta(id: string): UserAssetMeta | undefined {
    return this.metas.get(id);
  }
  /** 资产被替换 / 重新处理后通知（编辑器据此刷新场景中的实例） */
  onAssetChanged(fn: (id: string) => void): void {
    this.changed.add(fn);
  }

  async importModel(req: ImportRequest): Promise<UserAssetMeta> {
    const raw = await parseModel(req.file.data);
    const { template, stats } = processModel(raw, req.options);
    const now = Date.now();
    const rec: UserAssetRecord = {
      id: 'user/' + uuid(),
      name: req.name?.trim() || guessName(req.file.name),
      cat: req.cat?.trim() || '未分类',
      tags: req.tags ?? [],
      industry: req.industry?.trim() || 'general',
      description: req.description ?? '',
      fileName: req.file.name,
      fileSize: req.file.size,
      version: 1,
      createdAt: now,
      updatedAt: now,
      import: { ...req.options },
      stats,
      thumbnail: thumbnailOf(template),
      data: req.file.data,
    };
    await this.store.put(rec);
    this.register(rec, template);
    return metaOf(rec);
  }

  /** 用新文件替换资产（版本号 +1，沿用元数据和导入选项）；场景中的实例自动更新 */
  async replaceVersion(id: string, file: ImportRequest['file'], options?: ImportOptions): Promise<UserAssetMeta> {
    const rec = await this.mustGet(id);
    const opt = options ?? rec.import;
    const { template, stats } = processModel(await parseModel(file.data), opt);
    Object.assign(rec, {
      fileName: file.name, fileSize: file.size, data: file.data, import: { ...opt }, stats,
      version: rec.version + 1, updatedAt: Date.now(), thumbnail: thumbnailOf(template),
    });
    await this.store.put(rec);
    this.register(rec, template);
    this.notify(id);
    return metaOf(rec);
  }

  /** 修改导入选项（单位 / 坐标轴 / 原点）后重新处理已存储的原始文件 */
  async reprocess(id: string, options: ImportOptions): Promise<UserAssetMeta> {
    const rec = await this.mustGet(id);
    const { template, stats } = processModel(await parseModel(rec.data), options);
    Object.assign(rec, { import: { ...options }, stats, updatedAt: Date.now(), thumbnail: thumbnailOf(template) });
    await this.store.put(rec);
    this.register(rec, template);
    this.notify(id);
    return metaOf(rec);
  }

  async updateMeta(id: string, patch: Partial<Pick<UserAssetMeta, 'name' | 'cat' | 'tags' | 'industry' | 'description'>>): Promise<UserAssetMeta> {
    const rec = await this.mustGet(id);
    Object.assign(rec, patch, { updatedAt: Date.now() });
    await this.store.put(rec);
    this.register(rec, this.templates.get(id)!);
    return metaOf(rec);
  }

  async remove(id: string): Promise<void> {
    await this.store.remove(id);
    this.templates.delete(id);
    this.metas.delete(id);
    invalidatePlan(id);
    this.registry.removeUserAsset(id);
    this.notify(id); // 场景中的实例变为占位框
  }

  async exportFile(id: string): Promise<{ name: string; blob: Blob }> {
    const rec = await this.mustGet(id);
    const type = rec.fileName.toLowerCase().endsWith('.gltf') ? 'model/gltf+json' : 'model/gltf-binary';
    return { name: rec.fileName, blob: new Blob([rec.data], { type }) };
  }

  /** 项目包：导出指定资产（含原始文件） */
  async packAssets(ids: string[]): Promise<ProjectBundle['assets']> {
    const out: ProjectBundle['assets'] = [];
    for (const id of new Set(ids)) {
      const rec = await this.store.get(id);
      if (rec) out.push({ ...metaOf(rec), dataBase64: bufferToBase64(rec.data) });
    }
    return out;
  }

  /**
   * 项目包：导入资产。已存在且版本不低于包内版本时保留本地版本；返回导入数量。
   * 先校验并解析全部资产，任一不合格则整体拒绝且不写库；全部通过后才写库并注册。
   */
  async unpackAssets(list: unknown): Promise<number> {
    if (!Array.isArray(list)) throw new Error('项目包中的资产列表无效');
    // 第一阶段：只校验和解析，不写库
    const ready: { rec: UserAssetRecord; template: THREE.Group }[] = [];
    const errors: string[] = [];
    for (const raw of list) {
      try {
        const { asset, thumbnailOk } = validateBundleAsset(raw);
        const local = this.metas.get(asset.id);
        if (local && local.version >= asset.version) continue;
        let data: ArrayBuffer;
        try { data = base64ToBuffer(asset.dataBase64); } catch { throw new Error('模型数据不是有效的 base64'); }
        const { template } = processModel(await parseModel(data), asset.import);
        const { dataBase64: _b, ...meta } = asset;
        // 缩略图不合法时丢弃，用解析出的模板重新生成
        const rec: UserAssetRecord = { ...meta, thumbnail: thumbnailOk ? meta.thumbnail : thumbnailOf(template), data };
        ready.push({ rec, template });
      } catch (e) {
        errors.push(`${idLabel(raw)}：${(e as Error).message}`);
      }
    }
    if (errors.length) throw new Error(`项目包包含 ${errors.length} 个无效资产，已拒绝导入：${errors.slice(0, 3).join('；')}`);
    // 第二阶段：写库并注册（ID 已校验，register 不会因格式抛错）
    for (const { rec, template } of ready) {
      await this.store.put(rec);
      this.register(rec, template);
      this.notify(rec.id); // 更新旧版本实例 / 恢复占位框
    }
    return ready.length;
  }

  // ---------- 内部 ----------
  private async mustGet(id: string): Promise<UserAssetRecord> {
    const rec = await this.store.get(id);
    if (!rec) throw new Error('资产不存在：' + id);
    return rec;
  }
  private async load(rec: UserAssetRecord): Promise<void> {
    const { template } = processModel(await parseModel(rec.data), rec.import ?? DEFAULT_IMPORT);
    this.register(rec, template);
  }
  private register(rec: UserAssetRecord | UserAssetMeta, template: THREE.Group): void {
    const meta = 'data' in rec ? metaOf(rec) : rec;
    this.templates.set(meta.id, template);
    this.metas.set(meta.id, meta);
    invalidatePlan(meta.id);
    this.registry.ensureUserCategory(meta.cat);
    const def: AssetDef = {
      id: meta.id, packId: 'user', key: meta.id.slice(5), source: 'user',
      name: meta.name, cat: meta.cat, icon: '🧊', color: '#ffffff', tags: meta.tags,
      // 纵深防御：本地库中的旧记录也只接受 PNG data URI 缩略图
      colorable: false, optimize: false, thumbnail: safeThumbnail(meta.thumbnail),
      build: () => {
        const g = new THREE.Group();
        g.add((this.templates.get(meta.id) ?? template).clone(true));
        g.userData.mainMats = [];
        return g;
      },
    };
    this.registry.upsertUserAsset(def);
  }
  private notify(id: string): void {
    this.changed.forEach(fn => fn(id));
  }
}

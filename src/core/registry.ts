import type { AssetDef, AssetPack, CategoryDef, SceneDef } from './types';

/**
 * 资产注册表：汇总所有资产包与用户资产，提供统一的 ID 解析。
 * - 资产 ID：`<packId>/<key>`（程序化）或 `user/<uuid>`（用户导入）
 * - 兼容旧版布局中的裸键名（如 "forklift"）→ 自动映射到包含该键的第一个资产包
 */
export interface PackInfo {
  id: string;
  name: string;
  industry: string;
  description?: string;
  categories: CategoryDef[];
  builtin: boolean;
}

export interface SceneEntry extends SceneDef {
  /** `<packId>/<key>` */
  id: string;
  packId: string;
}

type Listener = () => void;

export class AssetRegistry {
  private assets = new Map<string, AssetDef>();
  private aliases = new Map<string, string>();
  private packList: PackInfo[] = [];
  private sceneList: SceneEntry[] = [];
  private listeners = new Set<Listener>();

  registerPack(pack: AssetPack): void {
    if (this.packList.some(p => p.id === pack.id)) throw new Error(`资产包重复：${pack.id}`);
    if (pack.id.includes('/')) throw new Error(`资产包 ID 不能包含 "/"：${pack.id}`);
    this.packList.push({ id: pack.id, name: pack.name, industry: pack.industry, description: pack.description, categories: pack.categories, builtin: true });
    const catIds = new Set(pack.categories.map(c => c.id));
    for (const [key, a] of Object.entries(pack.assets)) {
      if (!catIds.has(a.cat)) throw new Error(`资产 ${pack.id}/${key} 的分类 "${a.cat}" 未在资产包中声明`);
      const id = `${pack.id}/${key}`;
      this.assets.set(id, {
        id, packId: pack.id, key, source: 'procedural',
        name: a.name, cat: a.cat, icon: a.icon, color: a.color, tags: a.tags ?? [],
        colorable: true, locked: a.locked, placeY: a.placeY,
        build: a.build, animate: a.animate, optimize: a.optimize ?? true,
      });
      if (!this.aliases.has(key)) this.aliases.set(key, id);
    }
    for (const [key, s] of Object.entries(pack.scenes ?? {})) {
      this.sceneList.push({ ...s, id: `${pack.id}/${key}`, packId: pack.id });
    }
    this.emit();
  }

  /** 注册 / 更新一个用户资产（资产管理器调用） */
  upsertUserAsset(def: AssetDef): void {
    if (!def.id.startsWith('user/')) throw new Error('用户资产 ID 必须以 user/ 开头');
    this.ensureUserPack();
    this.assets.set(def.id, def);
    this.emit();
  }
  removeUserAsset(id: string): void {
    if (this.assets.get(id)?.source === 'user') {
      this.assets.delete(id);
      this.emit();
    }
  }
  /** 用户资产使用的分类：统一放在"我的资产"包下，分类可自由新增 */
  ensureUserCategory(cat: string): void {
    const p = this.ensureUserPack();
    if (!p.categories.some(c => c.id === cat)) p.categories.push({ id: cat, name: cat });
  }
  private ensureUserPack(): PackInfo {
    let p = this.packList.find(x => x.id === 'user');
    if (!p) {
      p = { id: 'user', name: '我的资产', industry: 'custom', categories: [], builtin: false };
      this.packList.unshift(p);
    }
    return p;
  }

  /** 解析资产 ID（含旧版裸键名） */
  resolveId(type: string): string | undefined {
    if (this.assets.has(type)) return type;
    if (!type.includes('/')) return this.aliases.get(type);
    return undefined;
  }
  get(type: string): AssetDef | undefined {
    const id = this.resolveId(type);
    return id ? this.assets.get(id) : undefined;
  }
  all(): AssetDef[] {
    return [...this.assets.values()];
  }
  byPack(packId: string): AssetDef[] {
    return this.all().filter(a => a.packId === packId);
  }
  packs(): PackInfo[] {
    return this.packList;
  }
  pack(id: string): PackInfo | undefined {
    return this.packList.find(p => p.id === id);
  }
  categoryName(packId: string, cat: string): string {
    return this.pack(packId)?.categories.find(c => c.id === cat)?.name ?? cat;
  }
  scenes(): SceneEntry[] {
    return this.sceneList;
  }
  scene(id: string): SceneEntry | undefined {
    return this.sceneList.find(s => s.id === id || s.id.endsWith('/' + id));
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(): void {
    this.listeners.forEach(fn => fn());
  }
}

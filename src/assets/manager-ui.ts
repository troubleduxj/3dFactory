import type { AssetDef, ImportOptions, UserAssetMeta } from '../core/types';
import type { AssetRegistry } from '../core/registry';
import type { UserAssetLibrary } from './library';
import { DEFAULT_IMPORT, UNIT_OPTIONS, formatBytes, guessName, parseModel, processModel, thumbnailOf } from './importer';

/**
 * 3D 资产管理器（弹窗）：
 * - 浏览全部资产（内置资产包 + 我的资产），按资产包 / 分类 / 来源筛选和搜索
 * - 查看详情：缩略图、尺寸、面数、材质、文件、版本、场景引用数
 * - 我的资产：编辑元数据、调整导入选项并重新处理、替换新版本、导出原文件、删除
 * - 导入向导：预览 + 单位 / 向上轴 / 原点 + 名称 / 分类 / 标签 / 行业
 */
export interface ManagerDeps {
  registry: AssetRegistry;
  lib: UserAssetLibrary;
  usageOf: (id: string) => number;
  place: (id: string) => void;
  toast: (msg: string, type?: 'info' | 'ok' | 'warn') => void;
  downloadBlob: (name: string, blob: Blob) => void;
  procThumb: (id: string) => string;
}

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmtDate = (t: number) => new Date(t).toLocaleString();
const pivotLabels: Record<ImportOptions['pivot'], string> = { 'bottom-center': '底部中心', center: '几何中心', keep: '保留原点' };

interface PendingImport {
  file: { name: string; size: number; data: ArrayBuffer };
  raw: Awaited<ReturnType<typeof parseModel>>;
  options: ImportOptions;
  /** 替换已有资产的新版本 */
  replaceId?: string;
}

export class AssetManagerUI {
  private root: HTMLElement;
  private filterPack = 'all';
  private query = '';
  private selectedId: string | null = null;
  private pending: PendingImport | null = null;
  private fileInput: HTMLInputElement;

  constructor(private d: ManagerDeps) {
    this.root = document.createElement('div');
    this.root.id = 'assetModal';
    this.root.className = 'modal hidden';
    this.root.innerHTML = `
      <div class="modal-card am-card" role="dialog" aria-label="资产管理">
        <div class="modal-head"><span>🗂 资产管理</span>
          <div class="am-head-actions">
            <button class="tb-btn primary" data-act="import">⬆ 导入模型</button>
            <button class="icon-btn" data-act="close" title="关闭 (Esc)">✕</button>
          </div></div>
        <div class="am-body">
          <nav class="am-nav"></nav>
          <section class="am-main">
            <div class="am-toolbar"><input type="search" class="am-search" placeholder="搜索名称 / 标签 / 分类" /><span class="am-count"></span></div>
            <div class="am-grid"></div>
          </section>
          <aside class="am-detail"></aside>
        </div>
      </div>`;
    document.body.appendChild(this.root);
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.glb,.gltf';
    this.fileInput.hidden = true;
    document.body.appendChild(this.fileInput);

    this.root.addEventListener('click', e => {
      const t = e.target as HTMLElement;
      if (t === this.root) return this.close();
      const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'close') this.close();
      else if (act === 'import') this.pickFile();
      const nav = t.closest<HTMLElement>('[data-pack]');
      if (nav) { this.filterPack = nav.dataset.pack!; this.render(); }
      const card = t.closest<HTMLElement>('.am-item');
      if (card) { this.selectedId = card.dataset.id!; this.pending = null; this.render(); }
    });
    this.root.addEventListener('dblclick', e => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.am-item');
      if (card) { this.d.place(card.dataset.id!); this.close(); }
    });
    this.root.querySelector<HTMLInputElement>('.am-search')!.addEventListener('input', e => {
      this.query = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.renderGrid();
    });
    this.root.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    this.fileInput.addEventListener('change', () => {
      const f = this.fileInput.files?.[0];
      this.fileInput.value = '';
      if (f) this.loadFile(f, this.replaceTarget);
      this.replaceTarget = undefined;
    });
    // 拖放文件到弹窗直接导入
    this.root.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
    this.root.addEventListener('drop', e => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      this.loadFile(f);
    });
  }

  private replaceTarget: string | undefined;

  open(opts: { importNow?: boolean } = {}): void {
    this.root.classList.remove('hidden');
    this.render();
    if (opts.importNow) this.pickFile();
    else this.root.querySelector<HTMLInputElement>('.am-search')!.focus();
  }
  close(): void {
    this.root.classList.add('hidden');
    this.pending = null;
  }
  get isOpen(): boolean { return !this.root.classList.contains('hidden'); }
  refresh(): void { if (this.isOpen) this.render(); }

  private pickFile(replaceId?: string): void {
    this.replaceTarget = replaceId;
    this.fileInput.click();
  }

  /** 选择文件后：解析并进入导入预览 */
  async loadFile(f: File, replaceId?: string): Promise<void> {
    if (!/\.(glb|gltf)$/i.test(f.name)) return this.d.toast('仅支持 .glb / .gltf 文件', 'warn');
    try {
      const data = await f.arrayBuffer();
      const raw = await parseModel(data);
      const base = replaceId ? this.d.lib.meta(replaceId)?.import : undefined;
      this.pending = { file: { name: f.name, size: f.size, data }, raw, options: { ...(base ?? DEFAULT_IMPORT) }, replaceId };
      this.selectedId = null;
      this.render();
    } catch (e) {
      this.d.toast('模型解析失败：' + (e as Error).message, 'warn');
    }
  }

  // ---------- 渲染 ----------
  private visibleAssets(): AssetDef[] {
    return this.d.registry.all().filter(a => {
      if (this.filterPack !== 'all' && a.packId !== this.filterPack) return false;
      if (!this.query) return true;
      const catName = this.d.registry.categoryName(a.packId, a.cat);
      return [a.name, a.id, catName, ...a.tags].join(' ').toLowerCase().includes(this.query);
    });
  }
  private render(): void {
    this.renderNav();
    this.renderGrid();
    this.renderDetail();
  }
  private renderNav(): void {
    const r = this.d.registry;
    const item = (id: string, label: string, n: number, sub = '') =>
      `<button class="am-nav-item ${this.filterPack === id ? 'active' : ''}" data-pack="${esc(id)}"><span>${esc(label)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}<b>${n}</b></button>`;
    const packs = r.packs();
    this.root.querySelector('.am-nav')!.innerHTML =
      item('all', '全部资产', r.all().length) +
      `<div class="am-nav-title">资产包</div>` +
      packs.map(p => item(p.id, p.name, r.byPack(p.id).length, p.builtin ? p.industry : '本机')).join('') +
      `<div class="am-nav-tip">内置资产包随程序发布；"我的资产"保存在本机浏览器（IndexedDB），可通过项目包随场景迁移。</div>`;
  }
  private thumbOf(a: AssetDef): string {
    return a.thumbnail || this.d.procThumb(a.id);
  }
  private renderGrid(): void {
    const list = this.visibleAssets();
    this.root.querySelector('.am-count')!.textContent = `${list.length} 个资产`;
    const grid = this.root.querySelector('.am-grid')!;
    if (!list.length) {
      grid.innerHTML = `<div class="am-empty">${this.filterPack === 'user' || this.d.registry.byPack('user').length === 0
        ? '还没有自定义模型<br/><br/>点击右上角"导入模型"，或把 .glb 文件拖到这里' : '没有匹配的资产'}</div>`;
      return;
    }
    grid.innerHTML = list.map(a => {
      const t = this.thumbOf(a);
      const meta = a.source === 'user' ? this.d.lib.meta(a.id) : undefined;
      return `<div class="am-item ${a.id === this.selectedId ? 'sel' : ''}" data-id="${esc(a.id)}" title="双击放置到场景">
        <div class="thumb ${t ? 'ready' : ''}"><span class="emoji">${a.icon}</span><img alt="" src="${t}" /></div>
        <div class="am-item-name">${esc(a.name)}</div>
        <div class="am-item-sub">${esc(this.d.registry.categoryName(a.packId, a.cat))}${meta ? ` · v${meta.version}` : ''}</div></div>`;
    }).join('');
  }
  private renderDetail(): void {
    const box = this.root.querySelector<HTMLElement>('.am-detail')!;
    if (this.pending) return this.renderImport(box);
    const a = this.selectedId ? this.d.registry.get(this.selectedId) : undefined;
    if (!a) {
      box.innerHTML = `<div class="am-empty">选择一个资产查看详情</div>`;
      return;
    }
    const used = this.d.usageOf(a.id);
    const pack = this.d.registry.pack(a.packId);
    const head = `<div class="am-preview"><img alt="" src="${this.thumbOf(a)}" /></div>
      <div class="am-title">${esc(a.name)}</div><div class="am-id">${esc(a.id)}</div>`;
    const placeBtn = `<button class="act primary" data-d="place">➕ 放置到场景</button>`;
    if (a.source !== 'user') {
      box.innerHTML = head + `<dl class="am-dl">
        <dt>资产包</dt><dd>${esc(pack?.name)}（${esc(pack?.industry)}）</dd>
        <dt>分类</dt><dd>${esc(this.d.registry.categoryName(a.packId, a.cat))}</dd>
        <dt>类型</dt><dd>程序化模型${a.animate ? ' · 带动画' : ''}</dd>
        ${a.tags.length ? `<dt>标签</dt><dd>${a.tags.map(esc).join('、')}</dd>` : ''}
        <dt>场景引用</dt><dd>${used} 个实例</dd></dl>
        <div class="act-grid one">${placeBtn}</div>
        <div class="am-note">内置资产为只读；如需定制，可导入自己的模型作为替代。</div>`;
    } else {
      const m = this.d.lib.meta(a.id)!;
      box.innerHTML = head + this.metaForm(m) + `<dl class="am-dl">
        <dt>尺寸</dt><dd>${m.stats.size.join(' × ')} m</dd>
        <dt>面数</dt><dd>${m.stats.triangles.toLocaleString()}（${m.stats.meshes} 网格）</dd>
        <dt>材质 / 贴图</dt><dd>${m.stats.materials} / ${m.stats.textures}</dd>
        <dt>源文件</dt><dd>${esc(m.fileName)} · ${formatBytes(m.fileSize)}</dd>
        <dt>版本</dt><dd>v${m.version} · ${fmtDate(m.updatedAt)}</dd>
        <dt>场景引用</dt><dd>${used} 个实例</dd></dl>
        ${this.optionsForm(m.import, 'reprocess')}
        <div class="act-grid">${placeBtn}
          <button class="act" data-d="save">💾 保存信息</button>
          <button class="act" data-d="replace">⟳ 替换新版本</button>
          <button class="act" data-d="export">⬇ 导出原文件</button>
          <button class="act danger" data-d="delete">🗑 删除</button></div>`;
    }
    box.querySelectorAll<HTMLElement>('[data-d]').forEach(b => b.addEventListener('click', () => this.detailAction(b.dataset.d!, a)));
  }
  private metaForm(m: Pick<UserAssetMeta, 'name' | 'cat' | 'tags' | 'industry' | 'description'>): string {
    const cats = [...new Set(this.d.lib.list().map(x => x.cat))];
    return `<div class="am-form">
      <label>名称<input type="text" data-f="name" value="${esc(m.name)}" /></label>
      <label>分类<input type="text" data-f="cat" list="amCats" value="${esc(m.cat)}" /></label>
      <datalist id="amCats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <label>标签（逗号分隔）<input type="text" data-f="tags" value="${esc(m.tags.join(', '))}" /></label>
      <label>行业<input type="text" data-f="industry" list="amInd" value="${esc(m.industry)}" /></label>
      <datalist id="amInd">${['general', 'shipbuilding', 'warehouse', 'automotive', 'chemical', 'energy'].map(c => `<option value="${c}">`).join('')}</datalist>
      <label>说明<input type="text" data-f="description" value="${esc(m.description)}" /></label></div>`;
  }
  private optionsForm(o: ImportOptions, mode: 'import' | 'reprocess'): string {
    return `<details class="sec" ${mode === 'import' ? 'open' : ''}><summary>导入选项</summary><div class="sec-body am-form">
      <label>源文件单位<select data-o="unitScale">${UNIT_OPTIONS.map(u => `<option value="${u.value}" ${u.value === o.unitScale ? 'selected' : ''}>${u.label}</option>`).join('')}</select></label>
      <label>向上轴<select data-o="upAxis"><option value="y" ${o.upAxis === 'y' ? 'selected' : ''}>Y 轴向上（glTF 标准）</option><option value="z" ${o.upAxis === 'z' ? 'selected' : ''}>Z 轴向上（多数 CAD）</option></select></label>
      <label>原点<select data-o="pivot">${(Object.keys(pivotLabels) as ImportOptions['pivot'][]).map(k => `<option value="${k}" ${k === o.pivot ? 'selected' : ''}>${pivotLabels[k]}</option>`).join('')}</select></label>
      ${mode === 'reprocess' ? '<button class="mini-btn" data-d="reprocess">按新选项重新处理</button>' : ''}</div></details>`;
  }
  private readOptions(box: HTMLElement, base: ImportOptions): ImportOptions {
    const v = (k: string) => box.querySelector<HTMLSelectElement>(`[data-o="${k}"]`)?.value;
    return { unitScale: +(v('unitScale') ?? base.unitScale), upAxis: (v('upAxis') ?? base.upAxis) as ImportOptions['upAxis'], pivot: (v('pivot') ?? base.pivot) as ImportOptions['pivot'] };
  }
  private readMeta(box: HTMLElement) {
    const v = (k: string) => box.querySelector<HTMLInputElement>(`[data-f="${k}"]`)?.value ?? '';
    return { name: v('name').trim(), cat: v('cat').trim() || '未分类', tags: v('tags').split(/[,，]/).map(s => s.trim()).filter(Boolean), industry: v('industry').trim() || 'general', description: v('description') };
  }

  private renderImport(box: HTMLElement): void {
    const p = this.pending!;
    const { template, stats } = processModel(p.raw, p.options);
    const thumb = thumbnailOf(template);
    const old = p.replaceId ? this.d.lib.meta(p.replaceId) : undefined;
    const big = Math.max(...stats.size);
    const warn = big > 500 ? '尺寸超过 500 m，源文件单位可能是毫米或厘米' : big < 0.05 ? '尺寸小于 5 cm，请检查源文件单位' : '';
    box.innerHTML = `<div class="am-preview"><img alt="" src="${thumb}" /></div>
      <div class="am-title">${old ? `替换版本：${esc(old.name)}` : '导入新模型'}</div>
      <div class="am-id">${esc(p.file.name)} · ${formatBytes(p.file.size)}</div>
      <dl class="am-dl"><dt>处理后尺寸</dt><dd>${stats.size.join(' × ')} m</dd>
        <dt>面数</dt><dd>${stats.triangles.toLocaleString()}（${stats.meshes} 网格，${stats.materials} 材质，${stats.textures} 贴图）</dd></dl>
      ${warn ? `<div class="am-warn">⚠ ${warn}</div>` : ''}
      ${stats.triangles > 500_000 ? '<div class="am-warn">⚠ 面数较高，大量放置会影响性能（阶段 4 将提供自动减面 / LOD）</div>' : ''}
      ${this.optionsForm(p.options, 'import')}
      ${old ? '' : this.metaForm({ name: guessName(p.file.name), cat: this.lastCat, tags: [], industry: 'general', description: '' })}
      <div class="act-grid"><button class="act primary" data-i="confirm">${old ? '✔ 替换为新版本' : '✔ 导入到我的资产'}</button><button class="act" data-i="cancel">取消</button></div>`;
    box.querySelectorAll<HTMLSelectElement>('[data-o]').forEach(s => s.addEventListener('change', () => {
      const meta = old ? null : this.readMeta(box);
      p.options = this.readOptions(box, p.options);
      this.renderImport(box);
      if (meta) this.fillMeta(box, meta);
    }));
    box.querySelector('[data-i="cancel"]')!.addEventListener('click', () => { this.pending = null; this.renderDetail(); });
    box.querySelector('[data-i="confirm"]')!.addEventListener('click', () => this.confirmImport(box));
  }
  private lastCat = '未分类';
  private fillMeta(box: HTMLElement, m: ReturnType<AssetManagerUI['readMeta']>): void {
    const set = (k: string, v: string) => { const el = box.querySelector<HTMLInputElement>(`[data-f="${k}"]`); if (el) el.value = v; };
    set('name', m.name); set('cat', m.cat); set('tags', m.tags.join(', ')); set('industry', m.industry); set('description', m.description);
  }
  private async confirmImport(box: HTMLElement): Promise<void> {
    const p = this.pending!;
    const btn = box.querySelector<HTMLButtonElement>('[data-i="confirm"]')!;
    btn.disabled = true;
    try {
      if (p.replaceId) {
        const m = await this.d.lib.replaceVersion(p.replaceId, p.file, p.options);
        this.selectedId = m.id;
        this.d.toast(`已更新为 v${m.version}`, 'ok');
      } else {
        const meta = this.readMeta(box);
        this.lastCat = meta.cat;
        const m = await this.d.lib.importModel({ file: p.file, options: p.options, ...meta });
        this.selectedId = m.id;
        this.filterPack = 'user';
        this.d.toast(`已导入：${m.name}`, 'ok');
      }
      this.pending = null;
      this.render();
    } catch (e) {
      btn.disabled = false;
      this.d.toast('导入失败：' + (e as Error).message, 'warn');
    }
  }

  private async detailAction(act: string, a: AssetDef): Promise<void> {
    const box = this.root.querySelector<HTMLElement>('.am-detail')!;
    try {
      if (act === 'place') { this.d.place(a.id); this.close(); return; }
      if (a.source !== 'user') return;
      if (act === 'save') {
        const meta = this.readMeta(box);
        if (!meta.name) return this.d.toast('名称不能为空', 'warn');
        await this.d.lib.updateMeta(a.id, meta);
        this.d.toast('资产信息已保存', 'ok');
      } else if (act === 'reprocess') {
        const m = this.d.lib.meta(a.id)!;
        await this.d.lib.reprocess(a.id, this.readOptions(box, m.import));
        this.d.toast('已按新选项重新处理', 'ok');
      } else if (act === 'replace') {
        this.pickFile(a.id);
        return;
      } else if (act === 'export') {
        const { name, blob } = await this.d.lib.exportFile(a.id);
        this.d.downloadBlob(name, blob);
      } else if (act === 'delete') {
        const used = this.d.usageOf(a.id);
        const msg = used ? `场景中有 ${used} 个实例使用该资产，删除后它们将显示为占位框（导入包含该资产的项目包可恢复）。确定删除？` : `确定删除资产"${a.name}"？`;
        if (!confirm(msg)) return;
        await this.d.lib.remove(a.id);
        this.selectedId = null;
        this.d.toast('资产已删除', 'ok');
      }
      this.render();
    } catch (e) {
      this.d.toast('操作失败：' + (e as Error).message, 'warn');
    }
  }
}

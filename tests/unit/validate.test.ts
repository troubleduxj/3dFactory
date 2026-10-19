import { describe, expect, it } from 'vitest';
import { esc } from '../../src/core/html';
import { safeThumbnail, validateBundleAsset, validateLayout, validateProjectBundle } from '../../src/assets/validate';

const ID = 'user/0f8fad5b-d9cb-469f-a165-70867728950e';
const THUMB = 'data:image/png;base64,iVBORw0KGgo=';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const good = (patch: Record<string, any> = {}): Record<string, any> => ({
  id: ID, name: '设备', cat: 'c', tags: ['t'], industry: 'general', description: '', fileName: 'a.glb', fileSize: 3,
  version: 1, createdAt: 1, updatedAt: 1, import: { unitScale: 1, upAxis: 'y', pivot: 'bottom-center' },
  stats: { triangles: 12, meshes: 1, materials: 1, textures: 0, size: [1, 1, 1] }, thumbnail: THUMB,
  dataBase64: 'AAAA', ...patch,
});
const stats = (patch: Record<string, unknown>) => ({ ...good().stats, ...patch });

describe('validateBundleAsset', () => {
  it('合法资产通过，未知字段被丢弃', () => {
    const { asset, thumbnailOk } = validateBundleAsset(good({ evil: 1 }));
    expect(thumbnailOk).toBe(true);
    expect(asset.id).toBe(ID);
    expect(asset.thumbnail).toBe(THUMB);
    expect('evil' in asset).toBe(false);
  });

  it('缺少 industry / description 时补默认值（兼容早期项目包）', () => {
    const a = good();
    delete a.industry;
    delete a.description;
    const { asset } = validateBundleAsset(a);
    expect(asset.industry).toBe('general');
    expect(asset.description).toBe('');
  });

  it('缩略图含属性注入时被置空，不抛错', () => {
    for (const t of ['x" onerror="alert(1)', 'data:image/png;base64,AAA" onerror="x', 'javascript:alert(1)']) {
      const { asset, thumbnailOk } = validateBundleAsset(good({ thumbnail: t }));
      expect(thumbnailOk).toBe(false);
      expect(asset.thumbnail).toBe('');
    }
  });

  it('名称含 <script> 时校验通过，但渲染前被转义', () => {
    const { asset } = validateBundleAsset(good({ name: '<script>alert(1)</script>' }));
    expect(esc(asset.name)).not.toContain('<script');
  });

  it('非 user/<uuid> 的 ID 被拒绝', () => {
    for (const id of ['common/forklift', 'user/../x', 'user/not-a-uuid', 123, undefined]) {
      expect(() => validateBundleAsset(good({ id }))).toThrow('资产 ID 不合法');
    }
  });

  it('字符串型 / 非有限数值被拒绝', () => {
    expect(() => validateBundleAsset(good({ version: '2' }))).toThrow('version');
    expect(() => validateBundleAsset(good({ version: Infinity }))).toThrow('version');
    expect(() => validateBundleAsset(good({ version: 0 }))).toThrow('version');
    expect(() => validateBundleAsset(good({ fileSize: NaN }))).toThrow('fileSize');
    expect(() => validateBundleAsset(good({ stats: stats({ triangles: '12' }) }))).toThrow('stats.triangles');
    expect(() => validateBundleAsset(good({ stats: stats({ size: [1, '1', 1] }) }))).toThrow('stats.size');
    expect(() => validateBundleAsset(good({ stats: stats({ size: [1, 1] }) }))).toThrow('stats.size');
  });

  it('字符串字段 / 标签 / 导入选项类型错误被拒绝', () => {
    expect(() => validateBundleAsset(good({ tags: 'a' }))).toThrow('tags');
    expect(() => validateBundleAsset(good({ name: 123 }))).toThrow('name');
    expect(() => validateBundleAsset(good({ dataBase64: undefined }))).toThrow('dataBase64');
    expect(() => validateBundleAsset(good({ import: { unitScale: 1, upAxis: 'x', pivot: 'keep' } }))).toThrow('import.upAxis');
    expect(() => validateBundleAsset(good({ import: { unitScale: -1, upAxis: 'y', pivot: 'keep' } }))).toThrow('import.unitScale');
    expect(() => validateBundleAsset(null)).toThrow();
  });
});

describe('safeThumbnail', () => {
  it('只接受 PNG data URI', () => {
    expect(safeThumbnail(THUMB)).toBe(THUMB);
    expect(safeThumbnail('javascript:alert(1)')).toBe('');
    expect(safeThumbnail('data:image/svg+xml,<svg onload=alert(1)>')).toBe('');
    expect(safeThumbnail(42)).toBe('');
    expect(safeThumbnail(undefined)).toBe('');
  });
});

describe('validateLayout', () => {
  it('v3 旧格式（裸键名、custom、嵌套分组）通过且原样返回', () => {
    const data = {
      version: 3, env: { name: 'x' }, extra: 1,
      objects: [
        { kind: 'component', type: 'forklift', position: [0, 0, 0] },
        { type: 'drydock' },
        { kind: 'custom', ref: 'abc' },
        { kind: 'group', uid: 3, children: [{ type: 'common/agv', locked: true, hidden: false }] },
      ],
    };
    expect(validateLayout(data)).toBe(data);
  });

  it('结构或类型错误被拒绝', () => {
    expect(() => validateLayout({})).toThrow('布局文件无效');
    expect(() => validateLayout(null)).toThrow('布局文件无效');
    expect(() => validateLayout({ objects: [{ type: 1 }] })).toThrow('布局文件无效');
    expect(() => validateLayout({ objects: [{ type: 'a', position: [0, 'a', 0] }] })).toThrow('布局文件无效');
    expect(() => validateLayout({ objects: [{ kind: 'evil', type: 'a' }] })).toThrow('布局文件无效');
    expect(() => validateLayout({ objects: [{ kind: 'group', children: [{ type: 2 }] }] })).toThrow('布局文件无效');
    expect(() => validateLayout({ objects: [], env: 'x' })).toThrow('布局文件无效');
  });
});

describe('validateProjectBundle', () => {
  it('布局无效时拒绝', () => {
    expect(() => validateProjectBundle({ format: 'project', layout: { objects: 'x' }, assets: [] })).toThrow('布局文件无效');
  });
  it('缺少 assets 时视为空数组；assets 不是数组时拒绝', () => {
    expect(validateProjectBundle({ format: 'project', layout: { objects: [] } }).assets).toEqual([]);
    expect(() => validateProjectBundle({ format: 'project', layout: { objects: [] }, assets: {} })).toThrow('assets');
  });
});

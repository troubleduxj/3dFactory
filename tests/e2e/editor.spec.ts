import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FIXTURE = fileURLToPath(new URL('./fixtures/test-block.glb', import.meta.url));

// 编辑器把调试入口挂在 window.__ff 上，测试通过它读取状态
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FF = any;
const ff = <T>(page: Page, fn: (f: FF, arg: unknown) => T, arg?: unknown) =>
  page.evaluate(([src, a]) => new Function('f', 'a', `return (${src})(f, a)`)((window as unknown as { __ff: FF }).__ff, a), [fn.toString(), arg] as const) as Promise<Awaited<T>>;

async function boot(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // 离线部署要求：不允许任何外部请求
  page.on('request', r => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) errors.push('external request: ' + r.url()); });
  await page.goto('/' + query);
  await page.waitForFunction(() => (window as unknown as { __ffReady?: boolean }).__ffReady === true, null, { timeout: 90_000 });
  return errors;
}

test('loads the shipyard demo offline without errors', async ({ page }) => {
  const errors = await boot(page);
  const info = await ff(page, f => ({ top: f.objects.length, packs: f.registry.packs().map((p: { id: string }) => p.id), missing: f.objects.filter((o: { userData: { missingType?: string } }) => o.userData.missingType).length }));
  expect(info.top).toBe(112);
  expect(info.packs).toEqual(['shipyard', 'common']);
  expect(info.missing).toBe(0);
  await expect(page.locator('#stObjects')).toHaveText('物体 143');
  expect(errors).toEqual([]);
});

test('editing: add, undo/redo, group/ungroup, serialize round-trip', async ({ page }) => {
  const errors = await boot(page, '?noanim');
  const r = await ff(page, f => {
    const n = () => f.objects.length, out: Record<string, unknown> = { start: n() };
    f.addAsset('common/forklift', 3, 4); out.add = n(); f.undo(); out.undo = n(); f.redo(); out.redo = n();
    const a = f.objects.find((o: FF) => o.userData.factoryType === 'common/truck');
    const b = f.objects.find((o: FF) => o.userData.factoryType === 'common/agv');
    const box = (o: FF) => new f.THREE.Box3().setFromObject(o).getCenter(new f.THREE.Vector3());
    const x0 = box(a).x;
    f.select([a, b]); f.groupSelected(); out.grp = n();
    const g = f.selection[0]; g.position.x += 10; g.updateMatrixWorld(true);
    f.ungroupSelected(); f.select([]); out.ungrp = n();
    out.moved = Math.round((box(f.objects.find((o: FF) => o.userData.uid === a.userData.uid)).x - x0) * 1000) / 1000;
    const s1 = JSON.stringify(f.serialize().objects);
    f.loadData(JSON.parse(JSON.stringify(f.serialize())));
    out.roundTrip = s1 === JSON.stringify(f.serialize().objects);
    return out;
  });
  expect(r.add).toBe((r.start as number) + 1);
  expect(r.undo).toBe(r.start);
  expect(r.grp).toBe((r.redo as number) - 1);
  expect(r.ungrp).toBe(r.redo);
  expect(r.moved).toBe(10);
  expect(r.roundTrip).toBe(true);
  expect(errors).toEqual([]);
});

test('on-demand rendering: idle scene renders no frames', async ({ page }) => {
  await boot(page, '?noanim');
  await page.waitForTimeout(1500);
  const f0 = await ff(page, f => f.frames);
  await page.waitForTimeout(2000);
  expect((await ff(page, f => f.frames)) - f0).toBeLessThanOrEqual(2);
});

test('asset management: import → place → bundle → delete → restore', async ({ page }) => {
  const errors = await boot(page, '?noanim');
  await page.click('#btnAssets');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#assetModal [data-act="import"]')]);
  await chooser.setFiles(FIXTURE);
  await page.selectOption('#assetModal [data-o="unitScale"]', '0.001');
  await page.selectOption('#assetModal [data-o="upAxis"]', 'z');
  await expect(page.locator('#assetModal .am-dl dd').first()).toHaveText('2 × 0.5 × 1 m');
  await page.fill('#assetModal [data-f="name"]', '测试设备');
  await page.fill('#assetModal [data-f="cat"]', '测试分类');
  await page.click('#assetModal [data-i="confirm"]');
  await page.waitForFunction(() => (window as unknown as { __ff: FF }).__ff.userLib.list().length === 1);
  await page.click('#assetModal [data-d="place"]');
  const id = await ff(page, f => f.userLib.list()[0].id as string);
  expect(await ff(page, (f, i) => f.usageOf(i), id)).toBe(1);

  // 刷新后资产仍在（IndexedDB）
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __ffReady?: boolean }).__ffReady === true, null, { timeout: 90_000 });
  expect(await ff(page, (f, i) => !!f.registry.get(i), id)).toBe(true);

  // 放置 → 打包 → 删除 → 占位 → 恢复
  await ff(page, (f, i) => f.addAsset(i, 0, 0), id);
  const bundle = await ff(page, async f => {
    const layout = f.serialize();
    const ids = f.userLib.list().map((m: { id: string }) => m.id);
    return JSON.stringify({ app: 'FactoryForge', format: 'project', version: 4, layout, assets: await f.userLib.packAssets(ids) });
  });
  await ff(page, (f, i) => f.userLib.remove(i), id);
  expect(await ff(page, f => { let n = 0; f.scene.traverse((o: FF) => { if (o.userData.missingType) n++; }); return n; })).toBe(1);
  await ff(page, (f, t) => f.importProjectText(t), bundle);
  expect(await ff(page, (f, i) => f.usageOf(i), id)).toBe(1);
  expect(errors).toEqual([]);
});

test('legacy v3 layouts load with bare asset keys', async ({ page }) => {
  await boot(page, '?noanim');
  const types = await ff(page, f => {
    f.loadData({ version: 3, objects: [{ kind: 'component', type: 'forklift' }, { kind: 'component', type: 'drydock' }, { kind: 'component', type: 'nosuch' }] });
    return f.objects.map((o: FF) => o.userData.factoryType || 'MISSING:' + o.userData.missingType);
  });
  expect(types).toEqual(['common/forklift', 'shipyard/drydock', 'MISSING:nosuch']);
});

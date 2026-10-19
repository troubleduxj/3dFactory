import './setup-dom';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AssetRegistry } from '../../src/core/registry';
import { walkComponents } from '../../src/core/layout';
import { BUILTIN_PACKS } from '../../src/packs/index';
import type { AssetDef, AssetPack } from '../../src/core/types';

const make = () => {
  const r = new AssetRegistry();
  BUILTIN_PACKS.forEach(p => r.registerPack(p));
  return r;
};

describe('AssetRegistry', () => {
  it('registers built-in packs with namespaced ids', () => {
    const r = make();
    expect(r.get('common/forklift')?.packId).toBe('common');
    expect(r.get('shipyard/drydock')?.packId).toBe('shipyard');
    expect(r.byPack('shipyard').length).toBe(10);
    expect(r.byPack('common').length).toBe(39);
  });

  it('resolves legacy bare keys (v3 layouts) to namespaced ids', () => {
    const r = make();
    expect(r.resolveId('forklift')).toBe('common/forklift');
    expect(r.resolveId('gantry')).toBe('shipyard/gantry');
    expect(r.resolveId('nosuch')).toBeUndefined();
    expect(r.resolveId('other/forklift')).toBeUndefined();
  });

  it('rejects duplicate packs and undeclared categories', () => {
    const r = make();
    expect(() => r.registerPack(BUILTIN_PACKS[0])).toThrow();
    const bad: AssetPack = { id: 'bad', name: 'x', industry: 'x', categories: [], assets: { a: { name: 'a', cat: 'nope', icon: '', color: '#fff', build: () => new THREE.Group() } } };
    expect(() => new AssetRegistry().registerPack(bad)).toThrow();
  });

  it('manages user assets under the "user" pack', () => {
    const r = make();
    let changes = 0;
    r.onChange(() => changes++);
    const def: AssetDef = { id: 'user/abc', packId: 'user', key: 'abc', source: 'user', name: '泵', cat: '泵类', icon: '🧊', color: '#fff', tags: [], colorable: false, optimize: false, build: () => new THREE.Group() };
    r.ensureUserCategory('泵类');
    r.upsertUserAsset(def);
    expect(r.packs()[0].id).toBe('user');
    expect(r.categoryName('user', '泵类')).toBe('泵类');
    expect(r.get('user/abc')?.name).toBe('泵');
    r.removeUserAsset('user/abc');
    expect(r.get('user/abc')).toBeUndefined();
    expect(changes).toBe(2);
    expect(() => r.upsertUserAsset({ ...def, id: 'abc' })).toThrow();
  });

  it('every demo scene references only registered assets', () => {
    const r = make();
    expect(r.scenes().length).toBeGreaterThan(0);
    for (const s of r.scenes()) {
      for (const c of walkComponents(s.build().objects)) expect(r.get(c.type)?.id, `${s.id}: ${c.type}`).toBe(c.type);
    }
    const shipyard = r.scene('shipyard')!;
    expect([...walkComponents(shipyard.build().objects)].length).toBe(143);
  });
});

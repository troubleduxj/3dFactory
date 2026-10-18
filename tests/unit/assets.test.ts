import './setup-dom';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AssetRegistry } from '../../src/core/registry';
import { optimizeInstance } from '../../src/core/optimize';
import { BUILTIN_PACKS } from '../../src/packs/index';

const r = new AssetRegistry();
BUILTIN_PACKS.forEach(p => r.registerPack(p));

function meshCount(o: THREE.Object3D): number {
  let n = 0;
  o.traverse(x => { if ((x as THREE.Mesh).isMesh || (x as THREE.Line).isLine) n++; });
  return n;
}

describe('procedural assets', () => {
  for (const def of r.all()) {
    it(`${def.id} builds, animates and has valid geometry`, () => {
      const o = def.build(def.color);
      for (let t = 0; t < 3; t += 0.5) def.animate?.(o.userData.parts, t, 0.016);
      expect((o.userData.mainMats as unknown[]).length).toBeGreaterThan(0);
      o.traverse(n => {
        const g = (n as THREE.Mesh).geometry;
        if (!g) return;
        for (const v of g.attributes.position.array as Float32Array) expect(Number.isFinite(v)).toBe(true);
      });
      const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      expect(Math.max(size.x, size.y, size.z)).toBeGreaterThan(0.1);
    });
  }
});

describe('static merge optimization', () => {
  it('reduces meshes while keeping bounds identical', () => {
    for (const id of ['shipyard/drydock', 'common/workshop', 'common/shelf']) {
      const def = r.get(id)!;
      const a = def.build(def.color);
      const b = optimizeInstance(def.id, def.build(def.color));
      expect(meshCount(b)).toBeLessThan(meshCount(a));
      const ba = new THREE.Box3().setFromObject(a), bb = new THREE.Box3().setFromObject(b);
      expect(bb.min.distanceTo(ba.min)).toBeLessThan(1e-4);
      expect(bb.max.distanceTo(ba.max)).toBeLessThan(1e-4);
    }
  });

  it('keeps animated parts and per-instance colors independent', () => {
    const def = r.get('shipyard/gantry')!;
    const x = optimizeInstance(def.id, def.build(def.color));
    const y = optimizeInstance(def.id, def.build(def.color));
    const trolley = x.userData.parts.trolley as THREE.Object3D;
    let attached = false;
    x.traverse(n => { if (n === trolley) attached = true; });
    expect(attached).toBe(true);
    (x.userData.mainMats[0] as THREE.MeshStandardMaterial).color.set('#ff0000');
    expect((y.userData.mainMats[0] as THREE.MeshStandardMaterial).color.getHexString()).toBe(new THREE.Color(def.color).getHexString());
    // 合并后的网格必须引用本实例的主材质
    let usesOwn = false;
    x.traverse(n => { if ((n as THREE.Mesh).material === x.userData.mainMats[0]) usesOwn = true; });
    expect(usesOwn).toBe(true);
  });
});

import * as THREE from 'three';
import type { Parts } from '../../core/types';

/* =========================================================
   程序化建模工具包：所有资产包共用
   约定：build(color) 返回 THREE.Group，
     userData.mainMats = 随"主色"变化的材质，
     userData.parts    = 动画部件（带动画的子树不参与静态合并）
   ========================================================= */
export type { Parts };

// ---------- 共享几何体 / 材质缓存（标记 shared，避免被误释放） ----------
const geoCache = new Map<string, THREE.BufferGeometry>();
export function cached<G extends THREE.BufferGeometry>(key: string, factory: () => G): G {
  let g = geoCache.get(key) as G | undefined;
  if (!g) {
    g = factory();
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  return g;
}
const GEO = {
  box: (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt: number, rb: number, h: number, s: number) => new THREE.CylinderGeometry(rt, rb, h, s),
  sph: (r: number) => new THREE.SphereGeometry(r, 20, 14),
  cone: (r: number, h: number) => new THREE.ConeGeometry(r, h, 20),
  capsule: (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 12),
};
type GeoKind = keyof typeof GEO;
export function geo(kind: GeoKind, ...a: number[]): THREE.BufferGeometry {
  return cached(kind + '|' + a.join(','), () => (GEO[kind] as (...n: number[]) => THREE.BufferGeometry)(...a));
}

const matCache = new Map<string, THREE.Material>();
export function cachedMat<M extends THREE.Material>(key: string, factory: () => M): M {
  let m = matCache.get(key) as M | undefined;
  if (!m) {
    m = factory();
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return m;
}
export interface MatOpts {
  r?: number;
  m?: number;
  opacity?: number;
  e?: string;
  ei?: number;
  ds?: boolean;
}
/** 共享标准材质 */
export function S(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  return cachedMat('std|' + color + '|' + JSON.stringify(o), () => {
    const transparent = o.opacity !== undefined;
    return new THREE.MeshStandardMaterial({
      color,
      roughness: o.r ?? 0.7,
      metalness: o.m ?? 0.15,
      transparent,
      opacity: o.opacity ?? 1,
      depthWrite: !transparent || (o.opacity ?? 1) > 0.5,
      emissive: o.e ?? '#000000',
      emissiveIntensity: o.ei ?? 1,
      side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
    });
  });
}
/** 共享线材质 */
export function LM(color: string, opacity = 1): THREE.LineBasicMaterial {
  return cachedMat('line|' + color + opacity, () => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

/** 常用材质 */
export const P = {
  dark: () => S('#2b323c', { m: 0.5, r: 0.5 }),
  steel: () => S('#8f99a6', { m: 0.75, r: 0.35 }),
  concrete: () => S('#a3a39c', { r: 0.95, m: 0 }),
  concreteDark: () => S('#6e6f6c', { r: 0.95, m: 0 }),
  glass: () => S('#86c8f0', { m: 0.6, r: 0.08, opacity: 0.55 }),
  glassDark: () => S('#1d2a38', { m: 0.7, r: 0.15 }),
  rubber: () => S('#18191b', { r: 0.9, m: 0 }),
  white: () => S('#e9edf0', { r: 0.6 }),
  yellow: () => S('#f2b705', { r: 0.5, m: 0.2 }),
  orange: () => S('#e8742a', { r: 0.6 }),
  wood: () => S('#a67c52', { r: 0.9, m: 0 }),
  carton: () => S('#c49a6c', { r: 0.9, m: 0 }),
  rust: () => S('#8e3b26', { r: 0.8, m: 0.2 }),
  antifoul: () => S('#8e2a22', { r: 0.7 }),
  deck: () => S('#6b7d5c', { r: 0.85 }),
  screen: () => S('#0d1b2a', { e: '#2a9df4', ei: 0.8 }),
  spark: () => S('#ffd27a', { e: '#ffb347', ei: 4 }),
  lamp: () => S('#fff5d6', { e: '#fff1c4', ei: 2 }),
  steam: () => S('#ffffff', { opacity: 0.35, r: 1 }),
  smoke: () => S('#5a5f66', { opacity: 0.4, r: 1 }),
};

// ---------- 建模辅助 ----------
type Mat = THREE.Material;
export function mesh(p: THREE.Object3D, g: THREE.BufferGeometry, m: Mat, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  p.add(o);
  return o;
}
export const box = (p: THREE.Object3D, w: number, h: number, d: number, m: Mat, x = 0, y = 0, z = 0) =>
  mesh(p, geo('box', w, h, d), m, x, y, z);
/** 底部对齐的盒子：y 为底面高度 */
export const boxB = (p: THREE.Object3D, w: number, h: number, d: number, m: Mat, x = 0, y = 0, z = 0) =>
  box(p, w, h, d, m, x, y + h / 2, z);
export const cyl = (p: THREE.Object3D, rt: number, rb: number, h: number, m: Mat, x = 0, y = 0, z = 0, s = 20) =>
  mesh(p, geo('cyl', rt, rb, h, s), m, x, y, z);
export const sph = (p: THREE.Object3D, r: number, m: Mat, x = 0, y = 0, z = 0) => mesh(p, geo('sph', r), m, x, y, z);
/** 轮子：轴向沿 z */
export function wheel(p: THREE.Object3D, r: number, w: number, x: number, y: number, z: number): THREE.Mesh {
  const o = cyl(p, r, r, w, P.rubber(), x, y, z, 18);
  o.rotation.x = Math.PI / 2;
  return o;
}
/** 沿 x 方向的圆柱 */
export function cylX(p: THREE.Object3D, r: number, len: number, m: Mat, x: number, y: number, z: number): THREE.Mesh {
  const o = cyl(p, r, r, len, m, x, y, z, 16);
  o.rotation.z = Math.PI / 2;
  return o;
}
/** 格构结构线框 */
export function lattice(
  p: THREE.Object3D, w: number, h: number, d: number, sx: number, sy: number, sz: number,
  mat: THREE.LineBasicMaterial, x = 0, y = 0, z = 0,
): THREE.LineSegments {
  const g = cached(`lat|${w},${h},${d},${sx},${sy},${sz}`, () => {
    const b = new THREE.BoxGeometry(w, h, d, sx, sy, sz);
    const wf = new THREE.WireframeGeometry(b);
    b.dispose();
    return wf;
  });
  const l = new THREE.LineSegments(g, mat);
  l.position.set(x, y, z);
  p.add(l);
  return l;
}
export function group(p: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  return g;
}
/** 根节点 + 可改色主材质（每个实例独立，便于单独改色） */
export function root(color: string, o: MatOpts = {}): [THREE.Group, THREE.MeshStandardMaterial] {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: o.r ?? 0.55,
    metalness: o.m ?? 0.3,
    side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
  });
  g.userData.mainMats = [m];
  return [g, m];
}
/** 主色线材质 */
export function mainLine(g: THREE.Group, color: string): THREE.LineBasicMaterial {
  const m = new THREE.LineBasicMaterial({ color });
  (g.userData.mainMats as THREE.Material[]).push(m);
  return m;
}

export interface Hook {
  cables: THREE.Mesh[];
  hook: THREE.Group;
}
/** 吊钩：缆绳 + 吊钩块 */
export function makeHook(p: THREE.Object3D, cableMat: Mat, hookMat: Mat, spread = 0.5): Hook {
  const cables = [-spread, spread].map(z => {
    const c = cyl(p, 0.05, 0.05, 1, cableMat, 0, -0.5, z, 6);
    c.castShadow = false;
    return c;
  });
  const hook = group(p);
  boxB(hook, 1.2, 0.9, 1.2, hookMat, 0, 0, 0);
  cyl(hook, 0.12, 0.12, 0.6, P.dark(), 0, -0.3, 0, 8);
  return { cables, hook };
}
export function setHook(h: Hook, len: number, x = 0, y = 0): void {
  h.cables.forEach(c => {
    c.scale.y = len;
    c.position.set(x, y - len / 2, c.position.z);
  });
  h.hook.position.set(x, y - len - 0.9, 0);
}
/** 随机动画相位，避免同类设备同步运动 */
export const ph = (): number => Math.random() * 10;

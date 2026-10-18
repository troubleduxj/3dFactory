import * as THREE from 'three';
import { P, S, box, boxB, cyl, mesh, cylX, group, root, makeHook, setHook, ph, cached } from '../common/kit';
import type { Parts } from '../common/kit';
import { buildScaffold } from '../common/assets';

/* =========================================================
   起重设备（船厂 / 港口）
   ========================================================= */
export function buildGantry(c0: string): THREE.Group {
  const [g, c] = root(c0);
  const half = 17, tilt = Math.atan(3.9 / 27), legLen = Math.hypot(27, 3.9);
  for (const sx of [-1, 1]) {
    const x = sx * half;
    boxB(g, 1.8, 1.4, 13, P.dark(), x, 0, 0);
    for (const sz of [-1, 1]) {
      const leg = box(g, 1.4, legLen, 1.4, c, x, 1.4 + 13.5, sz * 3.55);
      leg.rotation.x = -sz * tilt;
    }
    boxB(g, 2, 2.6, 4.4, c, x, 28.4, 0);
  }
  for (const z of [-1.6, 1.6]) {
    boxB(g, 40, 2.6, 1.2, c, 0, 28.4, z);
    boxB(g, 40, 0.2, 0.3, P.steel(), 0, 31.0, z);
  }
  boxB(g, 2.4, 2.2, 2.4, P.white(), -half + 2.4, 24, 3.4);
  box(g, 0.05, 1.0, 2.0, P.glassDark(), -half + 3.62, 25.4, 3.4);
  const trolley = group(g, 0, 31.2, 0);
  boxB(trolley, 5, 2.2, 4.4, P.white());
  boxB(trolley, 5.2, 0.2, 4.6, P.dark(), 0, 2.2, 0);
  cylX(trolley, 0.7, 3.6, P.dark(), 0, 1.0, 0);
  const hook = makeHook(trolley, P.steel(), P.yellow(), 0.6);
  g.userData.parts = { trolley, hook, ph: ph() };
  animGantry(g.userData.parts, 0);
  return g;
}
export function animGantry({ trolley, hook, ph }: Parts, t: number) {
  trolley.position.x = Math.sin(t * 0.18 + ph) * 12;
  setHook(hook, 15 + Math.sin(t * 0.27 + ph) * 6);
}

export function buildPortalCrane(c0: string): THREE.Group {
  const [g, c] = root(c0);
  for (const z of [-3, 3]) boxB(g, 7.4, 0.8, 1.2, P.dark(), 0, 0, z);
  for (const x of [-3, 3]) for (const z of [-3, 3]) boxB(g, 0.7, 8, 0.7, c, x, 0.8, z);
  for (const z of [-3, 3]) boxB(g, 6.4, 0.4, 0.4, c, 0, 4.5, z);
  for (const x of [-3, 3]) boxB(g, 0.4, 0.4, 6.4, c, x, 4.5, 0);
  boxB(g, 7.4, 1, 7.4, c, 0, 8.8);
  const slew = group(g, 0, 9.8, 0);
  cyl(slew, 2.6, 2.8, 0.8, P.dark(), 0, 0.4, 0, 24);
  boxB(slew, 5.5, 3.5, 4, c, -1.2, 0.8, 0);
  boxB(slew, 1.6, 2, 3.4, P.dark(), -4.6, 1.4, 0);
  boxB(slew, 1.8, 1.8, 1.8, P.white(), 2.4, 1.8, 1.6);
  box(slew, 0.05, 1.0, 1.6, P.glassDark(), 3.32, 3.0, 1.6);
  boxB(slew, 1, 8, 1, c, 0.6, 4.3, 0);
  const pivot = group(slew, 1.6, 3.6, 0);
  box(pivot, 24, 0.9, 1.0, c, 12, 0, 0);
  const tie = cyl(slew, 0.08, 0.08, 1, P.steel(), 0, 0, 0, 6);
  const hookRoot = group(slew);
  const hook = makeHook(hookRoot, P.steel(), P.yellow(), 0.25);
  g.userData.parts = { slew, pivot, tie, hook, ph: ph() };
  animPortal(g.userData.parts, 0);
  return g;
}
export function animPortal({ slew, pivot, tie, hook, ph }: Parts, t: number) {
  slew.rotation.y = Math.sin(t * 0.16 + ph) * 1.3;
  const a = 0.5 + Math.sin(t * 0.23 + ph) * 0.15;
  pivot.rotation.z = a;
  const tx = 1.6 + 24 * Math.cos(a), ty = 3.6 + 24 * Math.sin(a);
  // 拉杆：塔顶 → 臂架端部
  const ax = 0.6, ay = 12.3, dx = tx - ax, dy = ty - ay, len = Math.hypot(dx, dy);
  tie.position.set((ax + tx) / 2, (ay + ty) / 2, 0);
  tie.scale.y = len;
  tie.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  setHook(hook, 10, tx, ty);
}

/* =========================================================
   船厂专用
   ========================================================= */
// 船体放样：xn 0=船尾 1=船首，zn 0=龙骨 1=甲板
function hullHalfWidth(xn: number): number {
  if (xn < 0.12) return 0.82 + 0.18 * Math.sin((xn / 0.12) * Math.PI / 2);
  if (xn <= 0.62) return 1;
  return Math.pow(Math.cos(((xn - 0.62) / 0.38) * Math.PI / 2), 0.75);
}
const hullSection = (zn: number): number => 0.32 + 0.68 * Math.pow(Math.max(zn, 0), 0.32);
function hullX(L: number, xn: number, zn: number): number {
  let x = -L / 2 + xn * L;
  if (xn > 0.62) x -= (1 - zn) * 0.06 * L * ((xn - 0.62) / 0.38); // 船首前倾
  return x;
}
export function hullGeometry(L: number, B: number, D: number, z0: number, z1: number, x0n = 0, x1n = 1, transom = true): THREE.BufferGeometry {
  return cached(`hull|${[L, B, D, z0, z1, x0n, x1n, transom]}`, () => {
    const segX = 48, segZ = 8, cols = (segZ + 1) * 2, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= segX; i++) {
      const xn = x0n + (x1n - x0n) * (i / segX);
      for (let side = 0; side < 2; side++) for (let j = 0; j <= segZ; j++) {
        const zz = side === 0 ? z1 - (z1 - z0) * (j / segZ) : z0 + (z1 - z0) * (j / segZ);
        const zn = zz / D;
        const w = (B / 2) * hullHalfWidth(xn) * hullSection(zn);
        pos.push(hullX(L, xn, zn), zz, side === 0 ? -w : w);
      }
    }
    for (let i = 0; i < segX; i++) for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    if (transom && x0n === 0) { // 船尾封板
      const ci = pos.length / 3;
      pos.push(hullX(L, 0, 0.5), (z0 + z1) / 2, 0);
      for (let j = 0; j < cols; j++) idx.push(ci, j, (j + 1) % cols);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    return geom;
  });
}
export function deckGeometry(L: number, B: number, x1n = 1): THREE.BufferGeometry {
  return cached(`deck|${L},${B},${x1n}`, () => {
    const sh = new THREE.Shape(), n = 40;
    for (let i = 0; i <= n; i++) {
      const xn = (i / n) * x1n, w = (B / 2) * hullHalfWidth(xn);
      i === 0 ? sh.moveTo(hullX(L, xn, 1), -w) : sh.lineTo(hullX(L, xn, 1), -w);
    }
    for (let i = n; i >= 0; i--) {
      const xn = (i / n) * x1n;
      sh.lineTo(hullX(L, xn, 1), (B / 2) * hullHalfWidth(xn));
    }
    return new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2);
  });
}
function hullMat(color: string) { return S(color, { ds: true, r: 0.6, m: 0.3 }); }

export function buildShip(c0: string): THREE.Group {
  const [g, c] = root(c0, { ds: true, r: 0.5, m: 0.35 });
  const L = 64, B = 11, D = 7, WL = 3.2;
  mesh(g, hullGeometry(L, B, D, 0, WL), hullMat('#8e2a22'));
  mesh(g, hullGeometry(L, B, D, WL, D), c);
  mesh(g, deckGeometry(L, B), P.deck(), 0, D - 0.05, 0);
  // 上层建筑（船尾）
  const x0 = -L / 2 + 7;
  [[10, 0.82], [9, 0.78], [8, 0.74]].forEach(([w, k], i) => {
    boxB(g, w, 2.6, B * k, P.white(), x0, D + i * 2.6);
    box(g, w + 0.05, 0.6, B * k + 0.05, P.glassDark(), x0, D + i * 2.6 + 1.5, 0);
  });
  boxB(g, 7, 2.2, B, P.white(), x0 + 0.5, D + 7.8);
  box(g, 7.05, 0.8, B + 0.05, P.glassDark(), x0 + 0.5, D + 9.0, 0);
  cyl(g, 0.1, 0.1, 4, P.steel(), x0 + 1, D + 12, 0, 6);
  boxB(g, 2.6, 8.4, 3.2, P.white(), x0 - 4.2, D + 2.6);
  boxB(g, 2.65, 1.2, 3.25, c, x0 - 4.2, D + 9.0);
  boxB(g, 2.7, 0.4, 3.3, P.dark(), x0 - 4.2, D + 11.0);
  // 货舱盖 + 甲板吊
  for (const x of [-14, -5.5, 3, 11.5, 20]) boxB(g, 7, 1.0, B * 0.66, P.rust(), x, D);
  for (const x of [-9.8, 7.3]) {
    cyl(g, 0.45, 0.45, 5, P.white(), x, D + 2.5, 0, 12);
    const jib = box(g, 9, 0.4, 0.4, P.white(), x + 3.5, D + 6, 0);
    jib.rotation.z = 0.5;
  }
  cyl(g, 0.12, 0.12, 6, P.steel(), L / 2 - 5, D + 3, 0, 6);
  return g;
}

export function buildHullWip(c0: string): THREE.Group {
  const [g, c] = root(c0, { ds: true, r: 0.75, m: 0.2 });
  const L = 60, B = 11, D = 7, x1 = 0.72;
  mesh(g, hullGeometry(L, B, D, 0, D, 0, x1), c);
  // 横舱壁 / 肋骨
  for (const xn of [0.15, 0.3, 0.45, 0.6, 0.71]) {
    const w = B * hullHalfWidth(xn) * 0.95;
    boxB(g, 0.2, D - 0.6, w * 0.92, P.rust(), hullX(L, xn, 1), 0.3);
  }
  mesh(g, deckGeometry(L, B, 0.3), P.deck(), 0, D - 0.05, 0);
  // 两侧脚手架
  for (const s of [-1, 1]) for (const x of [-18, -6, 6]) {
    const sc = buildScaffold('#c9a227');
    sc.position.set(x, 0, s * (B / 2 + 1.4));
    sc.scale.set(1, 0.85, 1);
    sc.rotation.y = Math.PI / 2;
    g.add(sc); // 脚手架颜色不随主色变化
  }
  return g;
}

export function buildHullBlock(c0: string): THREE.Group {
  const [g, c] = root(c0, { ds: true, r: 0.75, m: 0.25 });
  boxB(g, 10, 0.3, 8, c);
  for (const s of [-1, 1]) boxB(g, 10, 5, 0.3, c, 0, 0.3, s * 3.85);
  boxB(g, 10, 0.2, 7.4, c, 0, 1.3);
  for (const x of [-4, -1.3, 1.3, 4]) {
    boxB(g, 0.15, 1.0, 7.4, P.rust(), x, 0.3);
    for (const s of [-1, 1]) boxB(g, 0.15, 3.8, 0.6, P.rust(), x, 1.5, s * 3.4);
  }
  for (const [x, z] of [[-3, -3.85], [3, -3.85], [-3, 3.85], [3, 3.85]]) boxB(g, 0.4, 0.4, 0.2, P.yellow(), x, 5.3, z);
  return g;
}

export function buildTug(c0: string): THREE.Group {
  const [g, c] = root(c0, { ds: true });
  const body = group(g);
  const L = 12, B = 4.5, D = 2.6, WL = 1.2;
  mesh(body, hullGeometry(L, B, D, 0, WL), hullMat('#222428'));
  mesh(body, hullGeometry(L, B, D, WL, D), c);
  mesh(body, deckGeometry(L, B), P.deck(), 0, D - 0.03, 0);
  boxB(body, 3.4, 1.6, 2.8, P.white(), 0.6, D);
  boxB(body, 2.4, 1.3, 2.4, P.white(), 0.9, D + 1.6);
  box(body, 2.45, 0.6, 2.45, P.glassDark(), 0.9, D + 2.4, 0);
  cyl(body, 0.3, 0.35, 1.6, P.dark(), -1.4, D + 2.2, 0, 12);
  const fender = mesh(body, cached('tugFender', () => new THREE.TorusGeometry(0.6, 0.25, 8, 16)), P.rubber(), 5.6, D - 0.6, 0);
  fender.rotation.y = Math.PI / 2;
  g.userData.parts = { body, ph: ph() };
  return g;
}
export function animTug({ body, ph }: Parts, t: number) {
  body.position.y = Math.sin(t * 1.2 + ph) * 0.12;
  body.rotation.x = Math.sin(t * 0.9 + ph) * 0.03;
  body.rotation.z = Math.sin(t * 0.7 + ph) * 0.02;
}

export function buildDryDock(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.95, m: 0 });
  const L = 76, W = 20, H = 4, T = 2.5;
  boxB(g, L + 2 * T, 0.3, W + 2 * T, P.concreteDark());
  for (const s of [-1, 1]) {
    boxB(g, L + 2 * T, H, T, c, 0, 0, s * (W / 2 + T / 2));
    boxB(g, L, 1.6, 1.5, c, 0, 0.3, s * (W / 2 - 0.75));          // 坞墙台阶
    boxB(g, L + 2 * T, 0.05, 0.4, P.yellow(), 0, H, s * (W / 2 + 0.2)); // 安全线
  }
  boxB(g, T, H, W + 2 * T, c, -(L / 2 + T / 2));
  boxB(g, 2, H + 0.6, W + 2 * T, S('#41607a', { m: 0.5, r: 0.5 }), L / 2 + 1.25); // 坞门
  for (let i = 0; i < 12; i++) {
    const x = -L / 2 + 6 + i * 6;
    boxB(g, 1.2, 1.2, 2, P.wood(), x, 0.3, 0);
    if (i % 2 === 0) for (const z of [-3.5, 3.5]) boxB(g, 1.0, 0.9, 1.4, P.wood(), x, 0.3, z);
  }
  return g;
}

export function buildQuay(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.95, m: 0 });
  boxB(g, 20, 0.6, 6, c, 0, -0.3);
  boxB(g, 20, 4.3, 1.2, P.concreteDark(), 0, -4, -2.4);
  boxB(g, 20, 0.02, 0.3, P.yellow(), 0, 0.3, -2.5);
  for (const x of [-7.5, -2.5, 2.5, 7.5]) boxB(g, 1, 2, 0.6, P.rubber(), x, -2.2, -3.3);
  for (const x of [-5, 5]) addBollard(g, x, 0.3, -1.9);
  return g;
}
function addBollard(g: THREE.Group, x: number, y: number, z: number) {
  cyl(g, 0.22, 0.26, 0.6, P.dark(), x, y + 0.3, z, 12);
  cyl(g, 0.34, 0.34, 0.1, P.dark(), x, y + 0.65, z, 12);
}
export function buildBollard(c0: string): THREE.Group {
  const [g, c] = root(c0, { m: 0.5 });
  cyl(g, 0.22, 0.26, 0.6, c, 0, 0.3, 0, 12);
  cyl(g, 0.34, 0.34, 0.1, c, 0, 0.65, 0, 12);
  return g;
}

export function buildKeelBlock(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.9, m: 0 });
  boxB(g, 1.4, 0.5, 2.2, P.concreteDark());
  boxB(g, 1.2, 0.4, 2, c, 0, 0.5);
  boxB(g, 1.2, 0.4, 2, c, 0, 0.9);
  return g;
}


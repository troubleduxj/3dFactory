import * as THREE from 'three';

/* =========================================================
   素材库：全部为程序化建模，无需外部模型文件
   每个素材：{ name, cat, icon, color, build(color), animate?, locked?, placeY? }
   build 返回 THREE.Group，userData.mainMats = 可改色材质，userData.parts = 动画部件
   ========================================================= */

// ---------- 共享几何体 / 材质缓存 ----------
const geoCache = new Map();
function cached(key, factory) {
  let g = geoCache.get(key);
  if (!g) { g = factory(); g.userData.shared = true; geoCache.set(key, g); }
  return g;
}
const GEO = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s),
  sph: (r) => new THREE.SphereGeometry(r, 20, 14),
  cone: (r, h) => new THREE.ConeGeometry(r, h, 20),
  capsule: (r, l) => new THREE.CapsuleGeometry(r, l, 4, 12),
};
const geo = (kind, ...a) => cached(kind + '|' + a.join(','), () => GEO[kind](...a));

const matCache = new Map();
function S(color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) {
    const transparent = o.opacity !== undefined;
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.7, metalness: o.m ?? 0.15,
      transparent, opacity: o.opacity ?? 1, depthWrite: !transparent || o.opacity > 0.5,
      emissive: o.e ?? '#000000', emissiveIntensity: o.ei ?? 1,
      side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
    });
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return m;
}
const lineCache = new Map();
function LM(color, opacity = 1) {
  const key = color + opacity;
  if (!lineCache.has(key)) {
    const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    m.userData.shared = true; lineCache.set(key, m);
  }
  return lineCache.get(key);
}

// 常用材质
const P = {
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
function mesh(p, g, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  p.add(o);
  return o;
}
const box = (p, w, h, d, m, x, y, z) => mesh(p, geo('box', w, h, d), m, x, y, z);
/** 底部对齐的盒子：y 表示底面高度 */
const boxB = (p, w, h, d, m, x = 0, y = 0, z = 0) => box(p, w, h, d, m, x, y + h / 2, z);
const cyl = (p, rt, rb, h, m, x, y, z, s = 20) => mesh(p, geo('cyl', rt, rb, h, s), m, x, y, z);
const sph = (p, r, m, x, y, z) => mesh(p, geo('sph', r), m, x, y, z);
/** 轮子：轴向沿 z */
function wheel(p, r, w, x, y, z) {
  const o = cyl(p, r, r, w, P.rubber(), x, y, z, 18);
  o.rotation.x = Math.PI / 2;
  return o;
}
/** 沿 x 方向的圆柱（管道/钢管） */
function cylX(p, r, len, m, x, y, z) {
  const o = cyl(p, r, r, len, m, x, y, z, 16);
  o.rotation.z = Math.PI / 2;
  return o;
}
/** 桁架线框：盒子分段 + 三角对角线，看起来像格构结构 */
function lattice(p, w, h, d, sx, sy, sz, mat, x = 0, y = 0, z = 0) {
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
function group(p, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  return g;
}
/** 根节点 + 可改色主材质 */
function root(color, o = {}) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.55, metalness: o.m ?? 0.3,
    side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
  });
  g.userData.mainMats = [m];
  return [g, m];
}
/** 主色线材质（也随颜色修改） */
function mainLine(g, color) {
  const m = new THREE.LineBasicMaterial({ color });
  g.userData.mainMats.push(m);
  return m;
}
/** 吊钩：缆绳 + 吊钩块，返回 {cables, hook}，用 setHook 设置长度 */
function makeHook(p, cableMat, hookMat, spread = 0.5) {
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
function setHook(h, len, x = 0, y = 0) {
  h.cables.forEach(c => { c.scale.y = len; c.position.set(x, y - len / 2, c.position.z); });
  h.hook.position.set(x, y - len - 0.9, 0);
}
const ph = () => Math.random() * 10; // 动画相位，避免所有设备同步

/* =========================================================
   生产设备
   ========================================================= */
function buildMachine(c0) {
  const [g, c] = root(c0);
  boxB(g, 2.2, 0.12, 1.6, P.dark());
  boxB(g, 2, 1.6, 1.4, c, 0, 0.12);
  boxB(g, 1.2, 0.5, 1, P.dark(), -0.2, 1.72);
  cyl(g, 0.15, 0.35, 0.6, P.dark(), 0.45, 2.5, 0, 16);
  box(g, 0.04, 0.55, 0.8, P.screen(), 1.02, 1.05, 0);
  box(g, 1.1, 0.7, 0.04, P.glass(), -0.3, 1.0, 0.71);
  return g;
}

function buildCNC(c0) {
  const [g, c] = root(c0);
  boxB(g, 3.4, 0.35, 1.8, P.dark());
  boxB(g, 3.2, 1.9, 1.7, c, 0, 0.35);
  box(g, 3.22, 0.18, 1.72, S('#2f6fd6', { r: 0.5 }), 0, 1.75, 0);
  box(g, 1.7, 1.0, 0.04, P.glass(), -0.4, 1.25, 0.87);
  boxB(g, 0.5, 1.0, 0.25, P.dark(), 1.3, 0.8, 1.0);
  box(g, 0.4, 0.3, 0.02, P.screen(), 1.3, 1.5, 1.13);
  cyl(g, 0.05, 0.05, 0.3, P.steel(), 1.4, 2.4, -0.6, 8);
  cyl(g, 0.08, 0.08, 0.12, S('#2ecc71', { e: '#2ecc71', ei: 1.2 }), 1.4, 2.6, -0.6, 12);
  cyl(g, 0.08, 0.08, 0.12, S('#f1c40f', { e: '#f1c40f', ei: 0.3 }), 1.4, 2.72, -0.6, 12);
  cyl(g, 0.08, 0.08, 0.12, S('#e74c3c', { e: '#e74c3c', ei: 0.2 }), 1.4, 2.84, -0.6, 12);
  return g;
}

function buildPress(c0) {
  const [g, c] = root(c0);
  boxB(g, 3, 0.9, 2, c);
  boxB(g, 2.4, 0.15, 1.6, P.steel(), 0, 0.9);
  for (const x of [-1.2, 1.2]) boxB(g, 0.5, 3.4, 1.6, c, x, 0.9);
  boxB(g, 3.1, 1.0, 2.1, c, 0, 4.3);
  cyl(g, 0.14, 0.14, 1.4, P.steel(), 0, 3.7, 0, 12);
  const ram = group(g, 0, 3.0, 0);
  box(ram, 1.8, 0.7, 1.3, P.steel(), 0, 0, 0);
  boxB(g, 0.6, 1.3, 0.3, P.dark(), 1.9, 0.6, 0.9);
  g.userData.parts = { ram, ph: ph() };
  return g;
}
function animPress({ ram, ph }, t) {
  const k = (Math.sin(t * 2.2 + ph) + 1) / 2;
  ram.position.y = 2.4 + k * 0.85;
}

function buildCutter(c0) {
  const [g, c] = root(c0);
  boxB(g, 7, 0.75, 3, P.dark());
  boxB(g, 6.6, 0.04, 2.6, S('#7d8794', { m: 0.8, r: 0.4 }), 0, 0.75);
  for (const z of [-1.8, 1.8]) boxB(g, 7.6, 0.25, 0.3, P.steel(), 0, 0.75, z);
  const gantry = group(g, 0, 1.0, 0);
  for (const z of [-1.8, 1.8]) boxB(gantry, 0.6, 1.1, 0.4, c, 0, 0, z);
  boxB(gantry, 0.5, 0.45, 4.1, c, 0, 1.1, 0);
  const head = group(gantry, 0.4, 0.2, 0);
  boxB(head, 0.3, 0.9, 0.35, P.dark());
  cyl(head, 0.03, 0.06, 0.25, P.steel(), 0, -0.12, 0, 8);
  const spark = sph(head, 0.09, P.spark(), 0, -0.3, 0);
  spark.castShadow = false;
  g.userData.parts = { gantry, head, spark, ph: ph() };
  return g;
}
function animCutter({ gantry, head, spark, ph }, t) {
  gantry.position.x = Math.sin(t * 0.45 + ph) * 2.8;
  head.position.z = Math.sin(t * 1.1 + ph) * 1.1;
  spark.scale.setScalar(0.6 + Math.random() * 0.8);
}

function buildConveyor(c0) {
  const [g, c] = root(c0);
  boxB(g, 4, 0.15, 1, P.dark(), 0, 0.68);
  boxB(g, 4, 0.06, 0.9, c, 0, 0.83);
  for (const x of [-1.95, 1.95]) cylX(g, 0.1, 0.1, P.steel(), x, 0.76, 0).rotation.set(Math.PI / 2, 0, 0);
  for (const x of [-1.7, -0.5, 0.5, 1.7]) for (const z of [-0.4, 0.4]) cyl(g, 0.05, 0.05, 0.7, P.steel(), x, 0.35, z, 8);
  const rollers = group(g);
  for (let i = 0; i < 3; i++) boxB(rollers, 0.45, 0.35, 0.55, P.carton(), -1.6 + i * 1.35, 0.89, 0);
  g.userData.parts = { rollers };
  return g;
}
function animConveyor({ rollers }, t, dt) {
  rollers.children.forEach(pkg => {
    pkg.position.x += dt * 0.9;
    if (pkg.position.x > 1.8) pkg.position.x = -1.8;
  });
}

function buildRobot(c0) {
  const [g, c] = root(c0);
  cyl(g, 0.5, 0.6, 0.3, P.dark(), 0, 0.15, 0, 24);
  const turret = group(g, 0, 0.3, 0);
  cyl(turret, 0.35, 0.35, 0.4, c, 0, 0.2, 0);
  const upper = group(turret, 0, 0.4, 0);
  box(upper, 0.3, 1.4, 0.3, c, 0, 0.7, 0);
  sph(upper, 0.22, P.dark(), 0, 1.4, 0);
  box(upper, 0.25, 1.1, 0.25, c, 0.3, 1.85, 0).rotation.z = -0.5;
  boxB(upper, 0.3, 0.2, 0.4, P.dark(), 0.62, 2.3, 0);
  g.userData.parts = { turret, upper, ph: ph() };
  return g;
}
function animRobot({ turret, upper, ph }, t) {
  turret.rotation.y = Math.sin(t * 0.8 + ph) * 0.9;
  upper.rotation.z = -0.3 + Math.sin(t * 1.6 + ph) * 0.35;
}

function buildWelder(c0) {
  const [g, c] = root(c0);
  boxB(g, 0.9, 0.5, 0.9, P.dark());
  const turret = group(g, 0, 0.5, 0);
  cyl(turret, 0.38, 0.42, 0.45, c, 0, 0.22, 0);
  const shoulder = group(turret, 0, 0.5, 0);
  box(shoulder, 0.28, 1.3, 0.3, c, 0, 0.65, 0);
  const elbow = group(shoulder, 0, 1.3, 0);
  sph(elbow, 0.2, P.dark(), 0, 0, 0);
  box(elbow, 1.2, 0.22, 0.24, c, 0.6, 0, 0);
  cyl(elbow, 0.04, 0.06, 0.45, P.steel(), 1.22, -0.2, 0, 8);
  const spark = sph(elbow, 0.08, P.spark(), 1.22, -0.48, 0);
  spark.castShadow = false;
  boxB(g, 1.0, 0.7, 1.0, P.steel(), 1.6, 0, 0);
  g.userData.parts = { turret, shoulder, elbow, spark, ph: ph() };
  return g;
}
function animWelder({ turret, shoulder, elbow, spark, ph }, t) {
  turret.rotation.y = Math.sin(t * 0.7 + ph) * 0.35;
  shoulder.rotation.z = -0.25 + Math.sin(t * 1.1 + ph) * 0.1;
  elbow.rotation.z = -0.15 + Math.sin(t * 1.3 + ph + 1) * 0.12;
  spark.visible = Math.random() > 0.25;
  spark.scale.setScalar(0.6 + Math.random());
}

function buildPaintBooth(c0) {
  const [g, c] = root(c0);
  boxB(g, 7, 3.4, 4.5, c);
  box(g, 6.2, 0.8, 4.56, P.glassDark(), 0, 2.3, 0);
  box(g, 0.06, 2.6, 2.2, P.dark(), 3.53, 1.3, 0);
  for (const x of [-2, 2]) cyl(g, 0.35, 0.35, 1.4, P.steel(), x, 4.1, 1, 16);
  boxB(g, 2.2, 1, 1.4, S('#5d6d7e', { m: 0.4 }), -0.5, 3.4, -1.2);
  return g;
}

/* =========================================================
   起重设备
   ========================================================= */
function buildGantry(c0) {
  const [g, c] = root(c0);
  const H = 30, half = 17, tilt = Math.atan(3.9 / 27), legLen = Math.hypot(27, 3.9);
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
function animGantry({ trolley, hook, ph }, t) {
  trolley.position.x = Math.sin(t * 0.18 + ph) * 12;
  setHook(hook, 15 + Math.sin(t * 0.27 + ph) * 6);
}

function buildPortalCrane(c0) {
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
function animPortal({ slew, pivot, tie, hook, ph }, t) {
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

function buildTowerCrane(c0) {
  const [g, c] = root(c0);
  const H = 36;
  const lm = mainLine(g, c0);
  boxB(g, 4, 1, 4, P.concrete());
  for (const x of [-0.75, 0.75]) for (const z of [-0.75, 0.75]) boxB(g, 0.18, H - 1, 0.18, c, x, 1, z);
  lattice(g, 1.5, H - 1, 1.5, 1, 18, 1, lm, 0, 1 + (H - 1) / 2, 0);
  const slew = group(g, 0, H, 0);
  boxB(slew, 2, 0.8, 2, P.dark());
  boxB(slew, 1.6, 1.8, 1.6, P.white(), 0.6, -1.8, 1.6);
  box(slew, 0.05, 1.0, 1.4, P.glassDark(), 1.42, -0.8, 1.6);
  lattice(slew, 26, 1.4, 1.4, 13, 1, 1, lm, 14, 1.5, 0);
  for (const z of [-0.7, 0.7]) boxB(slew, 26, 0.12, 0.12, c, 14, 0.8, z);
  boxB(slew, 9, 0.5, 1.6, P.dark(), -5.5, 0.8);
  for (let i = 0; i < 3; i++) boxB(slew, 0.6, 1.6, 1.6, P.concrete(), -7.4 - i * 0.65, -0.2);
  boxB(slew, 1, 5, 1, c, 0, 0.8);
  const ties = cached('towerTies', () => new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 5.8, 0), new THREE.Vector3(20, 2.2, 0),
    new THREE.Vector3(0, 5.8, 0), new THREE.Vector3(-9, 1.3, 0),
  ]));
  slew.add(new THREE.LineSegments(ties, LM('#9aa4b2')));
  const trolley = group(slew, 14, 0.8, 0);
  boxB(trolley, 1.2, 0.5, 1.2, P.dark(), 0, -0.5, 0);
  const hook = makeHook(trolley, P.steel(), P.yellow(), 0.2);
  g.userData.parts = { slew, trolley, hook, ph: ph() };
  animTower(g.userData.parts, 0);
  return g;
}
function animTower({ slew, trolley, hook, ph }, t) {
  slew.rotation.y = t * 0.12 + ph;
  trolley.position.x = 14 + Math.sin(t * 0.4 + ph) * 8;
  setHook(hook, 14 + Math.sin(t * 0.3 + ph) * 6, 0, -0.5);
}

function buildBridgeCrane(c0) {
  const [g, c] = root(c0);
  for (const x of [-7, 7]) {
    for (const z of [-9, -3, 3, 9]) boxB(g, 0.5, 7, 0.5, P.dark(), x, 0, z);
    boxB(g, 0.6, 0.7, 20, P.steel(), x, 7, 0);
  }
  const bridge = group(g, 0, 7.7, 0);
  for (const z of [-0.5, 0.5]) boxB(bridge, 14.8, 0.9, 0.5, c, 0, 0.3, z);
  for (const x of [-7, 7]) boxB(bridge, 0.9, 0.6, 2.4, c, x, 0, 0);
  const trolley = group(bridge, 0, 1.2, 0);
  boxB(trolley, 1.6, 0.8, 1.8, P.dark());
  const hook = makeHook(trolley, P.steel(), P.yellow(), 0.2);
  g.userData.parts = { bridge, trolley, hook, ph: ph() };
  animBridge(g.userData.parts, 0);
  return g;
}
function animBridge({ bridge, trolley, hook, ph }, t) {
  bridge.position.z = Math.sin(t * 0.25 + ph) * 7.5;
  trolley.position.x = Math.sin(t * 0.45 + ph) * 5.5;
  setHook(hook, 3 + Math.sin(t * 0.5 + ph) * 1.2);
}

/* =========================================================
   运输车辆（车头朝 +X）
   ========================================================= */
function buildForklift(c0) {
  const [g, c] = root(c0);
  boxB(g, 2.0, 0.9, 1.2, c, 0, 0.35);
  boxB(g, 0.5, 0.9, 1.25, P.dark(), -1.05, 0.35);
  boxB(g, 0.5, 0.35, 0.6, P.dark(), -0.2, 1.25);
  for (const x of [-0.6, 0.55]) for (const z of [-0.5, 0.5]) boxB(g, 0.06, 1.1, 0.06, P.dark(), x, 1.25, z);
  boxB(g, 1.3, 0.06, 1.1, P.dark(), 0, 2.35);
  for (const z of [-0.35, 0.35]) boxB(g, 0.1, 2.6, 0.12, P.steel(), 1.1, 0.1, z);
  boxB(g, 0.08, 0.6, 0.9, P.dark(), 1.2, 0.2);
  for (const z of [-0.3, 0.3]) boxB(g, 1.1, 0.05, 0.12, P.steel(), 1.75, 0.2, z);
  for (const x of [-0.6, 0.6]) for (const z of [-0.55, 0.55]) wheel(g, 0.32, 0.25, x, 0.32, z);
  return g;
}

function buildAGV(c0) {
  const [g, c] = root(c0);
  boxB(g, 1.8, 0.35, 1.1, c, 0, 0.08);
  boxB(g, 1.6, 0.04, 0.95, P.dark(), 0, 0.43);
  box(g, 0.02, 0.08, 0.6, S('#29b6f6', { e: '#29b6f6', ei: 2 }), 0.91, 0.28, 0);
  for (const x of [-0.6, 0.6]) for (const z of [-0.45, 0.45]) wheel(g, 0.1, 0.08, x, 0.1, z);
  return g;
}

function buildTruck(c0) {
  const [g, c] = root(c0);
  boxB(g, 8, 0.4, 2.2, P.dark(), 0, 0.6);
  boxB(g, 2.1, 2.2, 2.3, c, 2.9, 1.0);
  box(g, 0.05, 0.9, 2.0, P.glassDark(), 3.97, 2.6, 0);
  boxB(g, 0.2, 0.4, 2.3, P.dark(), 4.0, 0.6);
  boxB(g, 5.4, 2.6, 2.4, P.white(), -0.9, 1.0);
  for (const x of [3.0, -1.8, -3.0]) for (const z of [-1.0, 1.0]) wheel(g, 0.5, 0.35, x, 0.5, z);
  return g;
}

function buildTransporter(c0) {
  const [g, c] = root(c0);
  boxB(g, 12, 0.7, 5, c, 0, 0.6);
  box(g, 12.02, 0.15, 5.02, P.yellow(), 0, 1.15, 0);
  for (let i = 0; i < 6; i++) for (const z of [-1.9, 1.9]) wheel(g, 0.45, 0.4, -5 + i * 2, 0.45, z);
  boxB(g, 1, 1.0, 1.2, P.dark(), 6.3, 0.6, -1.6);
  return g;
}

/* =========================================================
   仓储物料
   ========================================================= */
function buildShelf(c0) {
  const [g, c] = root(c0);
  for (const x of [-1.45, 1.45]) for (const z of [-0.5, 0.5]) boxB(g, 0.08, 3.6, 0.08, c, x, 0, z);
  for (const y of [0.15, 1.3, 2.45]) {
    for (const z of [-0.5, 0.5]) boxB(g, 3, 0.12, 0.08, P.orange(), 0, y, z);
    if (y < 2) for (const x of [-0.75, 0.75]) boxB(g, 1.1, 0.8, 0.9, P.carton(), x, y + 0.12, 0);
  }
  return g;
}

function buildCrate(c0) {
  const [g, c] = root(c0, { r: 0.85, m: 0 });
  const b = boxB(g, 1, 1, 1, c);
  const edges = new THREE.LineSegments(cached('crateEdges', () => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))), LM('#000000', 0.3));
  edges.position.copy(b.position);
  g.add(edges);
  return g;
}

function buildPallet(c0) {
  const [g, c] = root(c0, { r: 0.9, m: 0 });
  for (const z of [-0.42, 0, 0.42]) boxB(g, 1.2, 0.1, 0.15, P.wood(), 0, 0, z);
  boxB(g, 1.2, 0.04, 1.0, P.wood(), 0, 0.1);
  for (let l = 0; l < 2; l++) for (const x of [-0.3, 0.3]) for (const z of [-0.24, 0.24])
    boxB(g, 0.56, 0.4, 0.46, c, x, 0.14 + l * 0.41, z);
  return g;
}

function buildContainer(c0) {
  const [g, c] = root(c0, { r: 0.6, m: 0.4 });
  boxB(g, 6.06, 2.59, 2.44, c);
  const ribs = cached('containerRibs', () => {
    const pts = [];
    for (let x = -2.85; x <= 2.86; x += 0.3) for (const z of [-1.226, 1.226]) {
      pts.push(new THREE.Vector3(x, 0.12, z), new THREE.Vector3(x, 2.47, z));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  });
  g.add(new THREE.LineSegments(ribs, LM('#000000', 0.35)));
  for (const x of [-2.96, 2.96]) for (const z of [-1.15, 1.15]) boxB(g, 0.15, 2.6, 0.15, P.dark(), x, 0, z);
  return g;
}

function buildSteelPlates(c0) {
  const [g, c] = root(c0, { m: 0.75, r: 0.4 });
  for (const x of [-3, 0, 3]) boxB(g, 0.25, 0.25, 2.8, P.wood(), x, 0, 0);
  for (let i = 0; i < 6; i++) boxB(g, 8, 0.1, 2.5, c, (i % 2) * 0.08 - 0.04, 0.25 + i * 0.1, ((i * 7) % 3 - 1) * 0.05);
  return g;
}

function buildPipeStack(c0) {
  const [g, c] = root(c0, { m: 0.7, r: 0.4 });
  for (const x of [-3, 3]) boxB(g, 0.25, 0.2, 3, P.wood(), x, 0, 0);
  const r = 0.35, rows = [4, 3, 2, 1];
  rows.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * r * 2;
      cylX(g, r, 8, c, 0, 0.2 + r + row * r * 1.73, z);
    }
  });
  return g;
}

/* =========================================================
   能源管线
   ========================================================= */
function buildTank(c0) {
  const [g, c] = root(c0);
  cyl(g, 1, 1, 0.2, P.concreteDark(), 0, 0.1, 0, 32);
  cyl(g, 0.9, 0.9, 2.2, c, 0, 1.3, 0, 32);
  const top = mesh(g, cached('tankTop', () => new THREE.SphereGeometry(0.9, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2)), c, 0, 2.4, 0);
  top.castShadow = true;
  const band = mesh(g, cached('tankBand', () => new THREE.TorusGeometry(0.92, 0.05, 8, 32)), P.dark(), 0, 1.6, 0);
  band.rotation.x = Math.PI / 2;
  boxB(g, 0.08, 3.1, 0.3, P.steel(), 0.95, 0.2, 0); // 爬梯
  return g;
}

function buildPipe(c0) {
  const [g, c] = root(c0, { m: 0.6 });
  cylX(g, 0.2, 3, c, 0, 2, 0);
  sph(g, 0.25, c, -1.5, 2, 0);
  cyl(g, 0.2, 0.2, 2, c, -1.5, 1, 0, 16);
  for (const x of [-0.5, 1.2]) {
    boxB(g, 0.12, 1.75, 0.12, P.dark(), x, 0, 0);
    box(g, 0.5, 0.08, 0.5, P.dark(), x, 1.78, 0);
  }
  return g;
}

function buildCoolingTower(c0) {
  const [g, c] = root(c0, { ds: true, r: 0.9, m: 0 });
  const lathe = cached('coolLathe', () => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const y = (i / 16) * 16;
      pts.push(new THREE.Vector2(3.2 + 2.6 * ((y - 11) / 11) ** 2, y));
    }
    return new THREE.LatheGeometry(pts, 40);
  });
  mesh(g, lathe, c);
  cyl(g, 5.6, 5.6, 0.1, P.dark(), 0, 0.3, 0, 32);
  g.userData.parts = { puffs: makePuffs(g, P.steam(), 16.5, 3), ph: ph() };
  return g;
}
function buildChimney(c0) {
  const [g, c] = root(c0);
  boxB(g, 3.5, 1, 3.5, P.concrete());
  for (let i = 0; i < 6; i++) {
    const rb = 1.3 - i * 0.07, rt = 1.3 - (i + 1) * 0.07;
    cyl(g, rt, rb, 4, i % 2 ? P.white() : c, 0, 1 + 2 + i * 4, 0, 20);
  }
  g.userData.parts = { puffs: makePuffs(g, P.smoke(), 25, 1.2), ph: ph() };
  return g;
}
function makePuffs(g, m, y, size) {
  return [0, 1, 2].map(i => {
    const s = sph(g, 1, m, 0, y, 0);
    s.castShadow = s.receiveShadow = false;
    s.userData.size = size; s.userData.y0 = y; s.userData.i = i;
    return s;
  });
}
function animPuffs({ puffs, ph }, t) {
  for (const s of puffs) {
    const k = ((t * 0.12 + ph + s.userData.i / 3) % 1);
    s.position.y = s.userData.y0 + k * 10;
    s.position.x = k * 3;
    s.scale.setScalar(0.3 + Math.sin(k * Math.PI) * s.userData.size * 2);
  }
}

function buildTransformer(c0) {
  const [g, c] = root(c0);
  boxB(g, 3, 0.4, 2.2, P.concrete());
  boxB(g, 2.4, 2.2, 1.6, c, 0, 0.4);
  for (const x of [-0.8, 0, 0.8]) for (const z of [-0.95, 0.95]) boxB(g, 0.5, 1.6, 0.12, c, x, 0.7, z);
  for (const x of [-0.7, 0, 0.7]) {
    cyl(g, 0.1, 0.16, 0.8, S('#b05a2a', { r: 0.4 }), x, 3.0, 0.2, 10);
    cyl(g, 0.05, 0.05, 0.3, P.steel(), x, 3.5, 0.2, 6);
  }
  cylX(g, 0.3, 1.8, c, 0, 2.95, -0.5);
  return g;
}

/* =========================================================
   建筑结构
   ========================================================= */
function buildWorkshop(c0) {
  const [g, c] = root(c0, { ds: true, r: 0.7, m: 0.2 });
  const L = 30, W = 18, H = 10, a = 0.16;
  const roof = S('#4a5662', { m: 0.4, r: 0.6 });
  for (const s of [-1, 1]) {
    boxB(g, L, H, 0.3, c, 0, 0, s * (W / 2 - 0.15));
    boxB(g, 0.3, H, W, c, s * (L / 2 - 0.15), 0, 0);
    box(g, 0.1, 7, 7, S('#5b6770', { m: 0.5 }), s * (L / 2 + 0.05), 3.5, 0);
  }
  box(g, L - 2, 1.4, W + 0.04, P.glassDark(), 0, 7.6, 0);
  const rise = (W / 2) * Math.tan(a), rw = (W / 2) / Math.cos(a) + 0.5;
  for (const s of [-1, 1]) {
    const r = box(g, L + 1, 0.3, rw, roof, 0, H + rise / 2 + 0.1, s * W / 4);
    r.rotation.x = s * a;
  }
  const gable = cached('gable', () => {
    const sh = new THREE.Shape();
    sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(0, rise); sh.closePath();
    return new THREE.ShapeGeometry(sh);
  });
  for (const s of [-1, 1]) mesh(g, gable, c, s * (L / 2 - 0.15), H, 0).rotation.y = Math.PI / 2;
  boxB(g, L, 0.5, 1.2, roof, 0, H + rise);
  return g;
}

function buildOffice(c0) {
  const [g, c] = root(c0);
  const floors = 5, fh = 3.4, w = 16, d = 11;
  boxB(g, w, floors * fh, d, c);
  for (let i = 0; i < floors; i++) box(g, w + 0.06, 1.5, d + 0.06, P.glassDark(), 0, i * fh + 1.9, 0);
  boxB(g, w + 0.4, 0.6, d + 0.4, P.white(), 0, floors * fh);
  boxB(g, 3, 1.5, 2.5, P.steel(), 3, floors * fh + 0.6, 1);
  boxB(g, 4, 0.2, 2.5, P.white(), 0, 3.0, d / 2 + 1.2);
  return g;
}

function buildControlRoom(c0) {
  const [g, c] = root(c0);
  boxB(g, 3, 2.5, 2.5, c);
  boxB(g, 3.3, 0.2, 2.8, P.dark(), 0, 2.5);
  box(g, 2.0, 0.9, 0.05, P.glass(), 0.3, 1.6, 1.26);
  box(g, 0.8, 1.6, 0.05, P.dark(), -1, 0.8, 1.26);
  return g;
}

function buildWall(c0) {
  const [g, c] = root(c0, { r: 0.9, m: 0 });
  boxB(g, 4, 2.5, 0.2, c);
  return g;
}

function buildPillar(c0) {
  const [g, c] = root(c0, { r: 0.9, m: 0 });
  boxB(g, 0.9, 0.3, 0.9, P.concreteDark());
  cyl(g, 0.3, 0.3, 3.2, c, 0, 1.9, 0);
  boxB(g, 0.9, 0.3, 0.9, P.concreteDark(), 0, 3.5);
  return g;
}

function buildFence(c0) {
  const [g, c] = root(c0);
  for (let i = 0; i < 5; i++) cyl(g, 0.05, 0.05, 2, c, -5 + i * 2.5, 1, 0, 8);
  for (const y of [0.1, 1.95]) boxB(g, 10, 0.05, 0.05, c, 0, y);
  lattice(g, 10, 1.8, 0.01, 40, 7, 1, LM('#aab4c0', 0.6), 0, 1.05, 0);
  return g;
}

function buildPlatform(c0) {
  const [g, c] = root(c0);
  const h = 3;
  boxB(g, 4, 0.12, 3, S('#5f6b78', { m: 0.6 }), 0, h);
  for (const x of [-1.9, 1.9]) for (const z of [-1.4, 1.4]) boxB(g, 0.15, h, 0.15, P.dark(), x, 0, z);
  // 栏杆（后侧 + 两侧）
  boxB(g, 4, 0.05, 0.05, c, 0, h + 1.05, -1.45);
  for (const x of [-1.95, 1.95]) boxB(g, 0.05, 0.05, 3, c, x, h + 1.05, 0);
  for (const [x, z] of [[-1.95, -1.45], [0, -1.45], [1.95, -1.45], [-1.95, 1.45], [1.95, 1.45], [-1.95, 0], [1.95, 0]])
    boxB(g, 0.05, 1.05, 0.05, c, x, h + 0.12, z);
  // 楼梯
  for (let i = 0; i < 8; i++) boxB(g, 1, 0.08, 0.35, S('#5f6b78', { m: 0.6 }), 0.9, (i + 1) * (h / 9), 1.6 + (8 - i) * 0.36);
  for (const x of [0.38, 1.42]) {
    const s = box(g, 0.06, 0.2, Math.hypot(3.2, h), c, x, h / 2 + 0.3, 3.05);
    s.rotation.x = Math.atan2(h, 3.2);
  }
  return g;
}

function buildScaffold(c0) {
  const [g, c] = root(c0);
  const lm = mainLine(g, c0);
  lattice(g, 2, 10, 6, 1, 5, 3, lm, 0, 5, 0);
  for (let i = 1; i <= 5; i++) boxB(g, 2, 0.06, 6, P.wood(), 0, i * 2 - 0.06);
  for (const x of [-1, 1]) for (const z of [-3, 3]) boxB(g, 0.08, 10, 0.08, c, x, 0, z);
  return g;
}

let roadTex = null;
function getRoadTexture() {
  if (roadTex) return roadTex;
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 204;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(0, 8, 512, 6); ctx.fillRect(0, 190, 512, 6);
  ctx.fillStyle = '#f2c230';
  for (let x = 0; x < 512; x += 64) ctx.fillRect(x + 8, 99, 40, 6);
  roadTex = new THREE.CanvasTexture(cv);
  roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.anisotropy = 4;
  return roadTex;
}
function buildRoad(c0) {
  const [g, c] = root(c0, { r: 0.95, m: 0 });
  const r = boxB(g, 20, 0.04, 8, c, 0, 0);
  r.castShadow = false;
  const markMat = matCache.get('roadMarks') || (() => {
    const m = new THREE.MeshStandardMaterial({ map: getRoadTexture(), transparent: true, roughness: 0.8, depthWrite: false });
    m.userData.shared = true; matCache.set('roadMarks', m); return m;
  })();
  const marks = mesh(g, cached('roadPlane', () => new THREE.PlaneGeometry(20, 8).rotateX(-Math.PI / 2)), markMat, 0, 0.045, 0);
  marks.castShadow = false;
  return g;
}

function buildLamp(c0) {
  const [g, c] = root(c0, { m: 0.6 });
  cyl(g, 0.08, 0.12, 8, c, 0, 4, 0, 10);
  box(g, 1.6, 0.08, 0.08, c, 0.75, 7.9, 0);
  box(g, 0.6, 0.15, 0.3, P.dark(), 1.5, 7.8, 0);
  box(g, 0.5, 0.02, 0.24, P.lamp(), 1.5, 7.72, 0).castShadow = false;
  return g;
}

/* =========================================================
   船厂专用
   ========================================================= */
// 船体放样：xn 0=船尾 1=船首，zn 0=龙骨 1=甲板
function hullHalfWidth(xn) {
  if (xn < 0.12) return 0.82 + 0.18 * Math.sin((xn / 0.12) * Math.PI / 2);
  if (xn <= 0.62) return 1;
  return Math.pow(Math.cos(((xn - 0.62) / 0.38) * Math.PI / 2), 0.75);
}
const hullSection = zn => 0.32 + 0.68 * Math.pow(Math.max(zn, 0), 0.32);
function hullX(L, xn, zn) {
  let x = -L / 2 + xn * L;
  if (xn > 0.62) x -= (1 - zn) * 0.06 * L * ((xn - 0.62) / 0.38); // 船首前倾
  return x;
}
function hullGeometry(L, B, D, z0, z1, x0n = 0, x1n = 1, transom = true) {
  return cached(`hull|${[L, B, D, z0, z1, x0n, x1n, transom]}`, () => {
    const segX = 48, segZ = 8, cols = (segZ + 1) * 2, pos = [], idx = [];
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
function deckGeometry(L, B, x1n = 1) {
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
function hullMat(color) { return S(color, { ds: true, r: 0.6, m: 0.3 }); }

function buildShip(c0) {
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

function buildHullWip(c0) {
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

function buildHullBlock(c0) {
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

function buildTug(c0) {
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
function animTug({ body, ph }, t) {
  body.position.y = Math.sin(t * 1.2 + ph) * 0.12;
  body.rotation.x = Math.sin(t * 0.9 + ph) * 0.03;
  body.rotation.z = Math.sin(t * 0.7 + ph) * 0.02;
}

function buildDryDock(c0) {
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

function buildQuay(c0) {
  const [g, c] = root(c0, { r: 0.95, m: 0 });
  boxB(g, 20, 0.6, 6, c, 0, -0.3);
  boxB(g, 20, 4.3, 1.2, P.concreteDark(), 0, -4, -2.4);
  boxB(g, 20, 0.02, 0.3, P.yellow(), 0, 0.3, -2.5);
  for (const x of [-7.5, -2.5, 2.5, 7.5]) boxB(g, 1, 2, 0.6, P.rubber(), x, -2.2, -3.3);
  for (const x of [-5, 5]) addBollard(g, x, 0.3, -1.9);
  return g;
}
function addBollard(g, x, y, z) {
  cyl(g, 0.22, 0.26, 0.6, P.dark(), x, y + 0.3, z, 12);
  cyl(g, 0.34, 0.34, 0.1, P.dark(), x, y + 0.65, z, 12);
}
function buildBollard(c0) {
  const [g, c] = root(c0, { m: 0.5 });
  cyl(g, 0.22, 0.26, 0.6, c, 0, 0.3, 0, 12);
  cyl(g, 0.34, 0.34, 0.1, c, 0, 0.65, 0, 12);
  return g;
}

function buildWater(c0) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: c0, roughness: 0.15, metalness: 0.5, transparent: true, opacity: 0.9 });
  g.userData.mainMats = [m];
  const geom = new THREE.PlaneGeometry(120, 120, 60, 60).rotateX(-Math.PI / 2);
  const surf = new THREE.Mesh(geom, m);
  surf.receiveShadow = true;
  g.add(surf);
  const bed = new THREE.Mesh(cached('seabed', () => new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2)), S('#0d2230', { r: 1 }));
  bed.position.y = -8;
  g.add(bed);
  g.userData.parts = { geom, base: Float32Array.from(geom.attributes.position.array), root: g };
  return g;
}
function animWater({ geom, base, root }, t) {
  const pos = geom.attributes.position, sx = root.scale.x, sz = root.scale.z;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3] * sx, z = base[i * 3 + 2] * sz;
    pos.array[i * 3 + 1] = Math.sin(x * 0.08 + t * 1.1) * 0.16 + Math.cos(z * 0.11 + t * 0.8) * 0.12 + Math.sin((x + z) * 0.05 + t * 0.6) * 0.08;
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
}

function buildRail(c0) {
  const [g, c] = root(c0, { m: 0.8, r: 0.3 });
  boxB(g, 40, 0.2, 1.8, P.concreteDark());
  for (const z of [-0.5, 0.5]) boxB(g, 40, 0.18, 0.12, c, 0, 0.2, z);
  return g;
}

function buildKeelBlock(c0) {
  const [g, c] = root(c0, { r: 0.9, m: 0 });
  boxB(g, 1.4, 0.5, 2.2, P.concreteDark());
  boxB(g, 1.2, 0.4, 2, c, 0, 0.5);
  boxB(g, 1.2, 0.4, 2, c, 0, 0.9);
  return g;
}

/* =========================================================
   人员 / 标识
   ========================================================= */
function buildWorker(c0) {
  const [g, c] = root(c0, { r: 0.8, m: 0 });
  for (const z of [-0.1, 0.1]) boxB(g, 0.16, 0.8, 0.14, P.dark(), 0, 0, z);
  mesh(g, geo('capsule', 0.2, 0.45), c, 0, 1.12, 0);
  sph(g, 0.15, S('#e0b48a', { r: 0.8 }), 0, 1.62, 0);
  mesh(g, cached('helmet', () => new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), P.yellow(), 0, 1.66, 0);
  return g;
}

function buildCone(c0) {
  const [g, c] = root(c0, { r: 0.6, m: 0 });
  boxB(g, 0.42, 0.04, 0.42, P.dark());
  mesh(g, geo('cone', 0.18, 0.6), c, 0, 0.34, 0);
  cyl(g, 0.115, 0.13, 0.1, P.white(), 0, 0.36, 0, 16);
  return g;
}

/* =========================================================
   注册表
   ========================================================= */
export const CATEGORIES = [
  { id: 'production', name: '生产设备' },
  { id: 'lifting', name: '起重设备' },
  { id: 'vehicle', name: '运输车辆' },
  { id: 'storage', name: '仓储物料' },
  { id: 'utility', name: '能源管线' },
  { id: 'building', name: '建筑结构' },
  { id: 'shipyard', name: '船厂专用' },
  { id: 'people', name: '人员标识' },
];

export const ASSETS = {
  machine:     { name: '加工中心',   cat: 'production', icon: '🏭', color: '#4f8fe8', build: buildMachine },
  cnc:         { name: '数控机床',   cat: 'production', icon: '⚙️', color: '#d9dee3', build: buildCNC },
  press:       { name: '冲压机',     cat: 'production', icon: '🔨', color: '#c0392b', build: buildPress, animate: animPress },
  cutter:      { name: '数控切割机', cat: 'production', icon: '✂️', color: '#2f6fd6', build: buildCutter, animate: animCutter },
  conveyor:    { name: '传送带',     cat: 'production', icon: '🛤️', color: '#9aa4b2', build: buildConveyor, animate: animConveyor },
  robot:       { name: '机械臂',     cat: 'production', icon: '🦾', color: '#ffb454', build: buildRobot, animate: animRobot },
  welder:      { name: '焊接机器人', cat: 'production', icon: '⚡', color: '#e8742a', build: buildWelder, animate: animWelder },
  paintbooth:  { name: '喷涂房',     cat: 'production', icon: '🎨', color: '#dfe6ec', build: buildPaintBooth },

  gantry:      { name: '门式起重机', cat: 'lifting', icon: '🏗️', color: '#f0b429', build: buildGantry, animate: animGantry },
  portalcrane: { name: '门座起重机', cat: 'lifting', icon: '🏗️', color: '#e04b3a', build: buildPortalCrane, animate: animPortal },
  towercrane:  { name: '塔式起重机', cat: 'lifting', icon: '🗼', color: '#f2c12e', build: buildTowerCrane, animate: animTower },
  bridgecrane: { name: '桥式行车',   cat: 'lifting', icon: '🌉', color: '#f0b429', build: buildBridgeCrane, animate: animBridge },

  forklift:    { name: '叉车',       cat: 'vehicle', icon: '🚜', color: '#f2b705', build: buildForklift },
  agv:         { name: 'AGV 小车',   cat: 'vehicle', icon: '🤖', color: '#ff8c1a', build: buildAGV },
  truck:       { name: '厢式货车',   cat: 'vehicle', icon: '🚚', color: '#2f6fd6', build: buildTruck },
  transporter: { name: '平板运输车', cat: 'vehicle', icon: '🛻', color: '#e8742a', build: buildTransporter },

  shelf:       { name: '货架',       cat: 'storage', icon: '🗄️', color: '#2f6fd6', build: buildShelf },
  crate:       { name: '货箱',       cat: 'storage', icon: '📦', color: '#b5651d', build: buildCrate },
  pallet:      { name: '托盘货物',   cat: 'storage', icon: '🧱', color: '#c49a6c', build: buildPallet },
  container:   { name: '集装箱',     cat: 'storage', icon: '🚢', color: '#c0392b', build: buildContainer },
  steelplates: { name: '钢板堆',     cat: 'storage', icon: '▤', color: '#7d8794', build: buildSteelPlates },
  pipestack:   { name: '钢管堆',     cat: 'storage', icon: '◎', color: '#6b7684', build: buildPipeStack },

  tank:        { name: '储罐',       cat: 'utility', icon: '🛢️', color: '#4fb286', build: buildTank },
  pipe:        { name: '管道',       cat: 'utility', icon: '🔧', color: '#6b7684', build: buildPipe },
  coolingtower:{ name: '冷却塔',     cat: 'utility', icon: '♨️', color: '#c9c6bd', build: buildCoolingTower, animate: animPuffs },
  chimney:     { name: '烟囱',       cat: 'utility', icon: '🏭', color: '#c0392b', build: buildChimney, animate: animPuffs },
  transformer: { name: '变压器',     cat: 'utility', icon: '🔌', color: '#6d8a7a', build: buildTransformer },

  workshop:    { name: '厂房',       cat: 'building', icon: '🏬', color: '#c8d0d8', build: buildWorkshop },
  office:      { name: '办公楼',     cat: 'building', icon: '🏢', color: '#9fb3c8', build: buildOffice },
  cabin:       { name: '控制室',     cat: 'building', icon: '🏠', color: '#3a7bd5', build: buildControlRoom },
  wall:        { name: '墙体',       cat: 'building', icon: '🧱', color: '#8a909a', build: buildWall },
  pillar:      { name: '立柱',       cat: 'building', icon: '🏛️', color: '#a7afba', build: buildPillar },
  fence:       { name: '围栏',       cat: 'building', icon: '🚧', color: '#9aa4b2', build: buildFence },
  platform:    { name: '钢平台',     cat: 'building', icon: '🪜', color: '#f2b705', build: buildPlatform },
  scaffold:    { name: '脚手架',     cat: 'building', icon: '🪜', color: '#c9a227', build: buildScaffold },
  road:        { name: '道路',       cat: 'building', icon: '🛣️', color: '#3a3d42', build: buildRoad },
  lamp:        { name: '路灯',       cat: 'building', icon: '💡', color: '#7b838d', build: buildLamp },

  drydock:     { name: '干船坞',     cat: 'shipyard', icon: '⚓', color: '#a7a49b', build: buildDryDock },
  ship:        { name: '散货船',     cat: 'shipyard', icon: '🚢', color: '#1f3b5c', build: buildShip },
  hullwip:     { name: '在建船体',   cat: 'shipyard', icon: '🛳️', color: '#a8553a', build: buildHullWip },
  hullblock:   { name: '船体分段',   cat: 'shipyard', icon: '🧩', color: '#9c5a3c', build: buildHullBlock },
  tug:         { name: '拖船',       cat: 'shipyard', icon: '⛴️', color: '#c0392b', build: buildTug, animate: animTug },
  quay:        { name: '码头岸壁',   cat: 'shipyard', icon: '🧱', color: '#b3b0a6', build: buildQuay },
  bollard:     { name: '系船柱',     cat: 'shipyard', icon: '🪝', color: '#2b323c', build: buildBollard },
  water:       { name: '水域',       cat: 'shipyard', icon: '🌊', color: '#1d4e6b', build: buildWater, animate: animWater, locked: true, placeY: -1.2 },
  rail:        { name: '起重机轨道', cat: 'shipyard', icon: '🛤️', color: '#8f99a6', build: buildRail },
  keelblock:   { name: '墩木',       cat: 'shipyard', icon: '🪵', color: '#a67c52', build: buildKeelBlock },

  worker:      { name: '工人',       cat: 'people', icon: '👷', color: '#ff7a1a', build: buildWorker },
  cone:        { name: '安全锥',     cat: 'people', icon: '🔺', color: '#ff5a1f', build: buildCone },
};

/** 驱动某个素材实例的动画 */
export function animateAsset(obj, t, dt) {
  const def = ASSETS[obj.userData.factoryType];
  if (def && def.animate && obj.userData.parts) def.animate(obj.userData.parts, t, dt);
}

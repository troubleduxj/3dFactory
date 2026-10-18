import * as THREE from 'three';
import { P, S, LM, box, boxB, cyl, sph, mesh, geo, wheel, cylX, lattice, group, root, mainLine, makeHook, setHook, ph, cached, cachedMat } from './kit';
import type { Parts } from './kit';

/* =========================================================
   生产设备
   ========================================================= */
export function buildMachine(c0: string): THREE.Group {
  const [g, c] = root(c0);
  boxB(g, 2.2, 0.12, 1.6, P.dark());
  boxB(g, 2, 1.6, 1.4, c, 0, 0.12);
  boxB(g, 1.2, 0.5, 1, P.dark(), -0.2, 1.72);
  cyl(g, 0.15, 0.35, 0.6, P.dark(), 0.45, 2.5, 0, 16);
  box(g, 0.04, 0.55, 0.8, P.screen(), 1.02, 1.05, 0);
  box(g, 1.1, 0.7, 0.04, P.glass(), -0.3, 1.0, 0.71);
  return g;
}

export function buildCNC(c0: string): THREE.Group {
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

export function buildPress(c0: string): THREE.Group {
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
export function animPress({ ram, ph }: Parts, t: number) {
  const k = (Math.sin(t * 2.2 + ph) + 1) / 2;
  ram.position.y = 2.4 + k * 0.85;
}

export function buildCutter(c0: string): THREE.Group {
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
export function animCutter({ gantry, head, spark, ph }: Parts, t: number) {
  gantry.position.x = Math.sin(t * 0.45 + ph) * 2.8;
  head.position.z = Math.sin(t * 1.1 + ph) * 1.1;
  spark.scale.setScalar(0.6 + Math.random() * 0.8);
}

export function buildConveyor(c0: string): THREE.Group {
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
export function animConveyor({ rollers }: Parts, t: number, dt: number) {
  rollers.children.forEach((pkg: THREE.Object3D) => {
    pkg.position.x += dt * 0.9;
    if (pkg.position.x > 1.8) pkg.position.x = -1.8;
  });
}

export function buildRobot(c0: string): THREE.Group {
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
export function animRobot({ turret, upper, ph }: Parts, t: number) {
  turret.rotation.y = Math.sin(t * 0.8 + ph) * 0.9;
  upper.rotation.z = -0.3 + Math.sin(t * 1.6 + ph) * 0.35;
}

export function buildWelder(c0: string): THREE.Group {
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
export function animWelder({ turret, shoulder, elbow, spark, ph }: Parts, t: number) {
  turret.rotation.y = Math.sin(t * 0.7 + ph) * 0.35;
  shoulder.rotation.z = -0.25 + Math.sin(t * 1.1 + ph) * 0.1;
  elbow.rotation.z = -0.15 + Math.sin(t * 1.3 + ph + 1) * 0.12;
  spark.visible = Math.random() > 0.25;
  spark.scale.setScalar(0.6 + Math.random());
}

export function buildPaintBooth(c0: string): THREE.Group {
  const [g, c] = root(c0);
  boxB(g, 7, 3.4, 4.5, c);
  box(g, 6.2, 0.8, 4.56, P.glassDark(), 0, 2.3, 0);
  box(g, 0.06, 2.6, 2.2, P.dark(), 3.53, 1.3, 0);
  for (const x of [-2, 2]) cyl(g, 0.35, 0.35, 1.4, P.steel(), x, 4.1, 1, 16);
  boxB(g, 2.2, 1, 1.4, S('#5d6d7e', { m: 0.4 }), -0.5, 3.4, -1.2);
  return g;
}

/* =========================================================
   起重设备（通用）
   ========================================================= */
export function buildTowerCrane(c0: string): THREE.Group {
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
export function animTower({ slew, trolley, hook, ph }: Parts, t: number) {
  slew.rotation.y = t * 0.12 + ph;
  trolley.position.x = 14 + Math.sin(t * 0.4 + ph) * 8;
  setHook(hook, 14 + Math.sin(t * 0.3 + ph) * 6, 0, -0.5);
}

export function buildBridgeCrane(c0: string): THREE.Group {
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
export function animBridge({ bridge, trolley, hook, ph }: Parts, t: number) {
  bridge.position.z = Math.sin(t * 0.25 + ph) * 7.5;
  trolley.position.x = Math.sin(t * 0.45 + ph) * 5.5;
  setHook(hook, 3 + Math.sin(t * 0.5 + ph) * 1.2);
}

/* =========================================================
   运输车辆（车头朝 +X）
   ========================================================= */
export function buildForklift(c0: string): THREE.Group {
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

export function buildAGV(c0: string): THREE.Group {
  const [g, c] = root(c0);
  boxB(g, 1.8, 0.35, 1.1, c, 0, 0.08);
  boxB(g, 1.6, 0.04, 0.95, P.dark(), 0, 0.43);
  box(g, 0.02, 0.08, 0.6, S('#29b6f6', { e: '#29b6f6', ei: 2 }), 0.91, 0.28, 0);
  for (const x of [-0.6, 0.6]) for (const z of [-0.45, 0.45]) wheel(g, 0.1, 0.08, x, 0.1, z);
  return g;
}

export function buildTruck(c0: string): THREE.Group {
  const [g, c] = root(c0);
  boxB(g, 8, 0.4, 2.2, P.dark(), 0, 0.6);
  boxB(g, 2.1, 2.2, 2.3, c, 2.9, 1.0);
  box(g, 0.05, 0.9, 2.0, P.glassDark(), 3.97, 2.6, 0);
  boxB(g, 0.2, 0.4, 2.3, P.dark(), 4.0, 0.6);
  boxB(g, 5.4, 2.6, 2.4, P.white(), -0.9, 1.0);
  for (const x of [3.0, -1.8, -3.0]) for (const z of [-1.0, 1.0]) wheel(g, 0.5, 0.35, x, 0.5, z);
  return g;
}

export function buildTransporter(c0: string): THREE.Group {
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
export function buildShelf(c0: string): THREE.Group {
  const [g, c] = root(c0);
  for (const x of [-1.45, 1.45]) for (const z of [-0.5, 0.5]) boxB(g, 0.08, 3.6, 0.08, c, x, 0, z);
  for (const y of [0.15, 1.3, 2.45]) {
    for (const z of [-0.5, 0.5]) boxB(g, 3, 0.12, 0.08, P.orange(), 0, y, z);
    if (y < 2) for (const x of [-0.75, 0.75]) boxB(g, 1.1, 0.8, 0.9, P.carton(), x, y + 0.12, 0);
  }
  return g;
}

export function buildCrate(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.85, m: 0 });
  const b = boxB(g, 1, 1, 1, c);
  const edges = new THREE.LineSegments(cached('crateEdges', () => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))), LM('#000000', 0.3));
  edges.position.copy(b.position);
  g.add(edges);
  return g;
}

export function buildPallet(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.9, m: 0 });
  for (const z of [-0.42, 0, 0.42]) boxB(g, 1.2, 0.1, 0.15, P.wood(), 0, 0, z);
  boxB(g, 1.2, 0.04, 1.0, P.wood(), 0, 0.1);
  for (let l = 0; l < 2; l++) for (const x of [-0.3, 0.3]) for (const z of [-0.24, 0.24])
    boxB(g, 0.56, 0.4, 0.46, c, x, 0.14 + l * 0.41, z);
  return g;
}

export function buildContainer(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.6, m: 0.4 });
  boxB(g, 6.06, 2.59, 2.44, c);
  const ribs = cached('containerRibs', () => {
    const pts: THREE.Vector3[] = [];
    for (let x = -2.85; x <= 2.86; x += 0.3) for (const z of [-1.226, 1.226]) {
      pts.push(new THREE.Vector3(x, 0.12, z), new THREE.Vector3(x, 2.47, z));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  });
  g.add(new THREE.LineSegments(ribs, LM('#000000', 0.35)));
  for (const x of [-2.96, 2.96]) for (const z of [-1.15, 1.15]) boxB(g, 0.15, 2.6, 0.15, P.dark(), x, 0, z);
  return g;
}

export function buildSteelPlates(c0: string): THREE.Group {
  const [g, c] = root(c0, { m: 0.75, r: 0.4 });
  for (const x of [-3, 0, 3]) boxB(g, 0.25, 0.25, 2.8, P.wood(), x, 0, 0);
  for (let i = 0; i < 6; i++) boxB(g, 8, 0.1, 2.5, c, (i % 2) * 0.08 - 0.04, 0.25 + i * 0.1, ((i * 7) % 3 - 1) * 0.05);
  return g;
}

export function buildPipeStack(c0: string): THREE.Group {
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
export function buildTank(c0: string): THREE.Group {
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

export function buildPipe(c0: string): THREE.Group {
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

export function buildCoolingTower(c0: string): THREE.Group {
  const [g, c] = root(c0, { ds: true, r: 0.9, m: 0 });
  const lathe = cached('coolLathe', () => {
    const pts: THREE.Vector2[] = [];
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
export function buildChimney(c0: string): THREE.Group {
  const [g, c] = root(c0);
  boxB(g, 3.5, 1, 3.5, P.concrete());
  for (let i = 0; i < 6; i++) {
    const rb = 1.3 - i * 0.07, rt = 1.3 - (i + 1) * 0.07;
    cyl(g, rt, rb, 4, i % 2 ? P.white() : c, 0, 1 + 2 + i * 4, 0, 20);
  }
  g.userData.parts = { puffs: makePuffs(g, P.smoke(), 25, 1.2), ph: ph() };
  return g;
}
function makePuffs(g: THREE.Group, m: THREE.Material, y: number, size: number) {
  return [0, 1, 2].map(i => {
    const s = sph(g, 1, m, 0, y, 0);
    s.castShadow = s.receiveShadow = false;
    s.userData.size = size; s.userData.y0 = y; s.userData.i = i;
    return s;
  });
}
export function animPuffs({ puffs, ph }: Parts, t: number) {
  for (const s of puffs) {
    const k = ((t * 0.12 + ph + s.userData.i / 3) % 1);
    s.position.y = s.userData.y0 + k * 10;
    s.position.x = k * 3;
    s.scale.setScalar(0.3 + Math.sin(k * Math.PI) * s.userData.size * 2);
  }
}

export function buildTransformer(c0: string): THREE.Group {
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
export function buildWorkshop(c0: string): THREE.Group {
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

export function buildOffice(c0: string): THREE.Group {
  const [g, c] = root(c0);
  const floors = 5, fh = 3.4, w = 16, d = 11;
  boxB(g, w, floors * fh, d, c);
  for (let i = 0; i < floors; i++) box(g, w + 0.06, 1.5, d + 0.06, P.glassDark(), 0, i * fh + 1.9, 0);
  boxB(g, w + 0.4, 0.6, d + 0.4, P.white(), 0, floors * fh);
  boxB(g, 3, 1.5, 2.5, P.steel(), 3, floors * fh + 0.6, 1);
  boxB(g, 4, 0.2, 2.5, P.white(), 0, 3.0, d / 2 + 1.2);
  return g;
}

export function buildControlRoom(c0: string): THREE.Group {
  const [g, c] = root(c0);
  boxB(g, 3, 2.5, 2.5, c);
  boxB(g, 3.3, 0.2, 2.8, P.dark(), 0, 2.5);
  box(g, 2.0, 0.9, 0.05, P.glass(), 0.3, 1.6, 1.26);
  box(g, 0.8, 1.6, 0.05, P.dark(), -1, 0.8, 1.26);
  return g;
}

export function buildWall(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.9, m: 0 });
  boxB(g, 4, 2.5, 0.2, c);
  return g;
}

export function buildPillar(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.9, m: 0 });
  boxB(g, 0.9, 0.3, 0.9, P.concreteDark());
  cyl(g, 0.3, 0.3, 3.2, c, 0, 1.9, 0);
  boxB(g, 0.9, 0.3, 0.9, P.concreteDark(), 0, 3.5);
  return g;
}

export function buildFence(c0: string): THREE.Group {
  const [g, c] = root(c0);
  for (let i = 0; i < 5; i++) cyl(g, 0.05, 0.05, 2, c, -5 + i * 2.5, 1, 0, 8);
  for (const y of [0.1, 1.95]) boxB(g, 10, 0.05, 0.05, c, 0, y);
  lattice(g, 10, 1.8, 0.01, 40, 7, 1, LM('#aab4c0', 0.6), 0, 1.05, 0);
  return g;
}

export function buildPlatform(c0: string): THREE.Group {
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

export function buildScaffold(c0: string): THREE.Group {
  const [g, c] = root(c0);
  const lm = mainLine(g, c0);
  lattice(g, 2, 10, 6, 1, 5, 3, lm, 0, 5, 0);
  for (let i = 1; i <= 5; i++) boxB(g, 2, 0.06, 6, P.wood(), 0, i * 2 - 0.06);
  for (const x of [-1, 1]) for (const z of [-3, 3]) boxB(g, 0.08, 10, 0.08, c, x, 0, z);
  return g;
}

let roadTex: THREE.CanvasTexture | null = null;
function getRoadTexture(): THREE.CanvasTexture {
  if (roadTex) return roadTex;
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 204;
  const ctx = cv.getContext('2d')!;
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
export function buildRoad(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.95, m: 0 });
  const r = boxB(g, 20, 0.04, 8, c, 0, 0);
  r.castShadow = false;
  const markMat = cachedMat('roadMarks', () => new THREE.MeshStandardMaterial({ map: getRoadTexture(), transparent: true, roughness: 0.8, depthWrite: false }));
  const marks = mesh(g, cached('roadPlane', () => new THREE.PlaneGeometry(20, 8).rotateX(-Math.PI / 2)), markMat, 0, 0.045, 0);
  marks.castShadow = false;
  return g;
}

export function buildLamp(c0: string): THREE.Group {
  const [g, c] = root(c0, { m: 0.6 });
  cyl(g, 0.08, 0.12, 8, c, 0, 4, 0, 10);
  box(g, 1.6, 0.08, 0.08, c, 0.75, 7.9, 0);
  box(g, 0.6, 0.15, 0.3, P.dark(), 1.5, 7.8, 0);
  box(g, 0.5, 0.02, 0.24, P.lamp(), 1.5, 7.72, 0).castShadow = false;
  return g;
}

/* 场地设施 */
export function buildWater(c0: string): THREE.Group {
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
export function animWater({ geom, base, root }: Parts, t: number) {
  const pos = geom.attributes.position, sx = root.scale.x, sz = root.scale.z;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3] * sx, z = base[i * 3 + 2] * sz;
    pos.array[i * 3 + 1] = Math.sin(x * 0.08 + t * 1.1) * 0.16 + Math.cos(z * 0.11 + t * 0.8) * 0.12 + Math.sin((x + z) * 0.05 + t * 0.6) * 0.08;
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
}

export function buildRail(c0: string): THREE.Group {
  const [g, c] = root(c0, { m: 0.8, r: 0.3 });
  boxB(g, 40, 0.2, 1.8, P.concreteDark());
  for (const z of [-0.5, 0.5]) boxB(g, 40, 0.18, 0.12, c, 0, 0.2, z);
  return g;
}

/* =========================================================
   人员 / 标识
   ========================================================= */
export function buildWorker(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.8, m: 0 });
  for (const z of [-0.1, 0.1]) boxB(g, 0.16, 0.8, 0.14, P.dark(), 0, 0, z);
  mesh(g, geo('capsule', 0.2, 0.45), c, 0, 1.12, 0);
  sph(g, 0.15, S('#e0b48a', { r: 0.8 }), 0, 1.62, 0);
  mesh(g, cached('helmet', () => new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), P.yellow(), 0, 1.66, 0);
  return g;
}

export function buildCone(c0: string): THREE.Group {
  const [g, c] = root(c0, { r: 0.6, m: 0 });
  boxB(g, 0.42, 0.04, 0.42, P.dark());
  mesh(g, geo('cone', 0.18, 0.6), c, 0, 0.34, 0);
  cyl(g, 0.115, 0.13, 0.1, P.white(), 0, 0.36, 0, 16);
  return g;
}


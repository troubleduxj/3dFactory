import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { AssetDef, EnvSettings, LayoutData, LayoutItem, ProjectBundle, Vec3 } from './core/types';
import { AssetRegistry } from './core/registry';
import { walkComponents } from './core/layout';
import { optimizeInstance, planStats } from './core/optimize';
import { renderThumbnail } from './core/thumbs';
import { esc } from './core/html';
import { UserAssetLibrary } from './assets/library';
import { safeThumbnail, validateLayout, validateProjectBundle } from './assets/validate';
import { IdbAssetStore, MemoryAssetStore, type AssetStore } from './assets/store';
import { AssetManagerUI } from './assets/manager-ui';
import { BUILTIN_PACKS } from './packs/index';

/* =========================================================
   FactoryForge 编辑器
   ========================================================= */
type Obj = THREE.Object3D;
// 默认按 HTMLInputElement 返回，便于读写 value / disabled / checked（按钮、下拉框同样具有这些属性）
const $ = <T extends HTMLElement = HTMLInputElement>(id: string): T => document.getElementById(id) as T;
const $in = (id: string) => $<HTMLInputElement>(id);
const r3 = (a: number[]) => a.map(v => Math.round(v * 1000) / 1000) as Vec3;

/** ?nomerge：关闭静态合并（用于对比性能 / 排查合并问题） */
const NO_MERGE = new URLSearchParams(location.search).has('nomerge');

// ---------- 资产注册表 ----------
export const registry = new AssetRegistry();
BUILTIN_PACKS.forEach(p => registry.registerPack(p));

// ---------- 渲染器 / 场景 ----------
const canvas = $<HTMLCanvasElement>('canvas');
const viewport = $('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#11161d');
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxPolarAngle = Math.PI / 2 - 0.02;

const hemi = new THREE.HemisphereLight(0xdfeeff, 0x4a4f55, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const groundMat = new THREE.MeshStandardMaterial({ color: '#2a3038', roughness: 0.95 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), groundMat);
ground.receiveShadow = true;
scene.add(ground);
let grid: THREE.LineSegments | null = null;

const transform = new TransformControls(camera, renderer.domElement);
transform.setSize(0.9);
scene.add(transform);

// ---------- 按需渲染 ----------
let needsRender = true;
const invalidate = () => { needsRender = true; };
orbit.addEventListener('change', invalidate);
transform.addEventListener('change', invalidate);
for (const ev of ['pointerdown', 'pointerup', 'wheel', 'keydown', 'input', 'change']) window.addEventListener(ev, invalidate, true);

// ---------- 环境 ----------
const DEFAULT_ENV: EnvSettings = {
  name: '未命名场景', ground: { w: 60, d: 60, cx: 0, cz: 0 }, groundColor: '#2a3038', background: '#11161d',
  fog: true, grid: true, shadows: true, sun: { intensity: 2.4, azimuth: 35, elevation: 55 },
  camera: { pos: [22, 18, 26], target: [0, 0, 0] },
};
let env: EnvSettings = structuredClone(DEFAULT_ENV);
function mergeEnv(e: Partial<EnvSettings> = {}): EnvSettings {
  return { ...structuredClone(DEFAULT_ENV), ...e, ground: { ...DEFAULT_ENV.ground, ...(e.ground || {}) }, sun: { ...DEFAULT_ENV.sun, ...(e.sun || {}) } };
}
const envSize = () => Math.max(env.ground.w, env.ground.d);

function makeGrid(w: number, d: number, step: number): THREE.LineSegments {
  const pts: number[] = [];
  for (let x = -w / 2; x <= w / 2 + 1e-6; x += step) pts.push(x, 0, -d / 2, x, 0, d / 2);
  for (let z = -d / 2; z <= d / 2 + 1e-6; z += step) pts.push(-w / 2, 0, z, w / 2, 0, z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8090a0, transparent: true, opacity: 0.18, depthWrite: false }));
}

function applyEnv(moveCamera: boolean): void {
  const g = env.ground, size = envSize();
  ground.scale.set(g.w, 1, g.d);
  ground.position.set(g.cx, 0, g.cz);
  groundMat.color.set(env.groundColor);
  (scene.background as THREE.Color).set(env.background);
  scene.fog = env.fog ? new THREE.Fog(env.background, size * 0.9, size * 2.6) : null;
  if (grid) {
    scene.remove(grid);
    grid.geometry.dispose();
    (grid.material as THREE.Material).dispose();
  }
  grid = makeGrid(g.w, g.d, size > 100 ? 5 : 1);
  grid.position.set(g.cx, 0.012, g.cz);
  grid.visible = env.grid;
  scene.add(grid);
  updateSun();
  camera.far = size * 8;
  camera.updateProjectionMatrix();
  orbit.maxDistance = size * 3;
  if (moveCamera && env.camera) {
    camera.position.fromArray(env.camera.pos);
    orbit.target.fromArray(env.camera.target);
    orbit.update();
  }
  invalidate();
}
function updateSun(): void {
  const g = env.ground, size = envSize();
  const az = THREE.MathUtils.degToRad(env.sun.azimuth), el = THREE.MathUtils.degToRad(env.sun.elevation);
  const r = size * 0.9;
  sun.position.set(g.cx + r * Math.cos(el) * Math.sin(az), r * Math.sin(el), g.cz + r * Math.cos(el) * Math.cos(az));
  sun.target.position.set(g.cx, 0, g.cz);
  sun.target.updateMatrixWorld();
  sun.intensity = env.sun.intensity;
  hemi.intensity = 0.5 + env.sun.intensity * 0.25;
  const half = size * 0.65, cam = sun.shadow.camera;
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
  cam.near = 1; cam.far = r * 2.5;
  cam.updateProjectionMatrix();
  const mapSize = size > 100 ? 4096 : 2048;
  if (sun.shadow.mapSize.x !== mapSize) {
    sun.shadow.mapSize.set(mapSize, mapSize);
    if (sun.shadow.map) { sun.shadow.map.dispose(); (sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null; }
  }
  sun.castShadow = env.shadows;
  invalidate();
}

// ---------- 物体 ----------
const objects: Obj[] = [];   // 顶层可编辑物体
let idCounter = 1;
const isEditable = (o: Obj) => !!(o.userData.factoryType || o.userData.isGroup || o.userData.missingType);
const defOf = (o: Obj): AssetDef | undefined => (o.userData.factoryType ? registry.get(o.userData.factoryType) : undefined);

function iconOf(o: Obj): string {
  if (o.userData.isGroup) return '📁';
  if (o.userData.missingType) return '⚠️';
  return defOf(o)?.icon || '▫';
}
function typeName(o: Obj): string {
  if (o.userData.isGroup) return '分组';
  if (o.userData.missingType) return '缺失资产';
  return defOf(o)?.name || '';
}
function defName(o: Obj): string {
  if (o.userData.isGroup) return '分组 ' + o.userData.uid;
  return typeName(o) + ' ' + o.userData.uid;
}

/** 资产缺失（未安装的资产包 / 已删除的用户模型）：显示占位框，保留原始数据以便恢复 */
function buildPlaceholder(type: string): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: '#ff9f43', transparent: true, opacity: 0.25, depthWrite: false }));
  box.position.y = 1;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: '#ff9f43' }));
  edges.position.y = 1;
  g.add(box, edges);
  g.userData.missingType = type;
  g.userData.mainMats = [box.material, edges.material];
  return g;
}

/** 由布局数据构建物体（不加入场景） */
function createFromData(d: LayoutItem): Obj | null {
  let obj: THREE.Group;
  if (d.kind === 'group') {
    obj = new THREE.Group();
    obj.userData.isGroup = true;
    for (const c of d.children || []) {
      const ch = createFromData(c);
      if (ch) obj.add(ch);
    }
    if (!obj.children.length) return null;
    obj.userData.baseColor = '#5b8def';
  } else if (d.kind === 'custom') {
    obj = buildPlaceholder('legacy-custom:' + d.ref);
  } else {
    const def = registry.get(d.type);
    if (!def) {
      obj = buildPlaceholder(d.type);
      if (d.color) obj.userData.savedColor = d.color;
    } else {
      const color = d.color || def.color;
      obj = def.build(color);
      if (def.optimize && !NO_MERGE) optimizeInstance(def.id, obj);
      obj.userData.factoryType = def.id;
      obj.userData.baseColor = color;
    }
  }
  const uid = d.uid ?? idCounter;
  obj.userData.uid = uid;
  idCounter = Math.max(idCounter, uid + 1);
  obj.name = d.name || defName(obj);
  if (d.position) obj.position.fromArray(d.position);
  if (d.rotation) obj.rotation.set(d.rotation[0], d.rotation[1], d.rotation[2]);
  if (d.scale) obj.scale.fromArray(d.scale);
  obj.userData.locked = d.locked ?? (d.kind !== 'group' && d.kind !== 'custom' && !!registry.get(d.type)?.locked);
  obj.visible = !d.hidden;
  return obj;
}
function serializeObject(o: Obj): LayoutItem {
  const base = {
    uid: o.userData.uid as number, name: o.name,
    position: r3(o.position.toArray()),
    rotation: r3([o.rotation.x, o.rotation.y, o.rotation.z]),
    scale: r3(o.scale.toArray()),
    ...(o.userData.locked ? { locked: true } : {}),
    ...(!o.visible ? { hidden: true } : {}),
  };
  if (o.userData.isGroup) return { kind: 'group', ...base, children: o.children.filter(isEditable).map(serializeObject) };
  if (o.userData.missingType) {
    const t = o.userData.missingType as string;
    if (t.startsWith('legacy-custom:')) return { kind: 'custom', ref: t.slice(14), ...base };
    return { kind: 'component', type: t, ...(o.userData.savedColor ? { color: o.userData.savedColor } : {}), ...base };
  }
  return { kind: 'component', type: o.userData.factoryType, color: o.userData.baseColor, ...base };
}
function stripUids(d: LayoutItem): LayoutItem {
  delete d.uid;
  if (d.kind === 'group') d.children.forEach(stripUids);
  return d;
}

function addToScene(obj: Obj): void {
  scene.add(obj);
  objects.push(obj);
  invalidate();
}
function disposeObject(obj: Obj): void {
  obj.traverse(n => {
    const g = (n as THREE.Mesh).geometry;
    if (g && !g.userData.shared) g.dispose();
  });
  ((obj.userData.mainMats || []) as THREE.Material[]).forEach(m => m.dispose());
}
function removeFromScene(obj: Obj): void {
  removeOutline(obj);
  obj.parent?.remove(obj);
  const i = objects.indexOf(obj);
  if (i >= 0) objects.splice(i, 1);
  disposeObject(obj);
  invalidate();
}
function setColor(obj: Obj, color: string): void {
  obj.userData.baseColor = color;
  if (obj.userData.isGroup) obj.children.forEach(c => isEditable(c) && setColor(c, color));
  else if (defOf(obj)?.colorable) ((obj.userData.mainMats || []) as THREE.MeshStandardMaterial[]).forEach(m => m.color.set(color));
  invalidate();
}
/** 场景中使用某资产的实例数（含分组内） */
function usageOf(assetId: string): number {
  let n = 0;
  const walk = (o: Obj) => {
    if (o.userData.isGroup) o.children.forEach(walk);
    else if (o.userData.factoryType === assetId || o.userData.missingType === assetId) n++;
  };
  objects.forEach(walk);
  return n;
}
/** 资产更新后（新版本 / 重新处理 / 恢复）重建场景中的实例，保持变换和层级 */
function rebuildInstances(assetId: string): number {
  detachMultiProxy();
  let n = 0;
  const visit = (o: Obj): void => {
    if (o.userData.isGroup) { [...o.children].forEach(visit); return; }
    if (o.userData.factoryType !== assetId && o.userData.missingType !== assetId) return;
    const fresh = createFromData(serializeObject(o));
    if (!fresh || !o.parent) return;
    const parent = o.parent, idx = parent.children.indexOf(o);
    removeOutline(o);
    parent.remove(o);
    disposeObject(o);
    parent.children.splice(idx, 0, fresh);
    fresh.parent = parent;
    const ti = objects.indexOf(o);
    if (ti >= 0) objects[ti] = fresh;
    selection = selection.map(s => (s === o ? fresh : s));
    n++;
  };
  [...objects].forEach(visit);
  select(selection, { silent: true });
  refreshAll();
  return n;
}

// ---------- 序列化 ----------
function serialize(withCamera = true): LayoutData & { env: EnvSettings } {
  const had = !!multiProxy;
  if (had) detachMultiProxy();
  const data = { app: 'FactoryForge', version: 3, env: structuredClone(env), objects: objects.map(serializeObject) };
  if (withCamera) data.env.camera = { pos: r3(camera.position.toArray()), target: r3(orbit.target.toArray()) };
  else delete data.env.camera;
  if (had) attachMultiProxy();
  return data;
}
function clearAll() {
  detachMultiProxy();
  transform.detach();
  selection.forEach(removeOutline);
  selection = [];
  objects.slice().forEach(removeFromScene);
}
/** 加载布局；返回未能还原的物体数 */
function loadData(data: LayoutData, { resetHist = true, moveCamera = true, selectUids = null as number[] | null } = {}): number {
  if (!data || !Array.isArray(data.objects)) throw new Error('无效的布局数据');
  clearAll();
  env = mergeEnv(data.env);
  applyEnv(moveCamera);
  let missing = 0;
  idCounter = 1;
  for (const item of data.objects) {
    const obj = createFromData(item);
    if (obj) addToScene(obj); else missing++;
  }
  select(selectUids ? objects.filter(o => selectUids.includes(o.userData.uid)) : [], { silent: true });
  if (resetHist) resetHistory();
  refreshAll();
  return missing;
}

// ---------- 选择 / 高亮 ----------
let selection: Obj[] = [];
let multiProxy: THREE.Group | null = null;

function addOutline(obj: Obj): void {
  removeOutline(obj);
  const helper = new THREE.Box3Helper(new THREE.Box3().setFromObject(obj), obj.userData.locked ? 0xff9f43 : 0x4f9dff);
  helper.raycast = () => {};
  obj.userData.outline = helper;
  scene.add(helper);
}
function removeOutline(obj: Obj): void {
  const h = obj.userData.outline;
  if (!h) return;
  scene.remove(h); h.geometry.dispose(); h.material.dispose();
  obj.userData.outline = null;
}
function updateOutlines() {
  for (const o of selection) o.userData.outline?.box.setFromObject(o);
}

function attachMultiProxy() {
  detachMultiProxy();
  if (selection.some(o => o.userData.locked)) return;
  const proxy = new THREE.Group();
  multiProxy = proxy;
  const box = new THREE.Box3();
  selection.forEach(o => box.expandByObject(o));
  box.getCenter(proxy.position);
  proxy.position.y = box.min.y;
  scene.add(proxy);
  selection.forEach(o => proxy.attach(o));
  transform.attach(proxy);
}
function detachMultiProxy() {
  if (!multiProxy) return;
  transform.detach();
  [...multiProxy.children].forEach(o => scene.attach(o));
  scene.remove(multiProxy);
  multiProxy = null;
}

function select(arr: (Obj | null | undefined)[], { silent = false } = {}): void {
  detachMultiProxy();
  selection.forEach(removeOutline);
  selection = [...new Set(arr.filter((o): o is Obj => !!o))];
  transform.detach();
  if (selection.length === 1 && !selection[0].userData.locked) transform.attach(selection[0]);
  else if (selection.length > 1) attachMultiProxy();
  selection.forEach(addOutline);
  if (!silent) refreshAll();
}
function toggleSelect(obj: Obj): void {
  select(selection.includes(obj) ? selection.filter(o => o !== obj) : [...selection, obj]);
}

// ---------- 历史记录（撤销 / 重做） ----------
const history: { stack: { json: string; sel: number[] }[]; index: number; lock: boolean } = { stack: [], index: -1, lock: false };
function snapshot() { return { json: JSON.stringify(serialize(false)), sel: selection.map(o => o.userData.uid) }; }
function resetHistory() { history.stack = [snapshot()]; history.index = 0; updateHistoryButtons(); }
function pushHistory() {
  if (history.lock) return;
  const s = snapshot();
  if (history.stack[history.index]?.json === s.json) { history.stack[history.index].sel = s.sel; return; }
  history.stack.splice(history.index + 1);
  history.stack.push(s);
  if (history.stack.length > 60) history.stack.shift();
  history.index = history.stack.length - 1;
  updateHistoryButtons();
}
let histTimer: ReturnType<typeof setTimeout> | undefined;
function pushHistorySoon() { clearTimeout(histTimer); histTimer = setTimeout(pushHistory, 400); }
function restoreHistory(i: number): void {
  const s = history.stack[i];
  if (!s) return;
  history.lock = true;
  history.index = i;
  try { loadData(JSON.parse(s.json), { resetHist: false, moveCamera: false, selectUids: s.sel }); }
  finally { history.lock = false; }
  updateHistoryButtons();
}
const undo = () => { if (history.index > 0) { restoreHistory(history.index - 1); toast('已撤销'); } };
const redo = () => { if (history.index < history.stack.length - 1) { restoreHistory(history.index + 1); toast('已重做'); } };
function updateHistoryButtons() {
  $('btnUndo').disabled = history.index <= 0;
  $('btnRedo').disabled = history.index >= history.stack.length - 1;
}

// ---------- 编辑操作 ----------
let snapOn = false;
const snapV = (v: number) => (snapOn ? Math.round(v) : Math.round(v * 100) / 100);

function addAsset(type: string, x: number, z: number): void {
  const def = registry.get(type);
  if (!def) return;
  const obj = createFromData({ kind: 'component', type: def.id, position: [snapV(x), def.placeY ?? 0, snapV(z)] });
  if (!obj) return;
  addToScene(obj);
  select([obj]);
  pushHistory();
}
function deleteSelected() {
  if (!selection.length) return;
  const n = selection.length;
  detachMultiProxy();
  selection.slice().forEach(removeFromScene);
  selection = [];
  select([]);
  pushHistory();
  toast(`已删除 ${n} 个物体`);
}
function duplicateSelected() {
  if (!selection.length) return;
  detachMultiProxy();
  const step = snapOn ? 2 : 1.5;
  const clones = selection.map(src => {
    const d = stripUids(serializeObject(src));
    const pos = d.position ?? [0, 0, 0];
    d.position = [pos[0] + step, pos[1], pos[2] + step];
    d.locked = false;
    const c = createFromData(d);
    if (c) addToScene(c);
    return c;
  });
  select(clones);
  pushHistory();
}
function groupSelected() {
  if (selection.length < 2) return toast('请至少选择 2 个物体再成组');
  detachMultiProxy();
  const box = new THREE.Box3();
  selection.forEach(o => box.expandByObject(o));
  const grp = new THREE.Group();
  grp.userData.isGroup = true;
  grp.userData.uid = idCounter++;
  grp.userData.baseColor = '#5b8def';
  grp.name = defName(grp);
  box.getCenter(grp.position);
  grp.position.y = 0;
  scene.add(grp);
  selection.forEach(o => {
    removeOutline(o);
    objects.splice(objects.indexOf(o), 1);
    grp.attach(o);
  });
  objects.push(grp);
  selection = [];
  select([grp]);
  pushHistory();
}
function ungroupSelected() {
  const groups = selection.filter(o => o.userData.isGroup);
  if (!groups.length) return toast('请选择一个分组');
  detachMultiProxy();
  const freed: Obj[] = [];
  groups.forEach(grp => {
    removeOutline(grp);
    [...grp.children].filter(isEditable).forEach(ch => { scene.attach(ch); objects.push(ch); freed.push(ch); });
    scene.remove(grp);
    objects.splice(objects.indexOf(grp), 1);
  });
  selection = [];
  select(freed);
  pushHistory();
}
function setLocked(list: Obj[], v: boolean): void {
  list.forEach(o => (o.userData.locked = v));
  select(selection);
  pushHistory();
}
function setHidden(list: Obj[], hidden: boolean): void {
  list.forEach(o => (o.visible = !hidden));
  pushHistory();
  refreshAll();
}
function dropToGround(list: Obj[]): void {
  detachMultiProxy();
  list.forEach(o => {
    const b = new THREE.Box3().setFromObject(o);
    o.position.y -= b.min.y;
  });
  select(selection);
  pushHistory();
}
/** 多选对齐：axis 'x'|'z'，mode 'min'|'center'|'max'|'dist' */
function alignSelected(axis: 'x' | 'z', mode: 'min' | 'center' | 'max' | 'dist'): void {
  if (selection.length < 2) return;
  detachMultiProxy();
  const items = selection.map(o => ({ o, b: new THREE.Box3().setFromObject(o) }));
  if (mode === 'dist') {
    items.sort((a, b) => a.b.getCenter(new THREE.Vector3())[axis] - b.b.getCenter(new THREE.Vector3())[axis]);
    const c0 = items[0].b.getCenter(new THREE.Vector3())[axis];
    const c1 = items[items.length - 1].b.getCenter(new THREE.Vector3())[axis];
    items.forEach((it, i) => {
      const c = it.b.getCenter(new THREE.Vector3())[axis];
      it.o.position[axis] += c0 + ((c1 - c0) * i) / (items.length - 1) - c;
    });
  } else {
    const all = new THREE.Box3();
    items.forEach(it => all.union(it.b));
    const target = mode === 'min' ? all.min[axis] : mode === 'max' ? all.max[axis] : all.getCenter(new THREE.Vector3())[axis];
    items.forEach(({ o, b }) => {
      const v = mode === 'min' ? b.min[axis] : mode === 'max' ? b.max[axis] : b.getCenter(new THREE.Vector3())[axis];
      o.position[axis] += target - v;
    });
  }
  select(selection);
  pushHistory();
}

// ---------- 视口拾取 ----------
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.15;
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let downInfo: { x: number; y: number; button: number; gizmo: boolean } | null = null;

function setPointer(e: { clientX: number; clientY: number }): void {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
function groundPoint(e: { clientX: number; clientY: number }): THREE.Vector3 | null {
  setPointer(e);
  return raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
}
function pickObject(e: { clientX: number; clientY: number }): Obj | null {
  setPointer(e);
  const candidates = objects.filter(o => o.visible && !o.userData.locked);
  const hits = raycaster.intersectObjects(candidates, true);
  for (const h of hits) {
    let n: Obj | null = h.object, visible = true;
    for (let p: Obj | null = n; p; p = p.parent) if (!p.visible) visible = false;
    if (!visible) continue;
    while (n && !objects.includes(n)) n = n.parent;
    if (n) return n;
  }
  return null;
}
canvas.addEventListener('pointerdown', (e) => {
  downInfo = { x: e.clientX, y: e.clientY, button: e.button, gizmo: transform.axis !== null };
});
canvas.addEventListener('pointerup', (e) => {
  if (!downInfo || downInfo.button !== 0 || downInfo.gizmo) return (downInfo = null);
  const moved = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
  downInfo = null;
  if (moved > 4) return;
  const hit = pickObject(e);
  if (hit) e.shiftKey ? toggleSelect(hit) : select([hit]);
  else if (!e.shiftKey) select([]);
});
canvas.addEventListener('dblclick', (e) => { const hit = pickObject(e); if (hit) { select([hit]); focusSelection(); } });
canvas.addEventListener('pointermove', (e) => {
  const p = groundPoint(e);
  if (p) $('stCursor').textContent = `X ${p.x.toFixed(1)} · Z ${p.z.toFixed(1)}`;
});

transform.addEventListener('dragging-changed', (e) => {
  orbit.enabled = !e.value;
  if (!e.value) {
    if (multiProxy) attachMultiProxy(); // 重新计算多选中心
    pushHistory();
  }
});
transform.addEventListener('objectChange', () => syncInspector());

// 拖拽素材到视口
viewport.addEventListener('dragover', (e) => {
  if (![...e.dataTransfer!.types].includes('text/plain')) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
  $('dropHint').classList.remove('hidden');
});
viewport.addEventListener('dragleave', (e) => { if (!viewport.contains(e.relatedTarget as Node | null)) $('dropHint').classList.add('hidden'); });
viewport.addEventListener('drop', (e) => {
  e.preventDefault();
  $('dropHint').classList.add('hidden');
  const key = e.dataTransfer!.getData('text/plain').replace(/^asset:/, '');
  const p = groundPoint(e);
  if (registry.get(key) && p) addAsset(key, p.x, p.z);
});

// ---------- 场景大纲 ----------
let activeTab = 'library';
let outlinerQueued = false;
function scheduleOutliner() {
  if (outlinerQueued) return;
  outlinerQueued = true;
  requestAnimationFrame(() => { outlinerQueued = false; renderOutliner(); });
}
function renderOutliner() {
  $('objCountBadge').textContent = String(objects.length);
  if (activeTab !== 'outliner') return;
  const q = $('olSearch').value.trim().toLowerCase();
  const html = [];
  for (const o of objects) {
    if (q && !o.name.toLowerCase().includes(q)) continue;
    const cls = ['ol-row', selection.includes(o) ? 'sel' : '', o.visible ? '' : 'off'].join(' ');
    const n = o.userData.isGroup ? `<span class="ol-sub">${o.children.filter(isEditable).length}</span>` : '';
    html.push(`<div class="${cls}" data-uid="${esc(o.userData.uid)}"><span class="ol-ico">${esc(iconOf(o))}</span><span class="ol-name">${esc(o.name)}</span>${n}` +
      `<button class="ol-btn ${o.visible ? '' : 'on'}" data-act="vis" title="显示 / 隐藏">${o.visible ? '👁' : '—'}</button>` +
      `<button class="ol-btn ${o.userData.locked ? 'on' : ''}" data-act="lock" title="锁定 / 解锁">${o.userData.locked ? '🔒' : '🔓'}</button></div>`);
  }
  $('olList').innerHTML = html.join('') || '<div class="empty">暂无物体</div>';
}
$('olList').addEventListener('click', (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('.ol-row');
  if (!row) return;
  const obj = objects.find(o => o.userData.uid === +row.dataset.uid!);
  if (!obj) return;
  const act = (e.target as HTMLElement).closest<HTMLElement>('.ol-btn')?.dataset.act;
  if (act === 'vis') return setHidden([obj], obj.visible);
  if (act === 'lock') return setLocked([obj], !obj.userData.locked);
  e.shiftKey ? toggleSelect(obj) : select([obj]);
});
$('olList').addEventListener('dblclick', (e) => { if ((e.target as HTMLElement).closest<HTMLElement>('.ol-row') && !(e.target as HTMLElement).closest<HTMLElement>('.ol-btn')) focusSelection(); });
$('olSearch').addEventListener('input', renderOutliner);
document.querySelectorAll<HTMLElement>('.tab').forEach(t => t.addEventListener('click', () => {
  activeTab = t.dataset.tab!;
  document.querySelectorAll<HTMLElement>('.tab').forEach(x => x.classList.toggle('active', x === t));
  $('tab-library').classList.toggle('hidden', activeTab !== 'library');
  $('tab-outliner').classList.toggle('hidden', activeTab !== 'outliner');
  renderOutliner();
}));

// ---------- 属性面板 ----------
const SWATCHES = ['#f0b429', '#e04b3a', '#e8742a', '#2fa36b', '#3a7bd5', '#1f3b5c', '#7b4fd6', '#e9edf0', '#8a909a', '#2b323c'];
const inspBody = $('inspBody');
const deg = (r: number) => Math.round(THREE.MathUtils.radToDeg(r) * 10) / 10;

function vec3Row(label: string, id: string, step: number): string {
  return `<div class="field"><label>${label}</label><div class="vec3">` +
    ['x', 'y', 'z'].map(a => `<div class="axis-in"><span class="ax ${a}">${a.toUpperCase()}</span><input type="number" step="${step}" id="${id}-${a}" /></div>`).join('') +
    `</div></div>`;
}
function section(title: string, body: string, open = true): string {
  return `<details class="sec" ${open ? 'open' : ''}><summary>${title}</summary><div class="sec-body">${body}</div></details>`;
}
function swatchesHtml() {
  return `<div class="swatches">${SWATCHES.map(c => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>`;
}
function bindSwatches(apply: (c: string) => void): void {
  inspBody.querySelectorAll<HTMLElement>('.sw').forEach(b => b.addEventListener('click', () => { apply(b.dataset.c!); pushHistory(); }));
}

function refreshInspector() {
  if (!selection.length) return renderEnvPanel();
  if (selection.length > 1) return renderMultiPanel();
  renderSinglePanel(selection[0]);
}

function renderSinglePanel(o: Obj): void {
  $('inspTitle').textContent = '物体属性';
  const locked = o.userData.locked;
  const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
  const canColor = !!o.userData.isGroup || !!defOf(o)?.colorable;
  inspBody.innerHTML =
    `<div class="obj-head"><span class="obj-ico">${esc(iconOf(o))}</span><div class="obj-meta">` +
    `<input type="text" id="f-name" class="name-in" /><div class="obj-sub">${esc(typeName(o))} · #${esc(o.userData.uid)} · 约 ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} m</div></div></div>` +
    (locked ? `<div class="lock-note">🔒 物体已锁定，无法在视口中选取或变换 <button class="mini-btn" data-act="unlock">解锁</button></div>` : '') +
    section('变换', vec3Row('位置 (m)', 'pos', 0.5) + vec3Row('旋转 (°)', 'rot', 15) + vec3Row('缩放', 'scl', 0.1) +
      `<div class="field"><label>等比缩放 <b id="sclVal"></b></label><input type="range" id="f-uni" min="0.1" max="5" step="0.05" /></div>` +
      `<div class="btn-row"><button class="mini-btn" data-act="ground">⤓ 贴地</button><button class="mini-btn" data-act="resetRot">重置旋转</button><button class="mini-btn" data-act="resetScl">重置缩放</button></div>`) +
    (canColor ? section('外观', `<div class="field"><label>主色</label><div class="color-row"><input type="color" id="f-color" /><span id="colorHex"></span></div></div>${swatchesHtml()}`) : '') +
    section('操作', `<div class="act-grid">
      <button class="act" data-act="focus">◎ 聚焦</button>
      <button class="act" data-act="dup">⧉ 复制</button>
      <button class="act" data-act="hide">${o.visible ? '🙈 隐藏' : '👁 显示'}</button>
      <button class="act" data-act="lock">${locked ? '🔓 解锁' : '🔒 锁定'}</button>
      ${o.userData.isGroup ? '<button class="act" data-act="ungroup">✂ 解组</button>' : ''}
      <button class="act danger" data-act="del">🗑 删除</button></div>`);

  $('f-name').value = o.name;
  $('f-name').addEventListener('input', (e) => { o.name = (e.target as HTMLInputElement).value; scheduleOutliner(); });
  $('f-name').addEventListener('change', pushHistory);
  type Ax = 'x' | 'y' | 'z';
  const apply: Record<'pos' | 'rot' | 'scl', (a: Ax, v: number) => void> = {
    pos: (a, v) => { o.position[a] = v; },
    rot: (a, v) => { o.rotation[a] = THREE.MathUtils.degToRad(v); },
    scl: (a, v) => { o.scale[a] = Math.max(0.01, v); },
  };
  for (const k of ['pos', 'rot', 'scl'] as const) for (const a of ['x', 'y', 'z'] as const) {
    const el = $(`${k}-${a}`);
    el.disabled = locked;
    el.addEventListener('input', () => { const v = parseFloat(el.value); if (Number.isFinite(v)) { apply[k](a, v); updateOutlines(); } });
    el.addEventListener('change', pushHistory);
  }
  const uni = $('f-uni');
  uni.disabled = locked;
  uni.addEventListener('input', () => { const v = +uni.value; o.scale.setScalar(v); syncInspector(); });
  uni.addEventListener('change', pushHistory);
  if (canColor) {
    const col = $('f-color');
    const setC = (c: string) => { setColor(o, c); col.value = c; $('colorHex').textContent = c; };
    col.value = o.userData.baseColor || '#ffffff';
    $('colorHex').textContent = col.value;
    col.addEventListener('input', () => setC(col.value));
    col.addEventListener('change', pushHistory);
    bindSwatches(setC);
  }
  inspBody.querySelectorAll<HTMLElement>('[data-act]').forEach(b => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'ground') dropToGround([o]);
    else if (act === 'resetRot') { o.rotation.set(0, 0, 0); select([o]); pushHistory(); }
    else if (act === 'resetScl') { o.scale.set(1, 1, 1); select([o]); pushHistory(); }
    else if (act === 'focus') focusSelection();
    else if (act === 'dup') duplicateSelected();
    else if (act === 'hide') setHidden([o], o.visible);
    else if (act === 'lock' || act === 'unlock') setLocked([o], act === 'lock' ? !locked : false);
    else if (act === 'ungroup') ungroupSelected();
    else if (act === 'del') deleteSelected();
  }));
  syncInspector();
}

/** 仅更新数值（拖动 gizmo 时调用，不重建 DOM） */
function syncInspector() {
  updateOutlines();
  if (selection.length !== 1) return;
  const o = selection[0];
  const vals: Record<'pos' | 'rot' | 'scl', number[]> = { pos: o.position.toArray(), rot: [o.rotation.x, o.rotation.y, o.rotation.z].map(deg), scl: o.scale.toArray() };
  for (const k of ['pos', 'rot', 'scl'] as const) ['x', 'y', 'z'].forEach((a, i) => {
    const el = $(`${k}-${a}`);
    if (el && document.activeElement !== el) el.value = String(k === 'rot' ? vals[k][i] : Math.round(vals[k][i] * 100) / 100);
  });
  const uni = $('f-uni');
  if (uni && document.activeElement !== uni) uni.value = String(o.scale.x);
  const sv = $('sclVal');
  if (sv) sv.textContent = o.scale.x.toFixed(2) + '×';
}

function renderMultiPanel() {
  $('inspTitle').textContent = '多选';
  const n = selection.length;
  inspBody.innerHTML =
    `<div class="multi-head"><b>${n}</b> 个物体已选中<div class="obj-sub">拖动 gizmo 可整体变换</div></div>` +
    `<div class="chip-list">${selection.slice(0, 12).map(o => `<span class="chip">${esc(iconOf(o))} ${esc(o.name)}</span>`).join('')}${n > 12 ? `<span class="chip">+${n - 12}</span>` : ''}</div>` +
    section('对齐与分布', `<div class="align-grid">
      <span>X 轴</span><button class="mini-btn" data-al="x,min">左</button><button class="mini-btn" data-al="x,center">中</button><button class="mini-btn" data-al="x,max">右</button><button class="mini-btn" data-al="x,dist">均分</button>
      <span>Z 轴</span><button class="mini-btn" data-al="z,min">前</button><button class="mini-btn" data-al="z,center">中</button><button class="mini-btn" data-al="z,max">后</button><button class="mini-btn" data-al="z,dist">均分</button>
      </div><div class="btn-row"><button class="mini-btn" data-act="ground">⤓ 全部贴地</button></div>`) +
    section('外观', `<div class="field"><label>统一颜色</label><input type="color" id="f-mcolor" value="#3a7bd5" /></div>${swatchesHtml()}`) +
    section('操作', `<div class="act-grid">
      <button class="act" data-act="group">⛓ 成组</button><button class="act" data-act="dup">⧉ 复制</button>
      <button class="act" data-act="focus">◎ 聚焦</button><button class="act" data-act="lock">🔒 锁定</button>
      <button class="act" data-act="unlock">🔓 解锁</button><button class="act danger" data-act="del">🗑 删除</button></div>`);
  const applyAll = (c: string) => selection.forEach(o => setColor(o, c));
  $('f-mcolor').addEventListener('input', (e) => applyAll((e.target as HTMLInputElement).value));
  $('f-mcolor').addEventListener('change', pushHistory);
  bindSwatches(applyAll);
  inspBody.querySelectorAll<HTMLElement>('[data-al]').forEach(b => b.addEventListener('click', () => { const [ax, m] = b.dataset.al!.split(',') as ['x' | 'z', 'min' | 'center' | 'max' | 'dist']; alignSelected(ax, m); }));
  inspBody.querySelectorAll<HTMLElement>('[data-act]').forEach(b => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'ground') dropToGround(selection);
    else if (act === 'group') groupSelected();
    else if (act === 'dup') duplicateSelected();
    else if (act === 'focus') focusSelection();
    else if (act === 'lock') setLocked(selection, true);
    else if (act === 'unlock') setLocked(selection, false);
    else if (act === 'del') deleteSelected();
  }));
}

function renderEnvPanel() {
  $('inspTitle').textContent = '场景设置';
  const counts: Record<string, number> = {};
  const walk = (o: Obj): void => { if (o.userData.isGroup) o.children.filter(isEditable).forEach(walk); else counts[typeName(o)] = (counts[typeName(o)] || 0) + 1; };
  objects.forEach(walk);
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  inspBody.innerHTML =
    `<div class="empty-tip">未选中物体 · 点击场景中的物体进行编辑</div>` +
    section('场景', `<div class="field"><label>名称</label><input type="text" id="e-name" /></div>
      <div class="field"><label>场地尺寸 (宽 × 深 m)</label><div class="vec3 two">
        <div class="axis-in"><span class="ax x">W</span><input type="number" id="e-w" min="10" step="10" /></div>
        <div class="axis-in"><span class="ax z">D</span><input type="number" id="e-d" min="10" step="10" /></div></div></div>
      <div class="field two-col"><div><label>地面颜色</label><input type="color" id="e-ground" /></div><div><label>背景颜色</label><input type="color" id="e-bg" /></div></div>`) +
    section('光照', `<div class="field"><label>太阳强度 <b id="v-int"></b></label><input type="range" id="e-int" min="0" max="5" step="0.1" /></div>
      <div class="field"><label>太阳方位 <b id="v-az"></b></label><input type="range" id="e-az" min="0" max="360" step="1" /></div>
      <div class="field"><label>太阳高度 <b id="v-el"></b></label><input type="range" id="e-el" min="5" max="90" step="1" /></div>
      <div class="toggles"><label><input type="checkbox" id="e-shadow" /> 阴影</label><label><input type="checkbox" id="e-grid" /> 网格</label><label><input type="checkbox" id="e-fog" /> 雾效</label></div>`) +
    section('统计', `<div class="stats-list">${top.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('') || '<div>空场景</div>'}</div>`, true);

  // 文本 / 数值 / 颜色 / 范围输入绑定 value；复选框绑定 checked
  const bind = (id: string, read: () => string | number | boolean, live: (v: string & boolean) => void) => {
    const el = $(id);
    const isCheck = el.type === 'checkbox';
    if (isCheck) el.checked = !!read(); else el.value = String(read());
    el.addEventListener('input', () => live((isCheck ? el.checked : el.value) as string & boolean));
    el.addEventListener('change', pushHistory);
  };
  bind('e-name', () => env.name, v => { env.name = v; $('sceneName').textContent = v; });
  bind('e-w', () => env.ground.w, v => { if (+v >= 10) { env.ground.w = +v; applyEnv(false); } });
  bind('e-d', () => env.ground.d, v => { if (+v >= 10) { env.ground.d = +v; applyEnv(false); } });
  bind('e-ground', () => env.groundColor, v => { env.groundColor = v; groundMat.color.set(v); });
  bind('e-bg', () => env.background, v => { env.background = v; applyEnv(false); });
  const lbl = () => { $('v-int').textContent = env.sun.intensity.toFixed(1); $('v-az').textContent = env.sun.azimuth + '°'; $('v-el').textContent = env.sun.elevation + '°'; };
  bind('e-int', () => env.sun.intensity, v => { env.sun.intensity = +v; updateSun(); lbl(); });
  bind('e-az', () => env.sun.azimuth, v => { env.sun.azimuth = +v; updateSun(); lbl(); });
  bind('e-el', () => env.sun.elevation, v => { env.sun.elevation = +v; updateSun(); lbl(); });
  bind('e-shadow', () => env.shadows, v => { env.shadows = v; updateSun(); });
  bind('e-grid', () => env.grid, v => { env.grid = v; if (grid) grid.visible = v; });
  bind('e-fog', () => env.fog, v => { env.fog = v; applyEnv(false); });
  lbl();
}

function refreshAll() {
  refreshInspector();
  scheduleOutliner();
  updateStatus();
  const n = selection.length;
  $('btnGroup').disabled = n < 2;
  $('btnUngroup').disabled = !selection.some(o => o.userData.isGroup);
  $('btnDelete').disabled = !n;
  $('sceneName').textContent = env.name;
}
function updateStatus() {
  let total = 0;
  const walk = (o: Obj): void => { if (o.userData.isGroup) o.children.filter(isEditable).forEach(walk); else total++; };
  objects.forEach(walk);
  $('stObjects').textContent = `物体 ${total}`;
  $('stSelection').textContent = selection.length ? `已选 ${selection.length}：${selection.length === 1 ? selection[0].name : '多个物体'}` : '未选中';
}

// ---------- 工具栏 ----------
document.querySelectorAll<HTMLElement>('.fb-btn[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode as 'translate' | 'rotate' | 'scale')));
function setMode(m: 'translate' | 'rotate' | 'scale'): void {
  transform.setMode(m);
  document.querySelectorAll<HTMLElement>('.fb-btn[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
}
function toggleSpace() {
  transform.setSpace(transform.space === 'local' ? 'world' : 'local');
  $('btnSpace').classList.toggle('active', transform.space === 'local');
  $('btnSpace').querySelector('span')!.textContent = transform.space === 'local' ? '局部' : '世界';
}
function toggleSnap() {
  snapOn = !snapOn;
  $('btnSnap').classList.toggle('active', snapOn);
  transform.setTranslationSnap(snapOn ? 1 : null);
  transform.setRotationSnap(snapOn ? THREE.MathUtils.degToRad(15) : null);
  transform.setScaleSnap(snapOn ? 0.1 : null);
  toast(snapOn ? '网格吸附：开（1 m / 15°）' : '网格吸附：关');
}
let animOn = true;
function toggleAnim() {
  animOn = !animOn;
  const b = $('btnAnim');
  b.classList.toggle('active', animOn);
  b.firstChild!.textContent = animOn ? '⏸' : '▶';
}
$('btnSpace').onclick = toggleSpace;
$('btnSnap').onclick = toggleSnap;
$('btnAnim').onclick = toggleAnim;
$('btnGroup').onclick = groupSelected;
$('btnUngroup').onclick = ungroupSelected;
$('btnDelete').onclick = deleteSelected;
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;

// ---------- 视图 / 相机 ----------
let camTween: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; k: number; dur: number } | null = null;
function tweenCamera(pos: THREE.Vector3, target: THREE.Vector3, dur = 0.6): void {
  camTween = { p0: camera.position.clone(), t0: orbit.target.clone(), p1: pos.clone(), t1: target.clone(), k: 0, dur };
}
type View = 'persp' | 'top' | 'front' | 'side';
let currentView: View = 'persp';
function setView(v: View): void {
  currentView = v;
  document.querySelectorAll<HTMLElement>('.vb-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  const target = orbit.target.clone();
  const dist = Math.max(camera.position.distanceTo(target), 10);
  const dirs: Record<View, Vec3> = { persp: [1, 0.75, 1.1], top: [0, 1, 0.0001], front: [0, 0.2, 1], side: [1, 0.2, 0] };
  orbit.enableRotate = v !== 'top';
  orbit.maxPolarAngle = v === 'top' ? Math.PI : Math.PI / 2 - 0.02;
  tweenCamera(target.clone().addScaledVector(new THREE.Vector3(...dirs[v]).normalize(), dist), target);
  $('stHint').textContent = v === 'top' ? '俯视平面图：旋转已锁定 · 右键平移 · 滚轮缩放' : '左键选择 · Shift 多选 · 右键平移 · 滚轮缩放';
}
document.querySelectorAll<HTMLElement>('.vb-btn[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view as View)));
function focusSelection() {
  const list = selection.length ? selection : objects.filter(o => !o.userData.factoryType || !defOf(o)?.locked);
  if (!list.length) return;
  const box = new THREE.Box3();
  list.forEach(o => box.expandByObject(o));
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dist = Math.max((sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.1, 6);
  const dir = camera.position.clone().sub(orbit.target).normalize();
  tweenCamera(sphere.center.clone().addScaledVector(dir, dist), sphere.center);
}
$('btnFocus').onclick = focusSelection;



// ---------- 素材库（按资产包 → 分类） ----------
const thumbCache = new Map<string, string>();
let libPack = 'all';
function assetThumb(def: AssetDef): string {
  if (def.thumbnail) return safeThumbnail(def.thumbnail);
  return thumbCache.get(def.id) ?? '';
}
function buildLibrary(): void {
  const lib = $('lib');
  const sel = $<HTMLSelectElement>('libPack');
  const packs = registry.packs().filter(p => registry.byPack(p.id).length);
  sel.innerHTML = `<option value="all">全部资产包（${registry.all().length}）</option>` +
    packs.map(p => `<option value="${esc(p.id)}">${esc(p.name)}（${registry.byPack(p.id).length}）</option>`).join('');
  if (libPack !== 'all' && !packs.some(p => p.id === libPack)) libPack = 'all';
  sel.value = libPack;
  const html: string[] = [];
  for (const p of packs) {
    if (libPack !== 'all' && libPack !== p.id) continue;
    html.push(`<div class="pack-title"><span>${esc(p.name)}</span><span class="industry">${esc(p.industry)}</span></div>`);
    for (const cat of p.categories) {
      const list = registry.byPack(p.id).filter(a => a.cat === cat.id);
      if (!list.length) continue;
      html.push(`<details class="lib-sec" open><summary>${esc(cat.name)}<span class="count">${list.length}</span></summary><div class="lib-grid">`);
      for (const a of list) {
        const t = assetThumb(a);
        const search = [a.name, a.id, cat.name, p.name, ...a.tags].join(' ').toLowerCase();
        html.push(`<div class="card" draggable="true" data-id="${esc(a.id)}" data-search="${esc(search)}" title="${esc(a.name)}（点击添加 / 拖拽放置）">` +
          `<div class="thumb ${t ? 'ready' : ''}"><span class="emoji">${esc(a.icon)}</span><img alt="" src="${esc(t)}" /></div>` +
          `<div class="card-name">${esc(a.name)}</div></div>`);
      }
      html.push('</div></details>');
    }
  }
  lib.innerHTML = html.join('') || '<div class="empty">暂无资产</div>';
  filterLibrary();
}
function filterLibrary(): void {
  const q = $in('libSearch').value.trim().toLowerCase();
  $('lib').querySelectorAll<HTMLElement>('.lib-sec').forEach(sec => {
    let any = 0;
    sec.querySelectorAll<HTMLElement>('.card').forEach(c => {
      const ok = !q || c.dataset.search!.includes(q);
      c.style.display = ok ? '' : 'none';
      any += +ok;
    });
    sec.style.display = any ? '' : 'none';
    if (q) (sec as HTMLDetailsElement).open = true;
  });
}
$('lib').addEventListener('click', e => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
  if (card) addAsset(card.dataset.id!, orbit.target.x, orbit.target.z);
});
$('lib').addEventListener('dragstart', e => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
  if (!card || !e.dataTransfer) return;
  e.dataTransfer!.setData('text/plain', 'asset:' + card.dataset.id);
  e.dataTransfer!.effectAllowed = 'copy';
});
$in('libSearch').addEventListener('input', filterLibrary);
$<HTMLSelectElement>('libPack').addEventListener('change', e => { libPack = (e.target as HTMLSelectElement).value; buildLibrary(); });

/** 逐个渲染程序化资产的缩略图（不阻塞界面） */
async function generateThumbnails(): Promise<void> {
  for (const def of registry.all()) {
    if (def.source !== 'procedural' || thumbCache.has(def.id)) continue;
    const obj = def.build(def.color);
    thumbCache.set(def.id, renderThumbnail(obj));
    disposeObject(obj);
    document.querySelectorAll<HTMLElement>(`.card[data-id="${CSS.escape(def.id)}"] .thumb`).forEach(t => {
      t.querySelector('img')!.src = thumbCache.get(def.id)!;
      t.classList.add('ready');
    });
    await new Promise(res => setTimeout(res, 0));
  }
  assetManager?.refresh();
}

// ---------- 提示 ----------
function toast(msg: string, type: 'info' | 'ok' | 'warn' = 'info'): void {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

// ---------- 场景切换 / 保存 / 导入导出 ----------
const STORE_KEY = 'factoryforge-layout-v4';
function reportMissing(missing: number, verb: string): void {
  toast(missing ? `${verb}，${missing} 个物体的资产缺失（以占位框显示）` : `${verb} ✓`, missing ? 'warn' : 'ok');
}
function countMissing(): number {
  let n = 0;
  const walk = (o: Obj) => { if (o.userData.isGroup) o.children.forEach(walk); else if (o.userData.missingType) n++; };
  objects.forEach(walk);
  return n;
}
function loadScene(id: string): void {
  const s = registry.scene(id);
  if (!s) return;
  loadData(s.build());
  setView('persp');
  camTween = null;
  const m = countMissing();
  if (m) toast(`${m} 个物体的资产缺失`, 'warn');
}
const sceneSelect = $<HTMLSelectElement>('sceneSelect');
function buildSceneSelect(): void {
  sceneSelect.innerHTML = registry.packs().filter(p => registry.scenes().some(s => s.packId === p.id))
    .map(p => `<optgroup label="${esc(p.name)}">${registry.scenes().filter(s => s.packId === p.id).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</optgroup>`).join('');
}
sceneSelect.addEventListener('change', () => {
  if (history.index > 0 && !confirm('切换场景会替换当前内容（未保存的修改将丢失），确定吗？')) {
    sceneSelect.value = sceneSelect.dataset.current!;
    return;
  }
  sceneSelect.dataset.current = sceneSelect.value;
  loadScene(sceneSelect.value);
  toast(`已加载：${registry.scene(sceneSelect.value)?.name}`);
});

/** 场景中用到的用户资产 ID */
function usedUserAssets(data: LayoutData): string[] {
  return [...walkComponents(data.objects)].map(c => registry.resolveId(c.type) ?? c.type).filter(id => id.startsWith('user/'));
}
function saveLocal(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(serialize()));
    toast('已保存到浏览器 ✓（自定义模型保存在本机资产库）', 'ok');
  } catch (e) {
    toast('保存失败：' + (e as Error).message, 'warn');
  }
}
$('btnSave').onclick = saveLocal;
$('btnLoad').onclick = () => {
  const raw = localStorage.getItem(STORE_KEY) ?? localStorage.getItem('factoryforge-layout-v3');
  if (!raw) return toast('浏览器中没有已保存的布局', 'warn');
  loadData(JSON.parse(raw));
  reportMissing(countMissing(), '已读取布局');
};
function download(name: string, url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}
function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  download(name, url);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/** 导出项目包：布局 + 用到的自定义模型 */
async function exportProject(): Promise<void> {
  const layout = serialize();
  const bundle: ProjectBundle = { app: 'FactoryForge', format: 'project', version: 4, layout, assets: await userLib.packAssets(usedUserAssets(layout)) };
  downloadBlob(`${env.name || 'factory'}.ffproj.json`, new Blob([JSON.stringify(bundle)], { type: 'application/json' }));
  toast(bundle.assets.length ? `已导出项目包（含 ${bundle.assets.length} 个自定义模型）` : '已导出项目包', 'ok');
}
async function importProjectText(txt: string): Promise<void> {
  let data: unknown;
  try { data = JSON.parse(txt); } catch { throw new Error('文件不是有效的 JSON'); }
  let layout: LayoutData;
  let added = 0;
  if ((data as { format?: unknown } | null)?.format === 'project') {
    const bundle = validateProjectBundle(data); // 先校验布局，失败时什么都不写
    layout = bundle.layout;
    added = await userLib.unpackAssets(bundle.assets); // 任一资产无效 → 整体拒绝，未写库
  } else {
    layout = validateLayout(data);
  }
  loadData(layout);
  reportMissing(countMissing(), added ? `已导入（新增 ${added} 个自定义模型）` : '已导入');
}
$('btnExport').onclick = () => { exportProject().catch(e => toast('导出失败：' + e.message, 'warn')); };
$('btnImport').onclick = () => $in('fileInput').click();
$in('fileInput').onchange = e => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) file.text().then(importProjectText).catch(err => toast('导入失败：' + err.message, 'warn'));
};
$('btnShot').onclick = () => {
  const hidden = [transform, grid, ...selection.map(o => o.userData.outline)].filter(Boolean) as Obj[];
  const prev = hidden.map(h => h.visible);
  hidden.forEach(h => (h.visible = false));
  renderer.render(scene, camera);
  download(`${env.name || 'factory'}.png`, canvas.toDataURL('image/png'));
  hidden.forEach((h, i) => (h.visible = prev[i]));
  invalidate();
  toast('截图已导出 ✓', 'ok');
};

// ---------- 用户资产库 + 资产管理器 ----------
let store: AssetStore;
try { store = new IdbAssetStore(); } catch { store = new MemoryAssetStore(); }
const userLib = new UserAssetLibrary(store, registry);
let assetManager: AssetManagerUI | null = null;
userLib.onAssetChanged(id => {
  const n = rebuildInstances(id);
  if (n) toast(`已更新场景中的 ${n} 个实例`, 'ok');
});
registry.onChange(() => {
  buildLibrary();
  assetManager?.refresh();
  refreshAll();
});
$('btnAssets').onclick = () => assetManager?.open();
$('btnImportGlb').onclick = () => assetManager?.open({ importNow: true });

// ---------- 面板 / 帮助 ----------
$('btnToggleLeft').onclick = () => { document.body.classList.toggle('hide-left'); };
$('btnToggleRight').onclick = () => { document.body.classList.toggle('hide-right'); };
const toggleHelp = (show: boolean) => $('helpModal').classList.toggle('hidden', !show);
$('btnHelp').onclick = () => toggleHelp(true);
$('btnHelpClose').onclick = () => toggleHelp(false);
$('helpModal').addEventListener('click', e => { if ((e.target as HTMLElement).id === 'helpModal') toggleHelp(false); });

// ---------- 键盘 ----------
window.addEventListener('keydown', e => {
  const tgt = e.target as HTMLElement;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(tgt.tagName) || tgt.closest('.modal:not(.hidden)')) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); return undo(); }
  if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); return redo(); }
  if (mod && k === 's') { e.preventDefault(); return saveLocal(); }
  if (mod && k === 'd') { e.preventDefault(); return duplicateSelected(); }
  if (mod && k === 'a') { e.preventDefault(); return select(objects.filter(o => o.visible && !o.userData.locked)); }
  if (mod) return;
  if (k.startsWith('arrow') && selection.length) {
    e.preventDefault();
    const step = (e.shiftKey ? 5 : 1) * (snapOn ? 1 : 0.5);
    const d = ({ arrowleft: ['x', -1], arrowright: ['x', 1], arrowup: ['z', -1], arrowdown: ['z', 1] } as Record<string, ['x' | 'z', number]>)[k];
    const tgtObj = multiProxy || (selection[0].userData.locked ? null : selection[0]);
    if (tgtObj && d) { tgtObj.position[d[0]] += d[1] * step; syncInspector(); pushHistorySoon(); }
    return;
  }
  switch (k) {
    case 'w': setMode('translate'); break;
    case 'e': setMode('rotate'); break;
    case 'r': setMode('scale'); break;
    case 'q': toggleSpace(); break;
    case 's': toggleSnap(); break;
    case 'f': focusSelection(); break;
    case 'g': if (e.shiftKey) ungroupSelected(); else groupSelected(); break;
    case 'h': if (selection.length) setHidden(selection, selection[0].visible); break;
    case 'l': if (selection.length) setLocked(selection, !selection[0].userData.locked); break;
    case 'v': setView(currentView === 'top' ? 'persp' : 'top'); break;
    case '1': setView('persp'); break;
    case '2': setView('top'); break;
    case '3': setView('front'); break;
    case '4': setView('side'); break;
    case 'm': assetManager?.open(); break;
    case ' ': e.preventDefault(); toggleAnim(); break;
    case 'delete': case 'backspace': deleteSelected(); break;
    case 'escape': toggleHelp(false); select([]); break;
    case '?': toggleHelp(true); break;
  }
});

// ---------- 渲染循环（按需渲染：仅在相机/场景变化或动画播放时绘制） ----------
function resize(): void {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  invalidate();
}
new ResizeObserver(resize).observe(viewport);

const clock = new THREE.Clock();
let animTime = 0, fpsFrames = 0, fpsTime = 0, frames = 0;
function animateNode(o: Obj, t: number, dt: number): boolean {
  if (!o.visible) return false;
  if (o.userData.isGroup) {
    let any = false;
    for (const c of o.children) any = animateNode(c, t, dt) || any;
    return any;
  }
  const def = defOf(o);
  if (def?.animate && o.userData.parts) {
    def.animate(o.userData.parts, t, dt);
    return true;
  }
  return false;
}
function loop(): void {
  requestAnimationFrame(loop);
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  if (animOn) {
    animTime += dt;
    let any = false;
    for (const o of objects) any = animateNode(o, animTime, dt) || any;
    if (any) {
      needsRender = true;
      if (selection.length) updateOutlines();
    }
  }
  if (camTween) {
    camTween.k = Math.min(1, camTween.k + dt / camTween.dur);
    const e = 1 - Math.pow(1 - camTween.k, 3);
    camera.position.lerpVectors(camTween.p0, camTween.p1, e);
    orbit.target.lerpVectors(camTween.t0, camTween.t1, e);
    if (camTween.k >= 1) camTween = null;
    needsRender = true;
  }
  orbit.update(); // 阻尼期间会触发 change → invalidate
  fpsTime += raw;
  if (needsRender) {
    needsRender = false;
    renderer.render(scene, camera);
    fpsFrames++;
    frames++;
    $('stDraws').textContent = `绘制 ${renderer.info.render.calls} · ${(renderer.info.render.triangles / 1000).toFixed(0)}k 面`;
  }
  if (fpsTime >= 1) {
    $('stFps').textContent = fpsFrames ? `${Math.round(fpsFrames / fpsTime)} FPS` : '空闲';
    fpsFrames = 0;
    fpsTime = 0;
  }
}

// ---------- 启动 ----------
export async function start(): Promise<void> {
  window.addEventListener('error', e => toast('出错：' + e.message, 'warn'));
  const errs = await userLib.init().catch(e => [String(e)]);
  if (errs.length) toast(`${errs.length} 个自定义模型载入失败`, 'warn');
  assetManager = new AssetManagerUI({
    registry, lib: userLib, usageOf, toast, downloadBlob,
    place: id => { addAsset(id, orbit.target.x, orbit.target.z); },
    procThumb: id => thumbCache.get(id) ?? '',
  });
  buildLibrary();
  buildSceneSelect();
  resize();
  const q = new URLSearchParams(location.search).get('scene');
  const first = (q && registry.scene(q)) || registry.scenes()[0];
  if (first) {
    sceneSelect.value = sceneSelect.dataset.current = first.id;
    loadScene(first.id);
  }
  if (new URLSearchParams(location.search).has('noanim')) toggleAnim();
  loop();
  $('loading').classList.add('hidden');
  (window as unknown as { __ffReady: boolean }).__ffReady = true;
  setTimeout(() => { generateThumbnails(); }, 300);
}

// 调试 / 自动化测试入口
Object.assign(window, {
  __ff: {
    THREE, scene, camera, registry, userLib, objects, renderer, planStats,
    get selection() { return selection; },
    get frames() { return frames; },
    select, serialize, loadData, undo, redo, addAsset, groupSelected, ungroupSelected,
    duplicateSelected, deleteSelected, alignSelected, history, usageOf, rebuildInstances, exportProject, importProjectText,
  },
});

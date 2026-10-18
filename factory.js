import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* =========================================================
   3D 工厂编辑器
   - 组件库：各类工厂元素
   - 选中 / 移动 / 旋转 / 缩放
   - 属性面板：颜色、位置、旋转、缩放
   - 保存 / 加载（localStorage）与导入 / 导出 JSON
   ========================================================= */

// ---------- 组件定义 ----------
// 每个组件是一个构建函数，返回一个 THREE.Group / Mesh，带 userData.factoryType
const COMPONENTS = {
  machine:  { icon: '🏭', name: '机器',   color: '#5b8def', build: buildMachine },
  conveyor: { icon: '🛤️', name: '传送带', color: '#9aa4b2', build: buildConveyor },
  tank:     { icon: '🛢️', name: '储罐',   color: '#4fb286', build: buildTank },
  robot:    { icon: '🦾', name: '机械臂', color: '#ffb454', build: buildRobotArm },
  shelf:    { icon: '🗄️', name: '货架',   color: '#c9833a', build: buildShelf },
  crate:    { icon: '📦', name: '货箱',   color: '#b5651d', build: buildCrate },
  wall:     { icon: '🧱', name: '墙体',   color: '#8a909a', build: buildWall },
  pillar:   { icon: '🏛️', name: '立柱',   color: '#a7afba', build: buildPillar },
  pipe:     { icon: '🔧', name: '管道',   color: '#6b7684', build: buildPipe },
  cabin:    { icon: '🏢', name: '控制室', color: '#3a7bd5', build: buildControlRoom },
};

function mat(color) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6, metalness: 0.25 });
}
// 把一个 mesh 标记为"主材质"载体，用于属性面板改颜色
function markMain(obj, meshes) {
  obj.userData.mainMeshes = meshes;
  return obj;
}

function buildMachine(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 1.4), mat(color));
  body.position.y = 0.8;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1), mat('#2c3440'));
  top.position.y = 1.85;
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 0.6, 16), mat('#2c3440'));
  funnel.position.set(0.6, 2.3, 0);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.8), mat('#1a1f28'));
  panel.position.set(1.02, 0.9, 0);
  [body, top, funnel, panel].forEach(m => (m.castShadow = m.receiveShadow = true));
  g.add(body, top, funnel, panel);
  return markMain(g, [body]);
}

function buildConveyor(color) {
  const g = new THREE.Group();
  const belt = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 1), mat('#2a2f38'));
  belt.position.y = 0.75;
  const top = new THREE.Mesh(new THREE.BoxGeometry(4, 0.06, 0.9), mat(color));
  top.position.y = 0.84;
  const meshes = [top];
  g.add(belt, top);
  for (const x of [-1.7, -0.5, 0.5, 1.7]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 12), mat('#4a515c'));
    leg.position.set(x, 0.35, 0);
    g.add(leg);
  }
  // 传送带上滚动的小货物（动画目标）
  const rollers = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const pkg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.5), mat('#d8863a'));
    pkg.position.set(-1.6 + i * 1.4, 1.02, 0);
    pkg.castShadow = true;
    rollers.add(pkg);
  }
  g.add(rollers);
  g.userData.anim = { type: 'conveyor', rollers };
  [belt, top].forEach(m => (m.castShadow = m.receiveShadow = true));
  return markMain(g, meshes);
}

function buildTank(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 32), mat(color));
  body.position.y = 1.3;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
  top.position.y = 2.4;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 32), mat('#3a414d'));
  base.position.y = 0.1;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.06, 12, 32), mat('#2c3440'));
  band.rotation.x = Math.PI / 2; band.position.y = 1.6;
  [body, top, base, band].forEach(m => (m.castShadow = m.receiveShadow = true));
  g.add(body, top, base, band);
  return markMain(g, [body, top]);
}

function buildRobotArm(color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 24), mat('#2c3440'));
  base.position.y = 0.15;
  // 可旋转的关节柱（绕 Y 轴摆动）
  const turret = new THREE.Group();
  turret.position.y = 0.3;
  const j1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 20), mat(color));
  j1.position.y = 0.2;
  // 上臂（绕 Z 轴摆动）
  const upper = new THREE.Group();
  upper.position.y = 0.4;
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), mat(color));
  arm1.position.set(0, 0.7, 0);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), mat(color));
  arm2.position.set(0.3, 1.5, 0); arm2.rotation.z = 0.5;
  const claw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), mat('#2c3440'));
  claw.position.set(0.75, 1.95, 0);
  upper.add(arm1, arm2, claw);
  turret.add(j1, upper);
  [base, j1, arm1, arm2, claw].forEach(m => (m.castShadow = m.receiveShadow = true));
  g.add(base, turret);
  g.userData.anim = { type: 'robot', turret, upper };
  return markMain(g, [j1, arm1, arm2]);
}

function buildShelf(color) {
  const g = new THREE.Group();
  const meshes = [];
  for (const y of [0.4, 1.2, 2.0]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.9), mat(color));
    plank.position.y = y; plank.castShadow = plank.receiveShadow = true;
    g.add(plank); meshes.push(plank);
  }
  for (const x of [-0.95, 0.95]) for (const z of [-0.4, 0.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), mat('#5a4027'));
    post.position.set(x, 1.2, z); post.castShadow = true;
    g.add(post);
  }
  return markMain(g, meshes);
}

function buildCrate(color) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(color));
  box.position.y = 0.5; box.castShadow = box.receiveShadow = true;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.25, transparent: true }));
  edges.position.copy(box.position);
  g.add(box, edges);
  return markMain(g, [box]);
}

function buildWall(color) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 0.2), mat(color));
  wall.position.y = 1.25; wall.castShadow = wall.receiveShadow = true;
  g.add(wall);
  return markMain(g, [wall]);
}

function buildPillar(color) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.5, 20), mat(color));
  p.position.y = 1.75; p.castShadow = p.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), mat('#8a909a'));
  cap.position.y = 3.5;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), mat('#8a909a'));
  foot.position.y = 0.15;
  g.add(p, cap, foot);
  return markMain(g, [p]);
}

function buildPipe(color) {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 20), mat(color));
  h.rotation.z = Math.PI / 2; h.position.y = 2;
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), mat(color));
  elbow.position.set(-1.5, 2, 0);
  const v = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2, 20), mat(color));
  v.position.set(-1.5, 1, 0);
  [h, elbow, v].forEach(m => (m.castShadow = m.receiveShadow = true));
  g.add(h, elbow, v);
  return markMain(g, [h, elbow, v]);
}

function buildControlRoom(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 2.5), mat(color));
  body.position.y = 1.25;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.2, 2.8), mat('#2c3440'));
  roof.position.y = 2.6;
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.05), new THREE.MeshStandardMaterial({ color: 0x7fd4ff, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.8 }));
  win.position.set(0, 1.6, 1.26);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.05), mat('#2c3440'));
  door.position.set(-1, 0.8, 1.26);
  [body, roof].forEach(m => (m.castShadow = m.receiveShadow = true));
  g.add(body, roof, win, door);
  return markMain(g, [body]);
}

// ---------- 场景初始化 ----------
const canvas = document.getElementById('canvas');
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1116);
scene.fog = new THREE.Fog(0x0e1116, 30, 80);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
camera.position.set(14, 12, 16);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxPolarAngle = Math.PI / 2 - 0.02;
orbit.target.set(0, 1, 0);

// 灯光
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x20262f, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(12, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.camera.far = 80;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// 地面
const floorMat = new THREE.MeshStandardMaterial({ color: 0x242a33, roughness: 0.9 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
floor.userData.isFloor = true;
scene.add(floor);

const grid = new THREE.GridHelper(60, 60, 0x3a4350, 0x2a323d);
grid.position.y = 0.01;
scene.add(grid);

// 变换控制器
const transform = new TransformControls(camera, renderer.domElement);
transform.addEventListener('dragging-changed', (e) => { orbit.enabled = !e.value; });
transform.addEventListener('objectChange', () => { refreshInspector(); });
scene.add(transform);

// ---------- 状态 ----------
const objects = [];          // 场景中顶层可编辑物体（组件或分组）
let selection = [];          // 当前选中的一个或多个顶层物体
let primary = null;          // 主选中（属性面板显示它）
let snap = false;            // 网格吸附
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// 高亮边框材质
const outlineMat = new THREE.LineBasicMaterial({ color: 0x4f9dff, linewidth: 2 });

function addOutline(obj) {
  removeOutline(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const helper = new THREE.Box3Helper(box, 0x4f9dff);
  helper.userData.isOutline = true;
  // 把 helper 作为世界空间对象直接加到 scene，跟随物体包围盒
  obj.userData.outline = helper;
  scene.add(helper);
}
function removeOutline(obj) {
  if (obj.userData.outline) {
    scene.remove(obj.userData.outline);
    obj.userData.outline.geometry.dispose();
    obj.userData.outline = null;
  }
}
function updateOutlines() {
  for (const o of selection) {
    if (!o.userData.outline) continue;
    o.userData.outline.box.setFromObject(o);
  }
}

// ---------- 添加 / 选择 / 删除 ----------
let idCounter = 1;
function addComponent(type, position) {
  const def = COMPONENTS[type];
  if (!def) return null;
  const obj = def.build(def.color);
  obj.userData.factoryType = type;
  obj.userData.baseColor = def.color;
  obj.userData.id = idCounter++;
  obj.name = def.name + ' ' + obj.userData.id;
  if (position) obj.position.copy(position);
  scene.add(obj);
  objects.push(obj);
  select([obj]);
  updateStats();
  return obj;
}

function setColor(obj, color) {
  obj.userData.baseColor = color;
  // 对组件：改 mainMeshes；对分组：递归到子组件
  if (obj.userData.isGroup) {
    obj.children.forEach(c => c.userData.mainMeshes && setColor(c, color));
  } else {
    (obj.userData.mainMeshes || []).forEach(m => m.material && m.material.color && m.material.color.set(color));
  }
}

// 选择一组物体；primary 默认取最后一个
function select(arr) {
  // 清理旧的多选代理（把物体还给 scene）与旧高亮
  detachMultiProxy();
  selection.forEach(removeOutline);
  selection = arr.filter(Boolean);
  primary = selection.length ? selection[selection.length - 1] : null;

  if (selection.length === 1) {
    transform.attach(selection[0]);
  } else if (selection.length > 1) {
    // 多选：用一个临时锚点组做统一变换
    attachMultiProxy();
  } else {
    transform.detach();
  }
  selection.forEach(addOutline);
  refreshInspector();
  updateGroupButtons();
}

function toggleInSelection(obj) {
  const i = selection.indexOf(obj);
  if (i >= 0) {
    const next = selection.slice(); next.splice(i, 1);
    select(next);
  } else {
    select([...selection, obj]);
  }
}

// —— 多选代理：把选中物体临时挂到一个 pivot，拖动 pivot 带动它们 ——
let multiProxy = null;
function attachMultiProxy() {
  detachMultiProxy();
  multiProxy = new THREE.Group();
  const center = new THREE.Vector3();
  const box = new THREE.Box3();
  selection.forEach(o => box.expandByObject(o));
  box.getCenter(center);
  multiProxy.position.copy(center);
  scene.add(multiProxy);
  // 记录相对偏移，用 attach 保留世界变换
  selection.forEach(o => multiProxy.attach(o));
  transform.attach(multiProxy);
}
function detachMultiProxy() {
  if (!multiProxy) return;
  // 把物体还给 scene，保留世界变换
  selection.forEach(o => { if (o.parent === multiProxy) scene.attach(o); });
  scene.remove(multiProxy);
  multiProxy = null;
}

function deleteSelected() {
  if (!selection.length) return;
  detachMultiProxy();
  transform.detach();
  selection.forEach(o => {
    removeOutline(o);
    scene.remove(o);
    o.traverse(n => { if (n.geometry) n.geometry.dispose(); });
    const i = objects.indexOf(o);
    if (i >= 0) objects.splice(i, 1);
  });
  selection = []; primary = null;
  refreshInspector();
  updateStats();
  updateGroupButtons();
}

function duplicateSelected() {
  if (!selection.length) return;
  const clones = [];
  selection.forEach(src => {
    const data = serializeObject(src);
    data.position[0] += 2; data.position[2] += 2;
    const clone = deserializeObject(data);
    if (clone) clones.push(clone);
  });
  select(clones);
}

// ---------- 成组 / 解组 ----------
function groupSelected() {
  if (selection.length < 2) return flash('至少选中 2 个物体');
  detachMultiProxy();
  transform.detach();
  const grp = new THREE.Group();
  grp.userData.isGroup = true;
  grp.userData.id = idCounter++;
  grp.name = '分组 ' + grp.userData.id;
  // 几何中心作为分组原点
  const box = new THREE.Box3();
  selection.forEach(o => box.expandByObject(o));
  const center = new THREE.Vector3(); box.getCenter(center);
  grp.position.copy(center);
  scene.add(grp);
  selection.forEach(o => {
    removeOutline(o);
    const i = objects.indexOf(o); if (i >= 0) objects.splice(i, 1);
    grp.attach(o); // 保留世界变换
  });
  objects.push(grp);
  select([grp]);
  updateStats();
}

function ungroupSelected() {
  const groups = selection.filter(o => o.userData.isGroup);
  if (!groups.length) return flash('请选中一个分组');
  detachMultiProxy();
  transform.detach();
  const freed = [];
  groups.forEach(grp => {
    removeOutline(grp);
    [...grp.children].forEach(child => {
      scene.attach(child);        // 保留世界变换
      objects.push(child);
      freed.push(child);
    });
    const i = objects.indexOf(grp); if (i >= 0) objects.splice(i, 1);
    scene.remove(grp);
  });
  select(freed);
  updateStats();
}

// ---------- 鼠标拾取 ----------
function onPointerDown(e) {
  if (transform.dragging) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(objects, true);
  if (hits.length > 0) {
    let root = hits[0].object;
    while (root.parent && !objects.includes(root)) root = root.parent;
    if (e.shiftKey) toggleInSelection(root);
    else select([root]);
  } else {
    if (!e.shiftKey) select([]);
  }
}
canvas.addEventListener('pointerdown', onPointerDown);

// ---------- 组件库 UI ----------
const lib = document.getElementById('lib');
function buildLibrary() {
  const groups = [
    { title: '设备', keys: ['machine', 'conveyor', 'robot', 'tank'] },
    { title: '存储', keys: ['shelf', 'crate'] },
    { title: '结构', keys: ['wall', 'pillar', 'pipe', 'cabin'] },
  ];
  for (const grp of groups) {
    const t = document.createElement('div');
    t.className = 'lib-title'; t.textContent = grp.title;
    lib.appendChild(t);
    const grid = document.createElement('div');
    grid.className = 'lib-grid';
    for (const key of grp.keys) {
      const def = COMPONENTS[key];
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `<span class="ico">${def.icon}</span>${def.name}`;
      el.onclick = () => addComponent(key, new THREE.Vector3(0, 0, 0));
      grid.appendChild(el);
    }
    lib.appendChild(grid);
  }
}
buildLibrary();

// ---------- 属性面板 ----------
const inspBody = document.getElementById('inspBody');
function refreshInspector() {
  if (!selection.length) {
    inspBody.innerHTML = '<div class="empty-state">未选中物体<br/><br/>点击场景中的物体<br/>进行编辑<br/><br/>Shift+点击 可多选</div>';
    return;
  }
  if (selection.length > 1) {
    inspBody.innerHTML = `
      <div class="empty-state" style="margin-top:10px;">已选中 <b style="color:var(--accent)">${selection.length}</b> 个物体<br/><br/>可整体移动/旋转/缩放</div>
      <div class="field" style="margin-top:20px;"><label>统一颜色</label><input type="color" id="f-multicolor" value="#5b8def"/></div>
      <button class="btn dup" id="btnGroupI">⛓ 成组</button>
      <button class="btn dup" id="btnDupI">⧉ 复制全部</button>
      <button class="btn del" id="btnDel">🗑 删除全部</button>
    `;
    const mc = document.getElementById('f-multicolor');
    if (mc) mc.oninput = e => selection.forEach(o => setColor(o, e.target.value));
    document.getElementById('btnGroupI').onclick = groupSelected;
    document.getElementById('btnDupI').onclick = duplicateSelected;
    document.getElementById('btnDel').onclick = deleteSelected;
    return;
  }
  const o = primary;
  const p = o.position, r = o.rotation, s = o.scale;
  const deg = (rad) => (rad * 180 / Math.PI).toFixed(0);
  inspBody.innerHTML = `
    <div class="field"><label>名称</label><input type="text" id="f-name" value="${o.name}"/></div>
    <div class="field"><label>颜色</label><input type="color" id="f-color" value="${o.userData.baseColor}"/></div>
    <div class="field"><label>位置 (X / Y / Z)</label>
      <div class="row">
        <div><input type="number" step="0.5" id="px" value="${p.x.toFixed(2)}"/><div class="axis">X</div></div>
        <div><input type="number" step="0.5" id="py" value="${p.y.toFixed(2)}"/><div class="axis">Y</div></div>
        <div><input type="number" step="0.5" id="pz" value="${p.z.toFixed(2)}"/><div class="axis">Z</div></div>
      </div>
    </div>
    <div class="field"><label>旋转 (角度)</label>
      <div class="row">
        <div><input type="number" step="15" id="rx" value="${deg(r.x)}"/><div class="axis">X</div></div>
        <div><input type="number" step="15" id="ry" value="${deg(r.y)}"/><div class="axis">Y</div></div>
        <div><input type="number" step="15" id="rz" value="${deg(r.z)}"/><div class="axis">Z</div></div>
      </div>
    </div>
    <div class="field"><label>缩放：<span id="scaleVal">${s.x.toFixed(2)}×</span></label>
      <input type="range" id="scaleU" min="0.2" max="4" step="0.1" value="${s.x}"/>
    </div>
    <div class="field"><label>精确缩放 (X / Y / Z)</label>
      <div class="row">
        <div><input type="number" step="0.1" id="sx" value="${s.x.toFixed(2)}"/><div class="axis">X</div></div>
        <div><input type="number" step="0.1" id="sy" value="${s.y.toFixed(2)}"/><div class="axis">Y</div></div>
        <div><input type="number" step="0.1" id="sz" value="${s.z.toFixed(2)}"/><div class="axis">Z</div></div>
      </div>
    </div>
    ${o.userData.isGroup ? '<button class="btn dup" id="btnUngroupI">⛓̸ 解组</button>' : ''}
    <button class="btn dup" id="btnDup">⧉ 复制物体</button>
    <button class="btn del" id="btnDel">🗑 删除物体</button>
  `;

  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.oninput = fn; };
  bind('f-name', e => { o.name = e.target.value; });
  bind('f-color', e => setColor(o, e.target.value));
  bind('px', e => (o.position.x = +e.target.value || 0));
  bind('py', e => (o.position.y = +e.target.value || 0));
  bind('pz', e => (o.position.z = +e.target.value || 0));
  bind('rx', e => (o.rotation.x = (+e.target.value || 0) * Math.PI / 180));
  bind('ry', e => (o.rotation.y = (+e.target.value || 0) * Math.PI / 180));
  bind('rz', e => (o.rotation.z = (+e.target.value || 0) * Math.PI / 180));
  bind('scaleU', e => { const v = +e.target.value; o.scale.set(v, v, v); document.getElementById('scaleVal').textContent = v.toFixed(2) + '×'; syncScaleInputs(); });
  bind('sx', e => (o.scale.x = +e.target.value || 0.01));
  bind('sy', e => (o.scale.y = +e.target.value || 0.01));
  bind('sz', e => (o.scale.z = +e.target.value || 0.01));
  document.getElementById('btnDel').onclick = deleteSelected;
  document.getElementById('btnDup').onclick = duplicateSelected;
  const ug = document.getElementById('btnUngroupI');
  if (ug) ug.onclick = ungroupSelected;
}
function syncScaleInputs() {
  if (!primary) return;
  ['sx','sy','sz'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.value = primary.scale.getComponent(i).toFixed(2); });
}

// ---------- 工具栏 ----------
document.querySelectorAll('.tbtn[data-mode]').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tbtn[data-mode]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    transform.setMode(btn.dataset.mode);
  };
});
const btnGrid = document.getElementById('btnGrid');
btnGrid.onclick = () => {
  snap = !snap;
  btnGrid.classList.toggle('active', snap);
  transform.setTranslationSnap(snap ? 1 : null);
  transform.setRotationSnap(snap ? THREE.MathUtils.degToRad(15) : null);
  transform.setScaleSnap(snap ? 0.25 : null);
};
function clearScene() {
  detachMultiProxy();
  transform.detach();
  selection.forEach(removeOutline);
  selection = []; primary = null;
  objects.slice().forEach(o => { scene.remove(o); o.traverse(n => n.geometry && n.geometry.dispose()); });
  objects.length = 0;
  refreshInspector(); updateStats(); updateGroupButtons();
}
document.getElementById('btnClear').onclick = () => {
  if (!objects.length) return;
  if (!confirm('确定清空整个场景？')) return;
  clearScene();
};

// 成组/解组按钮
document.getElementById('btnGroup').onclick = groupSelected;
document.getElementById('btnUngroup').onclick = ungroupSelected;
function updateGroupButtons() {
  document.getElementById('btnGroup').classList.toggle('active', selection.length >= 2);
  document.getElementById('btnUngroup').classList.toggle('active', selection.some(o => o.userData.isGroup));
}

// 键盘快捷键
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'w') transform.setMode('translate');
  if (e.key === 'e') transform.setMode('rotate');
  if (e.key === 'r') transform.setMode('scale');
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  if (e.key === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); duplicateSelected(); }
  if (e.key === 'g' && !e.shiftKey) { e.preventDefault(); groupSelected(); }
  if (e.key === 'G' || (e.key === 'g' && e.shiftKey)) { e.preventDefault(); ungroupSelected(); }
  if (e.key === ' ') { e.preventDefault(); toggleAnim(); }
  if (e.key === 'v' || e.key === 'V') toggleView();
  if (['w','e','r'].includes(e.key)) {
    document.querySelectorAll('.tbtn[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === transform.getMode()));
  }
});

// ---------- 保存 / 加载 / 导入 / 导出 ----------
// 把单个顶层物体（组件 / 分组）序列化为纯数据
function serializeObject(o) {
  const base = {
    name: o.name,
    position: o.position.toArray(),
    rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
    scale: o.scale.toArray(),
  };
  if (o.userData.isGroup) {
    return { kind: 'group', ...base, children: o.children.filter(c => c.userData.factoryType || c.userData.isGroup).map(serializeObject) };
  }
  return { kind: 'component', type: o.userData.factoryType, color: o.userData.baseColor, ...base };
}

// 从数据重建一个顶层物体并挂到 scene / objects
function deserializeObject(data, parent) {
  let obj;
  if (data.kind === 'group') {
    obj = new THREE.Group();
    obj.userData.isGroup = true;
    obj.userData.id = idCounter++;
    obj.name = data.name || ('分组 ' + obj.userData.id);
    (data.children || []).forEach(childData => {
      const child = buildFromData(childData);
      if (child) obj.add(child);
    });
  } else {
    obj = buildFromData(data);
    if (!obj) return null;
  }
  obj.position.fromArray(data.position);
  obj.rotation.set(...data.rotation);
  obj.scale.fromArray(data.scale);
  (parent || scene).add(obj);
  if (!parent) objects.push(obj);
  updateStats();
  return obj;
}

// 仅构建一个组件 mesh（不入 objects，供分组内部使用）
function buildFromData(data) {
  if (data.kind === 'group') {
    const g = new THREE.Group();
    g.userData.isGroup = true; g.userData.id = idCounter++;
    g.name = data.name || ('分组 ' + g.userData.id);
    (data.children || []).forEach(c => { const child = buildFromData(c); if (child) g.add(child); });
    g.position.fromArray(data.position); g.rotation.set(...data.rotation); g.scale.fromArray(data.scale);
    return g;
  }
  const def = COMPONENTS[data.type];
  if (!def) return null;
  const obj = def.build(def.color);
  obj.userData.factoryType = data.type;
  obj.userData.baseColor = data.color;
  obj.userData.id = idCounter++;
  obj.name = data.name || (def.name + ' ' + obj.userData.id);
  obj.position.fromArray(data.position);
  obj.rotation.set(...data.rotation);
  obj.scale.fromArray(data.scale);
  setColor(obj, data.color);
  return obj;
}

function serialize() {
  return { version: 2, objects: objects.map(serializeObject) };
}
function loadData(data) {
  if (!data || !Array.isArray(data.objects)) return;
  clearScene();
  for (const item of data.objects) {
    // 兼容 v1 格式（只有 type 字段）
    if (!item.kind) item.kind = 'component';
    deserializeObject(item);
  }
  select([]);
  updateStats();
}

document.getElementById('btnSave').onclick = () => {
  localStorage.setItem('factory-layout', JSON.stringify(serialize()));
  flash('已保存布局 ✓');
};
document.getElementById('btnLoad').onclick = () => {
  const raw = localStorage.getItem('factory-layout');
  if (!raw) return flash('没有已保存的布局');
  loadData(JSON.parse(raw));
  flash('已加载布局 ✓');
};
document.getElementById('btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'factory-layout.json';
  a.click();
  URL.revokeObjectURL(a.href);
};
const fileInput = document.getElementById('fileInput');
document.getElementById('btnImport').onclick = () => fileInput.click();
fileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { loadData(JSON.parse(reader.result)); flash('已导入 ✓'); } catch { flash('文件格式错误'); } };
  reader.readAsText(file);
  fileInput.value = '';
};

// ---------- 提示 ----------
const hint = document.getElementById('hint');
let flashTimer;
function flash(msg) {
  hint.textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    hint.textContent = '拖拽旋转视角 · 滚轮缩放 · 点击选中 · Shift+点击多选 · 从左侧添加组件';
  }, 2200);
}

// ---------- GLB / glTF 自定义模型导入 ----------
const gltfLoader = new GLTFLoader();
const glbInput = document.getElementById('glbInput');
document.getElementById('btnImportGlb').onclick = () => glbInput.click();
glbInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  flash('正在加载模型…');
  gltfLoader.load(url, (gltf) => {
    const model = gltf.scene;
    // 归一化尺寸：缩放到约 3 个单位高，底部贴地
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(); box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 3 / maxDim;
    model.scale.setScalar(s);
    box.setFromObject(model);
    model.position.y -= box.min.y;
    model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });

    const wrapper = new THREE.Group();
    wrapper.add(model);
    wrapper.userData.factoryType = 'custom';
    wrapper.userData.baseColor = '#ffffff';
    wrapper.userData.isCustom = true;
    wrapper.userData.id = idCounter++;
    wrapper.name = (file.name.replace(/\.(glb|gltf)$/i, '') || '自定义模型') + ' ' + wrapper.userData.id;
    scene.add(wrapper);
    objects.push(wrapper);
    select([wrapper]);
    updateStats();
    flash('模型已导入 ✓（注意：自定义模型不会保存进 JSON）');
    URL.revokeObjectURL(url);
  }, undefined, (err) => {
    console.error(err);
    flash('模型加载失败');
    URL.revokeObjectURL(url);
  });
};

// ---------- 动画 ----------
let animOn = false;
const btnAnim = document.getElementById('btnAnim');
function toggleAnim() {
  animOn = !animOn;
  btnAnim.classList.toggle('active', animOn);
  btnAnim.textContent = animOn ? '⏸ 动画' : '▶ 动画';
}
btnAnim.onclick = toggleAnim;

// 遍历所有物体里带 userData.anim 的子节点并驱动
function stepAnimations(dt, t) {
  scene.traverse(node => {
    const a = node.userData && node.userData.anim;
    if (!a) return;
    if (a.type === 'conveyor' && a.rollers) {
      a.rollers.children.forEach(pkg => {
        pkg.position.x += dt * 0.9;
        if (pkg.position.x > 2) pkg.position.x = -2;
      });
    } else if (a.type === 'robot') {
      if (a.turret) a.turret.rotation.y = Math.sin(t * 0.8) * 0.9;
      if (a.upper) a.upper.rotation.z = -0.3 + Math.sin(t * 1.6) * 0.35;
    }
  });
}

// ---------- 俯视 / 透视切换 ----------
let topView = false;
const btnView = document.getElementById('btnView');
const savedCam = new THREE.Vector3();
const savedTarget = new THREE.Vector3();
function toggleView() {
  topView = !topView;
  btnView.classList.toggle('active', topView);
  btnView.textContent = topView ? '⬔ 透视' : '⬒ 俯视';
  if (topView) {
    savedCam.copy(camera.position);
    savedTarget.copy(orbit.target);
    orbit.target.set(0, 0, 0);
    camera.position.set(0, 45, 0.01);
    orbit.maxPolarAngle = Math.PI;      // 允许正上方
    orbit.enableRotate = false;         // 2D 平面图：锁定旋转，仅平移/缩放
  } else {
    orbit.enableRotate = true;
    orbit.maxPolarAngle = Math.PI / 2 - 0.02;
    camera.position.copy(savedCam.lengthSq() ? savedCam : new THREE.Vector3(14, 12, 16));
    orbit.target.copy(savedTarget.lengthSq() ? savedTarget : new THREE.Vector3(0, 1, 0));
  }
  camera.updateProjectionMatrix();
}
btnView.onclick = toggleView;

// ---------- 统计 ----------
const statsEl = document.getElementById('stats');
function updateStats() { statsEl.textContent = `物体数：${objects.length}`; }
updateStats();

// ---------- 渲染循环 ----------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (animOn) stepAnimations(dt, t);
  updateOutlines();
  orbit.update();
  renderer.render(scene, camera);
}
animate();

// ---------- 初始演示场景 ----------
function demo() {
  addComponent('cabin', new THREE.Vector3(-8, 0, -6));
  addComponent('machine', new THREE.Vector3(-3, 0, -4));
  addComponent('conveyor', new THREE.Vector3(2, 0, -4));
  addComponent('robot', new THREE.Vector3(2, 0, 0));
  addComponent('tank', new THREE.Vector3(6, 0, -5));
  addComponent('tank', new THREE.Vector3(8.2, 0, -5));
  addComponent('shelf', new THREE.Vector3(-6, 0, 3));
  addComponent('crate', new THREE.Vector3(-3, 0, 3));
  select([]);
}
demo();

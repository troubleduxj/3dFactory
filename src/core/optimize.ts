import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * 静态部件合并：把一个资产实例中"不参与动画"的网格按材质合并成少量网格，降低绘制调用。
 *
 * - 动画部件（userData.parts 中引用到的对象及其子树）保持原样
 * - 合并结果按资产 ID 缓存：同类资产的所有实例共享合并后的几何体（标记 shared，不会被释放）
 * - 材质按"实例内首次出现顺序"编号，因此每个实例仍使用自己的材质（单独改色不受影响）
 * - build 必须是确定性的（随机数只能用于动画相位）
 */
interface MergedPart {
  matIndex: number;
  geometry: THREE.BufferGeometry;
  castShadow: boolean;
  receiveShadow: boolean;
}
interface MergePlan {
  parts: MergedPart[];
  /** 合并前 / 后的网格数，用于统计 */
  before: number;
  after: number;
}

const plans = new Map<string, MergePlan | null>();

/** 收集 parts 里引用到的所有 Object3D */
function collectProtected(parts: unknown, out: Set<THREE.Object3D>, seen = new Set<unknown>()): void {
  if (!parts || typeof parts !== 'object' || seen.has(parts)) return;
  seen.add(parts);
  if (parts instanceof THREE.Object3D) {
    out.add(parts);
    return;
  }
  if (parts instanceof THREE.BufferGeometry || ArrayBuffer.isView(parts)) return;
  for (const v of Array.isArray(parts) ? parts : Object.values(parts as Record<string, unknown>)) collectProtected(v, out, seen);
}

function isUnderProtected(o: THREE.Object3D, root: THREE.Object3D, prot: Set<THREE.Object3D>): boolean {
  for (let n: THREE.Object3D | null = o; n && n !== root; n = n.parent) if (prot.has(n)) return true;
  return false;
}

function attrSignature(g: THREE.BufferGeometry): string {
  return Object.keys(g.attributes).sort().join(',') + (g.index ? '|i' : '|n');
}

/** 找出可合并的网格及其材质编号 */
function candidates(root: THREE.Group) {
  const prot = new Set<THREE.Object3D>();
  collectProtected(root.userData.parts, prot);
  const matIndex = new Map<THREE.Material, number>();
  const list: { mesh: THREE.Mesh; mi: number }[] = [];
  root.updateMatrixWorld(true);
  root.traverse(o => {
    const mat = (o as THREE.Mesh).material;
    if (mat && !Array.isArray(mat) && !matIndex.has(mat)) matIndex.set(mat, matIndex.size);
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || isUnderProtected(m, root, prot)) return;
    // 非网格的子节点（线框等）不合并；网格本身有子节点时也跳过，避免丢失子树
    if (m.children.length) return;
    list.push({ mesh: m, mi: matIndex.get(m.material as THREE.Material)! });
  });
  return { list, matIndex };
}

function buildPlan(root: THREE.Group): MergePlan | null {
  const { list } = candidates(root);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { mi: number; geos: THREE.BufferGeometry[]; cast: boolean; recv: boolean }>();
  for (const { mesh, mi } of list) {
    const key = `${mi}|${mesh.castShadow}|${mesh.receiveShadow}|${attrSignature(mesh.geometry)}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mi, geos: [], cast: mesh.castShadow, recv: mesh.receiveShadow }));
    const g = mesh.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    // 保留 morph 等会导致合并失败，统一只留常规属性
    for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
    b.geos.push(g);
  }
  const parts: MergedPart[] = [];
  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (!merged) return null; // 属性不兼容：放弃合并，保持原样
    if (b.geos.length > 1) b.geos.forEach(g => g.dispose());
    merged.userData.shared = true;
    merged.computeBoundingSphere();
    parts.push({ matIndex: b.mi, geometry: merged, castShadow: b.cast, receiveShadow: b.recv });
  }
  return { parts, before: list.length, after: parts.length };
}

/** 对一个刚 build 出来的资产实例做静态合并（原地修改并返回同一对象） */
export function optimizeInstance(assetId: string, root: THREE.Group): THREE.Group {
  let plan = plans.get(assetId);
  if (plan === undefined) {
    plan = buildPlan(root);
    plans.set(assetId, plan);
  }
  if (!plan || plan.after >= plan.before) return root;
  const { list, matIndex } = candidates(root);
  const mats: THREE.Material[] = [];
  matIndex.forEach((i, m) => (mats[i] = m));
  for (const { mesh } of list) {
    mesh.parent?.remove(mesh);
    if (!mesh.geometry.userData.shared) mesh.geometry.dispose();
  }
  for (const p of plan.parts) {
    const mat = mats[p.matIndex];
    if (!mat) continue;
    const m = new THREE.Mesh(p.geometry, mat);
    m.castShadow = p.castShadow;
    m.receiveShadow = p.receiveShadow;
    m.userData.merged = true;
    root.add(m);
  }
  return root;
}

/** 资产几何变化（如用户资产替换版本）后清除缓存 */
export function invalidatePlan(assetId: string): void {
  const p = plans.get(assetId);
  p?.parts.forEach(x => x.geometry.dispose());
  plans.delete(assetId);
}

export function planStats(): { assets: number; before: number; after: number } {
  let before = 0, after = 0, assets = 0;
  plans.forEach(p => {
    if (!p) return;
    assets++;
    before += p.before;
    after += p.after;
  });
  return { assets, before, after };
}

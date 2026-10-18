import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ImportOptions, ModelStats, Vec3 } from '../core/types';
import { renderThumbnail } from '../core/thumbs';

/**
 * GLB / glTF 导入处理：单位换算、坐标轴、原点，并统计模型信息。
 * 仅支持自包含文件（.glb，或资源以 data URI 内嵌的 .gltf）；外链贴图的 .gltf 请先打包成 .glb。
 */
export const UNIT_OPTIONS: { label: string; value: number }[] = [
  { label: '米 (m)', value: 1 },
  { label: '厘米 (cm)', value: 0.01 },
  { label: '毫米 (mm)', value: 0.001 },
  { label: '英寸 (in)', value: 0.0254 },
  { label: '英尺 (ft)', value: 0.3048 },
];
export const DEFAULT_IMPORT: ImportOptions = { unitScale: 1, upAxis: 'y', pivot: 'bottom-center' };

export interface ProcessedModel {
  /** 处理后的模板（实例通过 clone 得到） */
  template: THREE.Group;
  stats: ModelStats;
}

const loader = new GLTFLoader();

export function parseModel(data: ArrayBuffer): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.parse(data.slice(0), '', gltf => resolve(gltf.scene), err => reject(err instanceof Error ? err : new Error(String(err))));
  });
}

/** 按导入选项处理原始模型，返回模板与统计 */
export function processModel(raw: THREE.Group, opt: ImportOptions): ProcessedModel {
  const model = raw.clone(true);
  const wrap = new THREE.Group();
  if (opt.upAxis === 'z') model.rotation.x = -Math.PI / 2;
  model.scale.multiplyScalar(opt.unitScale);
  wrap.add(model);
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  if (opt.pivot !== 'keep' && !box.isEmpty()) {
    const c = box.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(c.x, opt.pivot === 'bottom-center' ? box.min.y : c.y, c.z));
    wrap.updateMatrixWorld(true);
  }
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let triangles = 0, meshes = 0;
  wrap.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    m.castShadow = m.receiveShadow = true;
    const g = m.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      materials.add(mat);
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) textures.add(v);
    }
  });
  const size = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const stats: ModelStats = {
    triangles: Math.round(triangles), meshes, materials: materials.size, textures: textures.size,
    size: [r2(size.x), r2(size.y), r2(size.z)] as Vec3,
  };
  // 共享资源：实例 clone 后共用几何体与材质，删除实例时不得释放
  wrap.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.userData.shared = true;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.userData.shared = true;
  });
  return { template: wrap, stats };
}

export function thumbnailOf(template: THREE.Group): string {
  return renderThumbnail(template.clone(true));
}

/** 由文件名得到默认资产名 */
export function guessName(fileName: string): string {
  return fileName.replace(/\.(glb|gltf)$/i, '');
}

export function formatBytes(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

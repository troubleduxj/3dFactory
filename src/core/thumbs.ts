import * as THREE from 'three';

/** 离屏缩略图渲染（素材库 / 资产管理器 / 导入预览共用一个 WebGL 上下文） */
let r: THREE.WebGLRenderer | null = null;
let sc: THREE.Scene;
let cam: THREE.PerspectiveCamera;
const W = 192, H = 144;

function ensure(): THREE.WebGLRenderer | null {
  if (r) return r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  r.setSize(W, H);
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 2.6);
  dl.position.set(5, 10, 7);
  sc.add(dl);
  cam = new THREE.PerspectiveCamera(32, W / H, 0.01, 10000);
  return r;
}

/** 渲染一个物体的缩略图（PNG dataURL）；失败返回空字符串 */
export function renderThumbnail(obj: THREE.Object3D): string {
  const rr = ensure();
  if (!rr) return '';
  sc.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) {
    sc.remove(obj);
    return '';
  }
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dir = new THREE.Vector3(1, 0.7, 1.2).normalize();
  const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 0.95;
  cam.position.copy(sphere.center).addScaledVector(dir, dist);
  cam.near = dist / 100;
  cam.far = dist * 4;
  cam.updateProjectionMatrix();
  cam.lookAt(sphere.center);
  rr.render(sc, cam);
  sc.remove(obj);
  return rr.domElement.toDataURL('image/png');
}

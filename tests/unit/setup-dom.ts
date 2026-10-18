// Node 环境下的最小 DOM 替身：道路贴图需要 canvas 2D 上下文（只用于生成纹理，测试不检查像素）
const g = globalThis as Record<string, unknown>;
if (!g.document) {
  g.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {}, fillRect() {}, fillStyle: '' }) }),
  };
}
export {};

import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

/**
 * 内容安全策略：只在生产构建中注入（dev 的 HMR 客户端 / websocket / 注入样式与严格 CSP 兼容性无法保证）。
 * - connect-src 允许 data: / blob:：GLTFLoader 通过 fetch 读取内嵌的 data: buffer 和 GLB 图片生成的 blob: URL
 * - img-src 允许 data: / blob:：缩略图为 PNG data URI，favicon 为 SVG data URI
 * - style-src 'unsafe-inline'：界面中有内联 style（如颜色色块）
 */
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' data: blob:; object-src 'none'; base-uri 'self'";

const cspPlugin: Plugin = {
  name: 'ff-csp',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: html => html.replace('<head>', `<head>\n  <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  },
};

export default defineConfig({
  // 相对路径：产物可部署到任意子目录、内网静态服务器或 GitHub Pages，不依赖外网
  base: './',
  plugins: [cspPlugin],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});

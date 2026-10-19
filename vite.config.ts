import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 相对路径：产物可部署到任意子目录、内网静态服务器或 GitHub Pages，不依赖外网
  base: './',
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

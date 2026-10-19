import { defineConfig, devices } from '@playwright/test';

// 端到端测试：构建后用 vite preview 提供页面；SwiftShader 软件渲染保证无 GPU 的 CI 也能跑 WebGL
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4173',
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

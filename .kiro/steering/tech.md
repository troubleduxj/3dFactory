---
inclusion: always
---

# 技术约定

## 技术栈
- TypeScript（strict）+ Vite 5，three.js 固定 `0.160.0`（升级需同时升级 `@types/three` 并跑全部测试）
- 测试：Vitest（`tests/unit`，Node 环境）、Playwright（`tests/e2e`，SwiftShader 软件渲染）
- CI：`.github/workflows/ci.yml`，合并到 main 自动部署 GitHub Pages

## 常用命令
- `npm run dev` 开发服务器；`npm run build` 类型检查 + 打包
- `npm run typecheck`、`npm test`、`npm run test:e2e`（需先 `npm run build`）
- 提交前至少保证 `npm run typecheck` 和 `npm test` 通过

## 编码规则
- 界面文字、注释使用中文；标识符使用英文
- 资产 ID 一律带命名空间：`<packId>/<key>`，用户资产为 `user/<uuid>`；通过 `AssetRegistry.get/resolveId` 解析，不要直接拼字符串查表
- 程序化资产的 `build(color)` 必须是确定性的（随机数只用于动画相位），动画部件放在 `userData.parts` 中——它们不会被静态合并（`core/optimize.ts`）
- 共享的几何体 / 材质要设置 `userData.shared = true`，避免删除物体时被释放
- 场景修改后调用 `invalidate()`（按需渲染）；可撤销的修改完成后调用 `pushHistory()`
- 保存格式变更必须向后兼容旧布局文件（参考 `createFromData` 对旧裸键名和 `kind: 'custom'` 的处理），并补充测试
- 调试 / 测试入口挂在 `window.__ff`，新增需要被 e2e 测试访问的能力时同步暴露

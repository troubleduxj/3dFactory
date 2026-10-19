# FactoryForge · 3D 数字孪生编辑器

浏览器端 3D 工厂布局与数字孪生编辑器。**行业无关的内核 + 行业资产包**：内置"船舶制造"（造船厂 Demo）和"通用工业"两个资产包，并提供本地 3D 资产管理。发展规划见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## 开发

```bash
npm install
npm run dev          # 开发服务器
npm run build        # 类型检查 + 打包到 dist/
npm run preview      # 预览打包结果
npm test             # 单元测试（Vitest）
npm run test:e2e     # 端到端测试（Playwright，需先 build）
```

`dist/` 为纯静态文件，所有依赖已打包，**不访问任何外部网络**，可直接部署到内网静态服务器。合并到 `main` 后 GitHub Actions 自动部署到 GitHub Pages（需在仓库 Settings → Pages 中将 Source 设为 GitHub Actions）。

URL 参数：`?scene=factory` 指定启动场景，`?noanim` 关闭动画，`?nomerge` 关闭静态合并（性能对比用）。

## 功能

- **资产包**：按行业组织资产与演示场景；资产 ID 带命名空间（`shipyard/drydock`），旧版布局文件中的裸键名自动映射
- **3D 资产管理**（工具栏"资产管理"或按 `M`）
  - 导入 GLB / glTF：单位（m/cm/mm/in/ft）、向上轴（Y / Z）、原点（底部中心 / 中心 / 保留），实时预览尺寸，自动生成缩略图
  - 元数据：名称、分类、标签、行业、说明；统计面数、网格、材质、贴图、文件大小
  - 替换新版本、按新选项重新处理，场景中的实例自动更新；显示场景引用数；导出原文件；删除（实例变为占位框，可恢复）
  - 本机持久化（IndexedDB）；**项目包** `.ffproj.json` 同时包含布局和用到的自定义模型
- **编辑**：移动 / 旋转 / 缩放、吸附、多选、对齐分布、成组、锁定 / 隐藏、撤销重做、场景大纲、属性面板、场景设置（场地、光照、阴影）
- **性能**：静态部件按材质合并（造船厂场景每帧绘制调用 975 → 417），场景无变化时不重绘，状态栏显示绘制调用与面数

按 `?` 查看全部快捷键。

## 目录

```
src/
  main.ts               入口
  editor.ts             编辑器（场景、选择、变换、历史、界面）
  core/                 行业无关内核：类型、资产注册表、布局工具、静态合并、缩略图
  assets/               3D 资产管理：存储（IndexedDB）、导入处理、资产库、管理器界面
  packs/                行业资产包
    common/             通用工业：建模工具包 kit.ts、资产、通用工厂 / 空白场景
    shipyard/           船舶制造：资产、造船厂 Demo
  styles/style.css
tests/unit/             Vitest 单元测试
tests/e2e/              Playwright 端到端测试（fixtures/ 下为测试模型及其生成脚本）
docs/ROADMAP.md         路线图
```

## 新增一个行业

1. 新建 `src/packs/<industry>/`，导出一个 `AssetPack`（`id`、`name`、`industry`、`categories`、`assets`、`scenes`）
2. 程序化资产使用 `packs/common/kit.ts` 中的建模工具；`build(color)` 需是确定性的（随机数只用于动画相位），带动画的部件放在 `userData.parts` 中，它们不会参与静态合并
3. 在 `src/packs/index.ts` 的 `BUILTIN_PACKS` 中加入该包

真实模型也可以直接在资产管理器中导入，无需写代码。

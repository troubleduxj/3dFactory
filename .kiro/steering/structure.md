---
inclusion: always
---

# 目录结构

```
src/
  main.ts            入口
  editor.ts          编辑器：场景、选择、变换、历史、素材库、属性面板、导入导出
  core/              行业无关内核
    types.ts         所有数据类型（资产包、布局、用户资产、项目包）
    registry.ts      资产注册表（资产包 + 用户资产，命名空间 ID，旧键名映射）
    layout.ts        场景编写辅助 C() / G()、walkComponents
    optimize.ts      静态部件按材质合并（按资产 ID 缓存）
    thumbs.ts        离屏缩略图
  assets/            3D 资产管理
    store.ts         AssetStore 接口 + IndexedDB / 内存实现（阶段 2 将新增服务端实现）
    importer.ts      GLB/glTF 解析、单位 / 向上轴 / 原点处理、统计
    library.ts       用户资产库：导入、版本替换、重新处理、元数据、项目包打包
    manager-ui.ts    资产管理器弹窗
  packs/             行业资产包（BUILTIN_PACKS 在 packs/index.ts）
    common/          通用工业：kit.ts 建模工具包、assets.ts、scenes.ts
    shipyard/        船舶制造：assets.ts、scenes.ts（造船厂 Demo）
tests/unit/          Vitest
tests/e2e/           Playwright（fixtures/ 含测试模型及生成脚本）
docs/ROADMAP.md      路线图
```

新增行业：新建 `src/packs/<industry>/index.ts` 导出 `AssetPack`，加入 `BUILTIN_PACKS`，并确保 `tests/unit/registry.test.ts` 中的场景引用检查通过。

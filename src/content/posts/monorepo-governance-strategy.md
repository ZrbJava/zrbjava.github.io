---
title: "Monorepo 架构治理与依赖管理"
description: "pnpm workspace、Turborepo、Changesets 与大型前端 Monorepo 的边界设计与依赖治理。"
pubDate: 2026-06-23
category: "工程化"
tags: ["Monorepo", "pnpm", "Turborepo", "Changesets"]
series: "前端工程化体系"
draft: false
featured: false
---

Monorepo 是大型前端团队的标配，但「把所有代码放一个仓库」不等于 Monorepo。高级前端需要展示的是**包边界设计**、**依赖治理**和**发布策略**。

## 为什么需要 Monorepo

| 痛点 | Monorepo 解决方案 |
|------|-------------------|
| 跨项目代码复用 | 共享 packages |
| 版本不一致 | 统一依赖版本 |
| 原子化变更 | 一个 PR 改多个包 |
| CI 效率 | 增量构建（Turborepo） |
| 代码审查 | 统一 PR 流程 |

## 典型目录结构

```
monorepo/
├── apps/
│   ├── web/              # 主站 React 应用
│   ├── admin/            # 管理后台 Vue 应用
│   └── desktop/          # Electron 桌面端
├── packages/
│   ├── ui/               # 共享组件库
│   ├── utils/            # 工具函数
│   ├── config/           # 共享 ESLint/TS 配置
│   └── api-client/       # API 客户端 SDK
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## pnpm Workspace

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// packages/ui/package.json
{
  "name": "@company/ui",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "dependencies": {
    "@company/utils": "workspace:*"
  }
}
```

**pnpm 的优势：**

- 硬链接节省磁盘空间
- `workspace:*` 协议自动链接本地包
- 严格的依赖隔离（不会幽灵依赖）

## Turborepo 增量构建

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

```
turbo run build --filter=...@company/web
→ 只构建 web 及其依赖链，跳过无关包
→ 缓存命中时直接跳过（远程缓存共享给 CI）
```

## 包边界设计原则

1. **单向依赖**：apps → packages，packages 之间不允许循环依赖
2. **最小暴露**：每个 package 只 export 公共 API
3. **独立版本**：用 Changesets 管理各 package 版本
4. **共享配置**：ESLint、TSConfig、Prettier 抽为 `@company/config`

```ts
// packages/ui/src/index.ts — 只暴露公共 API
export { Button } from './Button';
export { Modal } from './Modal';
// 不 export 内部 utils
```

## Changesets 版本管理

```bash
# 1. 开发者添加 changeset
pnpm changeset
# → 选择变更的包和 semver 类型

# 2. CI 自动创建 Version PR
# → 更新 package.json 版本 + CHANGELOG

# 3. 合并后自动发布到 npm
```

## 常见陷阱

1. **过度共享**：不是所有代码都值得抽 package，三次重复再抽
2. **循环依赖**：packages 互相引用 → 用 dependency-cruiser 检测
3. **构建顺序错误**：turbo.json 的 `dependsOn` 配置遗漏
4. **幽灵依赖**：直接用未声明的依赖 → pnpm 的 strict 模式可以检测

## 面试表达

「我们的 Monorepo 包含 4 个应用和 12 个共享包。用 pnpm workspace 管理依赖，Turborepo 做增量构建，CI 从 20 分钟降到 5 分钟。Changesets 管理版本发布，每个 package 独立 semver。」

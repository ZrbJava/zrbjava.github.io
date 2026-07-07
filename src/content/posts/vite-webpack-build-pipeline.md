---
title: "Vite 与 Webpack 构建原理对比"
description: "从 ESM 开发服务器到 Rollup 生产构建，理解 Vite/Webpack/Rspack 的编译模型与选型依据。"
pubDate: 2026-06-22
category: "工程化"
tags: ["Vite", "Webpack", "Rspack", "Build"]
series: "前端工程化体系"
draft: false
featured: true
cover: "/images/covers/vite-webpack-build-pipeline.svg"
---

2024 年我们把一个 12 万行、Webpack 5 的中后台迁到 Vite：**冷启动 52s → 1.8s**，HMR 3s → 200ms；生产构建从 8min → 4.5min（Rollup）。迁移用了 3 个 sprint，最大坑不是配置，而是 **CommonJS 混用 + 自定义 Webpack 插件** 没有 Vite 等价物。

## 开发环境：为什么 Vite 快

### Webpack dev

```
entry → 递归 build dependency graph → 打 bundle → 写盘 → dev server
```

图越大，冷启动线性变差。我们 4000+ 模块时 **52s** 才看到首屏。

### Vite dev

```
浏览器请求 /src/main.tsx
  → esbuild 转 TS（仅该文件）
  → 浏览器 ESM import 继续拉依赖
  → 预构建 node_modules（esbuild 打包 deps 成 ESM）
```

**差异**：Vite 按请求编译；Webpack 先全量打包。大项目 dev 体验差距来自 **工作量的数量级**，不是 esbuild 比 babel 快一点点。

## 生产构建

| | Vite (Rollup) | Webpack 5 |
|---|---------------|-----------|
| 打包器 | Rollup tree-shake 静态分析强 | 自身 + sideEffects |
| CJS 混用 | 易踩坑，需 optimizeDeps | 原生支持 |
| MF 微前端 | 实验性 / 第三方 | Module Federation 成熟 |
| 插件生态 | Rollup 插件 | 最丰富 |

## Webpack Tapable（写插件仍需要）

```ts
class BundleAnalyzerPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.done.tap('BundleAnalyzerPlugin', (stats) => {
      const json = stats.toJson({ assets: true, modules: false });
      // 超阈值 asset 告警
    });
  }
}
```

迁移时我们把「emit 阶段写 manifest」改到 **Vite `build.rollupOptions.plugins` 的 `generateBundle` hook**。

## 真实迁移 timeline

| Sprint | 内容 | 结果 |
|--------|------|------|
| W1 | 并行跑 Webpack + Vite，对齐 alias/tsconfig | dev 可跑，20% 路由报错 |
| W2 | `vite-plugin-commonjs`、替换 3 个 Webpack-only loader | HMR 稳定 |
| W3 | 生产 build 对齐 bundle 体积，Lighthouse 无回退 | CI 切 Vite |
| 缓冲 | 保留 Webpack job 1 个月 | 零 rollback |

### 插件兼容清单（我们遇到的）

| Webpack | Vite 替代 |
|---------|-----------|
| `thread-loader` | 不需要（esbuild 够快） |
| `copy-webpack-plugin` | `vite-plugin-static-copy` |
| 自定义 `emit` 写版本号 | `vite-plugin-html` + env |
| Module Federation | 暂保留子应用 Webpack，壳用 Vite |

**没迁完的部分**：一个子应用仍 Webpack MF，主壳 Vite——**混合 monorepo 可接受**，全迁 MF 成本过高。

## Rspack 第三条路

```
Webpack 配置 → 换 @rspack/core → 70% 插件直接用
```

适合：**不能迁 Vite（MF/CJS 太深）但 build > 5min**。我们另一个 repo 用 Rspack，**build 14min → 3min**，零路由改动。

## 选型决策树（带 rejected）

```
新项目？
  ├─ Next/Nuxt → 跟框架
  ├─ 强 MF → Webpack 5 / Rspack
  ├─ 中后台 SPA、ESM 为主 → Vite
  └─ 工具库 → tsup / unbuild

老项目 Webpack 慢？
  ├─ 插件深度绑定 → 先试 Rspack
  └─ 标准 SPA → 评估 Vite 迁移（2–4 周）
```

## 构建性能通用手段

1. `cache: { type: 'filesystem' }`（Webpack）/ Vite 默认 cacheDir
2. 缩小 transform 范围：`include: [src]`
3. 生产 Source Map：`hidden-source-map` + 私有化上传（见 [监控体系](/posts/frontend-monitoring-system)）
4. `rollup-plugin-visualizer` / `webpack-bundle-analyzer` 每 sprint 看一次

## 迁移后指标（摘要）

- dev 冷启动：52s → 1.8s
- HMR：~3s → ~200ms
- prod build：8min → 4.5min
- 首屏 JS 体积：-12%（Rollup tree-shake 更 aggressive）

构建选型没有银弹：**Vite 赢 dev 体验，Webpack/Rspack 赢 MF 与 CJS 遗产**。能讲清一次真实迁移的坑与指标，比背「Vite 用 esbuild」更有工程价值。

---
title: "Vite 与 Webpack 构建原理对比"
description: "从 ESM 开发服务器到 Rollup 生产构建，理解 Vite/Webpack/Rspack 的编译模型与选型依据。"
pubDate: 2026-06-22
category: "工程化"
tags: ["Vite", "Webpack", "Rspack", "Build"]
series: "前端工程化体系"
draft: false
featured: true
---

构建工具选型是前端工程化的第一道关。8 年经验的前端不应该只会 `npm run dev`，而要能解释**为什么 Vite 开发环境快**、**Webpack 的 Tapable 钩子体系**、以及**什么场景该用 Rspack**。

## 开发环境：为什么 Vite 快

### Webpack 开发模式

```
入口文件 → 递归解析所有依赖 → 打包成 bundle → 写入磁盘 → 启动 dev server
```

项目越大，冷启动越慢（10 万行代码可能需要 30-60 秒）。

### Vite 开发模式

```
利用浏览器原生 ESM → 按需编译单个模块 → 毫秒级冷启动
```

```
浏览器请求 /src/App.tsx
  → Vite 拦截 → esbuild 转译 TSX → 返回 JS
  → 浏览器解析 import → 继续请求子模块
```

**关键差异：Vite 不打包，按需编译；Webpack 先打包再服务。**

## 生产构建

|                | Vite            | Webpack                       |
| -------------- | --------------- | ----------------------------- |
| 生产打包器     | Rollup          | Webpack 自身                  |
| Tree Shaking   | Rollup 静态分析 | 模块标记 + 副作用分析         |
| Code Splitting | 动态 import     | SplitChunksPlugin             |
| CSS 处理       | PostCSS 内置    | css-loader + mini-css-extract |
| 产物格式       | ESM 优先        | 可配置                        |

## Webpack 核心概念

### Tapable 钩子系统

Webpack 的插件机制基于 Tapable：

```ts
class MyPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap("MyPlugin", (compilation) => {
      compilation.hooks.optimizeChunks.tap("MyPlugin", (chunks) => {
        // 在 chunk 优化阶段介入
      });
    });
  }
}
```

常用钩子：

- `entryOption` → 入口配置
- `compile` → 开始编译
- `compilation` → 创建 compilation 对象
- `emit` → 输出资源到目录前
- `done` → 编译完成

### Loader vs Plugin

- **Loader**：文件转换器（TS → JS，CSS → JS Module）
- **Plugin**：编译流程介入者（代码分割、压缩、分析）

## Rspack：Rust 版 Webpack

Rspack 用 Rust 重写 Webpack 兼容 API，性能提升 5-10 倍：

```
Webpack 项目 → 替换 webpack 为 @rspack/core → 大部分插件/Loader 兼容
```

适合：大型 Webpack 项目想提速但不想迁移到 Vite。

## 选型决策树

```
新项目？
├── 框架自带（Next.js/Nuxt/Create React App）→ 跟随框架
├── 需要 Webpack 生态插件 → Webpack 5 / Rspack
├── 追求开发体验 → Vite
└── 微前端/Module Federation → Webpack 5 / Rspack

老项目优化？
├── Webpack 慢 → 先试 Rspack，再考虑 Vite 迁移
├── Vite 生产问题 → 检查 Rollup 插件兼容性
└── 构建 > 5 分钟 → 分析 bundle + 缓存 + 并行
```

## 构建性能优化通用策略

1. **持久化缓存**：Webpack `cache: { type: 'filesystem' }` / Vite 自带
2. **缩小编译范围**：`include/exclude` 精确配置 Loader
3. **并行处理**：thread-loader / esbuild-loader
4. **DLL / External**：第三方库不重复打包
5. **Source Map 策略**：开发 `eval-cheap-module-source-map`，生产 `hidden-source-map`

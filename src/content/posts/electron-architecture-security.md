---
title: "Electron 架构设计与安全实践"
description: "主进程/渲染进程模型、IPC 通信、Context Isolation、Preload 脚本与 Electron 安全最佳实践。"
pubDate: 2026-06-25
category: "跨端开发"
tags: ["Electron", "Desktop", "Security", "IPC"]
series: "跨端与 Electron 桌面开发"
draft: false
featured: true
---

Electron 让前端开发者用 Web 技术构建桌面应用，但「会写 React 不等于会写 Electron」。高级前端面试中，Electron 方向考察的是**进程模型理解**和**安全意识**。

## 进程架构

```
┌─────────────────────────────────────────┐
│              Main Process               │
│  Node.js 环境 · 窗口管理 · 系统 API     │
│  app · BrowserWindow · ipcMain          │
├──────────┬──────────┬───────────────────┤
│ Renderer │ Renderer │   Utility Process │
│ (React)  │ (React)  │   (Node.js 任务)  │
│ 网页 UI  │ 网页 UI  │   文件处理/加密    │
└──────────┴──────────┴───────────────────┘
```

- **Main Process**：唯一，管理应用生命周期和窗口
- **Renderer Process**：每个 BrowserWindow 一个，运行 Web 页面
- **Utility Process**（Electron 22+）：独立 Node.js 进程，处理 CPU 密集任务

## IPC 通信模式

### 安全的 Preload 桥接

```ts
// preload.ts — 在隔离上下文中运行
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  onProgress: (callback: (percent: number) => void) => {
    ipcRenderer.on('download:progress', (_event, percent) => callback(percent));
  },
});
```

```ts
// main.ts — 主进程处理
ipcMain.handle('file:read', async (_event, filePath: string) => {
  // 验证路径，防止目录遍历攻击
  const safePath = path.resolve(app.getPath('userData'), path.basename(filePath));
  return fs.readFile(safePath, 'utf-8');
});
```

```tsx
// renderer — React 组件中使用
const content = await window.electronAPI.readFile('config.json');
```

### IPC 通信方式对比

| 方式 | 方向 | 特点 |
|------|------|------|
| ipcRenderer.send | Renderer → Main | 单向，不等待返回 |
| ipcRenderer.invoke | Renderer → Main | 双向，Promise 返回 |
| webContents.send | Main → Renderer | 主进程主动推送 |
| MessagePort | 双向 | 高性能，适合大量数据传输 |

## 安全 checklist

Electron 官方安全指南的核心要求：

```ts
// ✅ 安全的 BrowserWindow 配置
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,        // 禁止渲染进程直接访问 Node.js
    contextIsolation: true,        // 隔离 preload 和页面上下文
    sandbox: true,                 // 启用沙箱
    webSecurity: true,             // 启用同源策略
    allowRunningInsecureContent: false,
  },
});
```

**绝对不要做的事：**

1. `nodeIntegration: true` — 任何 XSS 都能执行系统命令
2. 在渲染进程直接使用 `require('fs')` — 绕过安全边界
3. 加载远程 URL 且不验证内容 — 供应链攻击入口
4. Preload 中暴露完整的 ipcRenderer — 最小权限原则

## 自动更新

```ts
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify();
autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall();
});
```

关键决策：

- 全量更新 vs 增量更新（electron-updater 支持差分）
- 更新通道：stable / beta / alpha
- 回滚策略：保留上一版本安装包

## Electron vs Tauri 选型

| 维度 | Electron | Tauri 2 |
|------|----------|---------|
| 运行时 | Chromium + Node.js | 系统 WebView + Rust |
| 安装包体积 | 80-150MB | 3-10MB |
| 内存占用 | 较高 | 较低 |
| 生态成熟度 | 非常成熟 | 快速增长 |
| 前端技术栈 | 任意 Web 技术 | 任意 Web 技术 |
| 原生能力 | Node.js 全生态 | Rust 插件 |
| 适合场景 | 复杂桌面应用 | 轻量工具类应用 |

## 面试项目表达

「我们的 Electron 应用服务 10 万+ 桌面用户。架构上采用 Main Process 管理窗口和系统 API，Renderer 纯 React UI，通过 Preload 桥接 IPC。安全方面严格执行 Context Isolation，所有文件操作走 Main Process 并验证路径。自动更新用 electron-updater，支持增量更新和灰度发布。」

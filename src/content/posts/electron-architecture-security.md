---
title: "Electron 架构设计与安全实践"
description: "主进程/渲染进程模型、IPC 通信、Context Isolation、Preload 脚本与 Electron 安全最佳实践。"
pubDate: 2026-06-25
category: "跨端开发"
tags: ["Electron", "Desktop", "Security", "IPC"]
series: "跨端与 Electron 桌面开发"
draft: false
featured: true
cover: "/images/covers/electron-architecture-security.svg"
---

桌面客户端 10 万+ MAU，2023 年一次 **渲染进程 XSS** 差点变成 RCE——因为旧分支仍开着 `nodeIntegration`。全面启用 Context Isolation + sandbox + 最小 Preload 后，安全审计通过，**CVE 类问题从 2 起/年降到 0**。Electron 面试考的不是会不会写 React，而是 **进程边界与威胁模型**。

## 进程模型

```
Main (1) ── BrowserWindow × N ── Renderer (React)
         └── UtilityProcess (加密、大文件)
```

- **Main**：窗口、菜单、系统 API、所有 `fs`/`shell`
- **Renderer**：纯 Web UI，`nodeIntegration: false`
- **Utility**（22+）：CPU 密集任务，避免阻塞 Main

## 安全 BrowserWindow 配置

```ts
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
  },
});
```

### sandbox: true 下的 Preload 限制

沙箱内 Preload **不能**随意 `require('fs')`——Filesystem 能力必须在 Main 通过 `ipcMain.handle` 暴露，且 **验证 every path**。

```ts
// preload.ts — 只暴露白名单 API
contextBridge.exposeInMainWorld('desktop', {
  readConfig: () => ipcRenderer.invoke('config:read'),
  saveExport: (name: string, data: Uint8Array) =>
    ipcRenderer.invoke('export:save', { name, data }),
  // ❌ 不要 expose ipcRenderer.send 任意 channel
});
```

```ts
// main.ts
ipcMain.handle('export:save', async (_event, { name, data }: Payload) => {
  const safeName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '');
  const dir = app.getPath('downloads');
  const full = path.join(dir, safeName);
  if (!full.startsWith(dir)) throw new Error('path traversal');
  await fs.writeFile(full, Buffer.from(data));
  return { path: full };
});
```

## 真实 CVE 类教训（抽象案例）

| 事件 | 根因 | 修复 |
|------|------|------|
| 渲染 XSS → 读本地文件 | `nodeIntegration: true` | 关 Node，走 IPC |
| Preload 暴露 `shell.openExternal(userUrl)` | 未校验 URL scheme | 只允许 `https:` 白名单域名 |
| 加载第三方 `webview` 远程页 | 等同浏览器装插件 | 禁用 webview 或严格 CSP |

**CSP for Electron Renderer**（`index.html` meta 或 session）：

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; connect-src 'self' https://api.example.com;" />
```

## IPC 选型

| API | 场景 |
|-----|------|
| `invoke/handle` | 请求/响应（读配置、写文件） |
| `webContents.send` | Main 推进度（下载、更新） |
| MessageChannel | 大二进制流（避免 JSON 序列化） |

```ts
// 大文件：Main 推 ArrayBuffer，Renderer 用 Worker 处理
const { port1, port2 } = new MessageChannelMain();
worker.postMessage({ port: port2 }, [port2]);
win.webContents.postMessage('chunk', null, [port1]);
```

## autoUpdater 安全链

```ts
import { autoUpdater } from 'electron-updater';

autoUpdater.autoDownload = false;
autoUpdater.on('update-available', (info) => {
  // 展示版本、签名信息，用户确认后再 download
});
autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({ message: '重启安装更新？' }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});
```

- 更新包 **HTTPS + 代码签名**（Windows Authenticode / macOS notarize）
- `electron-updater` 校验 blockmap；**禁止**自定义 HTTP 热更 JS bundle（等同远程代码执行）
- 保留 **上一版本 installer** 供 rollback（见 [性能与打包](/posts/electron-performance-packaging)）

## Electron vs Tauri（我们选型理由）

选 Electron：**深度 Node 生态**（原生模块、PDF、加密）、团队已有 3 年 Electron 资产。Tauri 2 在 10MB 级工具类更合适；我们安装包 120MB 但功能复杂度 Tauri 插件成本更高。

## 面试/复盘表达模板

「Main 管窗口与系统 API，Renderer 纯 React，Preload 最小桥接。`sandbox + contextIsolation`，文件 IPC 校验 path。更新走 signed autoUpdater，渲染 CSP 禁 inline。XSS 面与浏览器同级，但 **绝不能** 在 Renderer 开 Node。」

Electron 安全没有灰色地带：**Renderer 当不可信环境**，所有能力经 Main 白名单 IPC，更新链路与浏览器下载一样严肃。

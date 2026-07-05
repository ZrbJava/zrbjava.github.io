---
title: "Electron 性能优化与打包发布"
description: "渲染进程性能调优、内存泄漏排查、Vite+Electron 构建配置与多平台打包策略。"
pubDate: 2026-06-26
category: "跨端开发"
tags: ["Electron", "Performance", "Vite", "Packaging"]
series: "跨端与 Electron 桌面开发"
draft: false
featured: false
---

Electron 应用的性能问题往往被忽视——「能跑就行」。但高级前端需要关注：**启动速度、内存占用、CPU 使用率和打包体积**，这些直接影响用户体验和分发成本。

## 启动性能优化

### 延迟加载

```ts
// main.ts — 先显示窗口，再加载重资源
const win = new BrowserWindow({
  show: false,
  webPreferences: { preload: path.join(__dirname, "preload.js") },
});

win.once("ready-to-show", () => win.show());
win.loadURL(/* ... */);
```

### Vite + Electron 构建架构

```
electron-vite 项目结构：
├── src/main/       # 主进程（Node.js）
├── src/preload/    # Preload 脚本
└── src/renderer/   # 渲染进程（React/Vue）
```

关键配置：

```ts
// electron.vite.config.ts
export default defineConfig({
  main: {
    build: { rollupOptions: { external: ["electron"] } },
  },
  renderer: {
    plugins: [react()],
    build: { minify: "esbuild" },
  },
});
```

## 内存泄漏排查

Electron 应用常见的内存泄漏源：

1. **未清理的 IPC 监听器**

```ts
// ❌ 泄漏
ipcRenderer.on("update", handler);

// ✅ 清理
const handler = (_e: any, data: any) => {
  /* ... */
};
ipcRenderer.on("update", handler);
// 组件卸载时
ipcRenderer.removeListener("update", handler);
```

2. **BrowserWindow 未销毁**

```ts
// 窗口关闭时确保引用释放
win.on("closed", () => {
  win = null;
});
```

3. **DevTools 在生产环境打开** → 打包时移除

### 排查工具

- Chrome DevTools Memory Profiler（渲染进程）
- `process.memoryUsage()`（主进程）
- `electron --inspect` 远程调试

## 渲染进程优化

与 Web 应用相同的优化手段，加上 Electron 特有策略：

| 策略                       | 说明                                                      |
| -------------------------- | --------------------------------------------------------- |
| 禁用不必要的 Chromium 特性 | `app.commandLine.appendSwitch('disable-features', '...')` |
| 限制 Renderer 进程数       | 合并窗口或使用 BrowserView                                |
| 离线资源内联               | 避免 CDN 依赖                                             |
| 图片/资源懒加载            | 同 Web 优化                                               |
| Web Worker 处理计算        | 避免阻塞 Renderer 主线程                                  |

## 打包与分发

### electron-builder 配置

```json
{
  "build": {
    "appId": "com.example.app",
    "productName": "MyApp",
    "directories": { "output": "release" },
    "mac": {
      "target": ["dmg", "zip"],
      "hardenedRuntime": true,
      "entitlements": "entitlements.mac.plist"
    },
    "win": {
      "target": ["nsis"],
      "certificateFile": "cert.pfx"
    },
    "linux": {
      "target": ["AppImage", "deb"]
    }
  }
}
```

### 代码签名

- **macOS**：Apple Developer 证书 + Notarization（必须，否则 Gatekeeper 拦截）
- **Windows**：EV 代码签名证书（SmartScreen 信任）
- **Linux**：AppImage 自包含，deb 需要 GPG 签名

## 多平台 CI/CD

```yaml
# GitHub Actions 多平台构建
jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - run: npm run package
      - uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: release/
```

## 性能指标基准

| 指标           | 目标值  | 测量方式           |
| -------------- | ------- | ------------------ |
| 冷启动         | < 3s    | 从双击到窗口可交互 |
| 内存（空闲）   | < 200MB | Activity Monitor   |
| 内存（重负载） | < 500MB | 长时间使用后       |
| 安装包体积     | < 100MB | 打包产物大小       |
| 自动更新       | < 30s   | 差分包下载+安装    |

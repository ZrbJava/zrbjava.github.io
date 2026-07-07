---
title: "移动端 H5 适配架构：从 viewport 到组件级响应式"
description: "viewport 策略、rem/vw 动态适配、安全区、软键盘与 WebView 容器的移动端 H5 工程化方案。"
pubDate: 2026-07-05
category: "跨端开发"
tags: ["Mobile", "H5", "Adaptation", "WebView"]
series: "移动端 H5 与适配"
seriesOrder: 1
draft: false
featured: false
cover: "/images/covers/mobile-h5-adaptation-architecture.svg"
---

App 内嵌 H5 活动页在 iPhone 14 Pro（灵动岛）底部按钮被挡，Android 某 WebView 键盘顶起后 **fixed 底栏飞到天上去**——同一套 CSS 在 Safari、微信 X5、各家 WebView 表现不一致。我们沉淀了 **适配层 + Bridge + visualViewport** 三层方案，兼容矩阵覆盖 12 款机型。

## 架构分层

```
Native WebView + JSBridge
    ↓
适配层 (rem / safe-area / dpr)
    ↓
组件 (Button, Modal, List)
    ↓
业务
```

## 适配策略：rem + 关键 vw

设计稿 750px 宽：

```ts
// adapter.ts — 限制最大缩放，避免 iPad 字体爆炸
function setRootFontSize() {
  const width = Math.min(document.documentElement.clientWidth, 540);
  document.documentElement.style.fontSize = `${width / 7.5}px`;
}
setRootFontSize();
window.addEventListener('resize', setRootFontSize);
```

```css
.hero {
  width: 100vw;
  height: 42vw; /* Banner 铺满 */
}
.body-text {
  font-size: 0.28rem; /* 正文随 rem */
}
```

Rejected 纯 vw：正文在小屏上过小，大屏上过大；**混合**更稳。

## safe-area 与 1px

```css
.footer-bar {
  padding-bottom: calc(0.24rem + env(safe-area-inset-bottom));
}

.hairline::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 1px;
  background: var(--line);
  transform: scaleY(0.5);
}
@media (-webkit-min-device-pixel-ratio: 3) {
  .hairline::after {
    transform: scaleY(0.333);
  }
}
```

## 软键盘：visualViewport

```ts
if (window.visualViewport) {
  const vv = window.visualViewport;
  vv.addEventListener('resize', () => {
    const offset = window.innerHeight - vv.height - vv.offsetTop;
    document.documentElement.style.setProperty('--keyboard-offset', `${Math.max(0, offset)}px`);
  });
}
```

```css
.input-dock {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom) + var(--keyboard-offset, 0px));
}
```

iOS 旧 WebView 无 `visualViewport` 时降级：聚焦时 `scrollIntoView` + 去掉 footer `fixed`。

## WebView 差异矩阵（摘要）

| 容器 | 坑 | 对策 |
|------|-----|------|
| iOS WKWebView | 100vh 含地址栏 | `--vh: window.innerHeight * 0.01px` |
| 微信 X5 | 字体缩放 | `-webkit-text-size-adjust: 100%` |
| Android 4.x WebView | flex gap 不支持 | margin 降级 |
| 部分 App 壳 | 无 safe-area | Bridge 读原生 inset |

## JSBridge

```ts
export async function callNative<T>(module: string, action: string, payload?: unknown): Promise<T> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('bridge timeout')), 8000);
    (window as any)[`__cb_${id}`] = (res: T) => {
      clearTimeout(timer);
      resolve(res);
    };
    postToNative({ id, module, action, payload });
  });
}
```

协议版本号放 payload，便于灰度。

## 性能预算与 RUM

| 指标 | 4G 目标 |
|------|---------|
| FCP | < 1.8s |
| 首屏 JS | < 120KB gzip |
| 图片 | WebP + 懒加载 |

接入 [监控 SDK](/posts/frontend-monitoring-system)，按 **WebView UA + App 版本** 分桶看 LCP。

## 离线缓存（活动页）

Service Worker 仅缓存静态壳 + 上次 JSON 配置；**支付/抽奖接口不缓存**。`workbox` precache 注意体积上限 50MB。

H5 适配不是写一段 flexible.js，而是 **safe-area、键盘、WebView 矩阵、Bridge 协议** 一起设计。先在真机矩阵测，再谈 vw/rem 哲学。

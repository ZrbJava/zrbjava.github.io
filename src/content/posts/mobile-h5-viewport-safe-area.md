---
title: "H5 视口、安全区与 1px 边框实战"
description: "viewport-fit、env(safe-area-inset)、rem/vw 方案、高清屏 1px 与 WebView 兼容清单。"
pubDate: 2026-07-11
category: "跨端开发"
tags: ["H5", "Mobile", "CSS", "Viewport"]
series: "移动端 H5 与适配"
seriesOrder: 2
draft: false
featured: false
cover: "/images/covers/mobile-h5-viewport-safe-area.svg"
---

> **前置阅读**：[移动端 H5 适配架构](/posts/mobile-h5-adaptation-architecture) · **本专题第 2 篇**

中后台 H5 嵌 App WebView、活动页全屏时，**刘海、底部横条、100vh 陷阱、1px 发虚** 四类问题占适配工时的大头。这篇是可直接抄进项目的 CSS 清单。

## viewport 基础

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

`viewport-fit=cover` 才能用 `env(safe-area-inset-*)`，否则 iPhone 全屏页底部按钮会被 Home Indicator 挡住。

## 安全区

```css
.page {
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.fixed-footer {
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
```

**100vh 问题**：移动端地址栏伸缩导致 `100vh` 溢出。优先：

```css
.full-screen {
  min-height: 100dvh; /* 动态视口，新浏览器 */
  min-height: -webkit-fill-available; /* 旧 WebKit 兜底 */
}
```

## rem / vw 选型

| 方案 | 适用 | 注意 |
|------|------|------|
| rem + 根字体 | 活动页、设计稿 750 | 限制 max-width 防平板拉伸 |
| vw | 纯展示型 | 小屏字体可能过小，加 clamp |
| px + 媒体查询 | 中后台 | 与 PC 设计系统一致 |

```css
html {
  font-size: clamp(14px, 3.733vw, 20px); /* 375 设计稿：1rem=14px 起 */
}
```

## 1px 边框

高清屏 `1px solid #eee` 发虚。常用 **伪元素 scale**：

```css
.hairline-bottom::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--line);
  transform: scaleY(0.5);
  transform-origin: bottom;
}
```

或项目统一用 `border: 0.5px`（部分 Android 不支持，需 fallback）。

## WebView 兼容

- **iOS WKWebView**：注意 cookie `SameSite`、ITP 导致第三方 cookie 丢失
- **Android 混合**：`targetSdk 30+` 分区存储影响文件上传
- **键盘顶起**：`visualViewport` API 监听，fixed 底栏改 transform

```ts
visualViewport?.addEventListener('resize', () => {
  footer.style.transform = `translateY(${window.innerHeight - visualViewport.height}px)`;
});
```

## 自测清单

- [ ] 刘海机全屏页底栏不被遮挡
- [ ] 100vh 页面无「多出一截滚动」
- [ ] 1px 分割线在 2x/3x 屏清晰
- [ ] 键盘弹起时输入框可见

---

**系列回顾**：[第 1 篇 · H5 适配架构](/posts/mobile-h5-adaptation-architecture) · [H5 专题](/topics/mobile-h5)

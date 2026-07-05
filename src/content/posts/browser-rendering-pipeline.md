---
title: "浏览器渲染流水线与性能优化"
description: "从 URL 输入到像素输出：关键渲染路径、重排重绘、合成层与 GPU 加速的完整链路。"
pubDate: 2026-06-15
category: "浏览器原理"
tags: ["Browser", "Rendering", "Performance", "GPU"]
series: "浏览器与网络底层"
draft: false
featured: true
---

「从输入 URL 到页面展示发生了什么？」是前端面试的永恒经典。8 年经验的高级前端不仅要背流程，更要能关联到**具体的性能优化手段**。

## 完整渲染流水线

```
HTML → DOM Tree
CSS  → CSSOM Tree
        ↓
    Render Tree（DOM + CSSOM，排除 display:none）
        ↓
    Layout（Reflow）— 计算几何位置
        ↓
    Paint — 绘制像素
        ↓
    Composite — 合成图层，GPU 输出
```

## 关键渲染路径优化

### 1. 减少阻塞资源

```html
<!-- CSS 阻塞渲染，放 head 并最小化 -->
<link rel="stylesheet" href="critical.css">

<!-- JS 阻塞解析，用 defer/async -->
<script defer src="app.js"></script>
<script async src="analytics.js"></script>
```

### 2. 重排（Reflow）vs 重绘（Repaint）

| 操作 | 触发 Reflow | 触发 Repaint | 只触发 Composite |
|------|-------------|--------------|------------------|
| 修改 width/height | ✅ | ✅ | |
| 修改 color | | ✅ | |
| 修改 transform | | | ✅ |
| 修改 opacity | | | ✅ |
| 读取 offsetHeight | ✅（强制同步布局） | | |

```js
// ❌ 强制同步布局（Layout Thrashing）
elements.forEach(el => {
  el.style.width = el.offsetWidth + 10 + 'px'; // 读 → 写 → 读 → 写
});

// ✅ 批量读，批量写
const widths = elements.map(el => el.offsetWidth);
elements.forEach((el, i) => {
  el.style.width = widths[i] + 10 + 'px';
});
```

### 3. 合成层优化

```css
/* 提升到合成层，避免重排 */
.animated {
  will-change: transform;
  transform: translateZ(0); /* 创建合成层 */
}

/* ⚠️ 不要滥用 will-change，用完要移除 */
```

**创建合成层的条件：**

- 3D transform
- will-change 声明
- video/canvas/iframe
- opacity 动画
- fixed/sticky 定位

## 事件循环深入

```
┌───────────────────────────┐
│         Call Stack        │
└─────────────┬─────────────┘
              │
┌─────────────▼─────────────┐
│      Microtask Queue      │  Promise.then, queueMicrotask
│      (清空后才执行宏任务)   │  MutationObserver
└─────────────┬─────────────┘
              │
┌─────────────▼─────────────┐
│       Macrotask Queue     │  setTimeout, setInterval, I/O
│       (每次取一个)          │  requestAnimationFrame
└───────────────────────────┘
```

```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
// 输出：1 → 4 → 3 → 2
```

### requestAnimationFrame vs setTimeout

- `rAF`：与浏览器刷新率同步（60fps = 16.6ms），在 Paint 前执行
- `setTimeout(fn, 16)`：不保证与刷新同步，可能丢帧

## 内存管理

### 常见内存泄漏

1. **闭包引用大对象**
2. **未清理的事件监听和定时器**
3. **Detached DOM**（JS 引用着已从 DOM 移除的节点）
4. **Console 中的对象引用**（DevTools 打开时）

### WeakMap / WeakRef

```js
// 用 WeakMap 关联 DOM 和数据，DOM 移除后自动 GC
const cache = new WeakMap();
function bindData(el, data) {
  cache.set(el, data);
}
```

## 性能指标关联

| 指标 | 渲染阶段 | 优化方向 |
|------|----------|----------|
| TTFB | 网络 + 服务端 | CDN、缓存、SSR |
| FCP | 首次 Paint | 关键 CSS 内联、字体优化 |
| LCP | 最大内容 Paint | 图片优化、preload、SSR |
| CLS | Layout 偏移 | 预留尺寸、font-display |
| INP | 事件处理 + 渲染 | 减少 JS 执行、Web Worker |

## 面试综合题

「用户反馈页面滚动卡顿，如何排查？」

排查路径：

1. Performance 面板录制 → 找 Long Task（> 50ms）
2. 检查是否有强制同步布局
3. 检查 scroll 事件是否未节流
4. 检查是否有大量 DOM 操作
5. 考虑 passive event listener + CSS contain + 虚拟滚动

---
title: "数据可视化选型：ECharts 与自研 Canvas"
description: "中后台图表选型决策树、ECharts 主题与性能、Canvas 自绘适用场景与混合架构。"
pubDate: 2026-07-14
category: "可视化"
tags: ["ECharts", "Canvas", "Data Visualization", "Chart"]
series: "可视化与图形编程"
seriesOrder: 2
draft: false
featured: false
cover: "/images/covers/data-visualization-echarts-canvas.svg"
---

> **前置阅读**：[Canvas 与 WebGL 渲染指南](/posts/canvas-webgl-rendering-guide) · **本专题第 2 篇**

中后台 80% 的「可视化需求」是折线、柱状、饼图、地图——**ECharts 足够**。自研 Canvas/WebGL 只在 **大数据量、定制交互、游戏级帧率** 时才值得。这篇是选型决策树，不是库 API 清单。

## 选型决策树

```
需要图表？
  ├─ 标准统计图 + 交互 tooltip → ECharts / AntV G2
  ├─ 与设计系统深度绑定的 React 组件 → Visx / Recharts
  ├─ 10万+ 点实时曲线 → Canvas / WebGL 自绘
  └─ 3D / 游戏 / 粒子 → WebGL / Three.js
```

## ECharts 工程实践

```tsx
const chart = echarts.init(containerRef.current, theme, { renderer: 'canvas' });
chart.setOption(option, { notMerge: true, lazyUpdate: true });
```

| 场景 | 建议 |
|------|------|
| 主题 | 抽 `echarts-theme.json`，与 CSS 变量对齐 |
| 响应式 | `ResizeObserver` + `chart.resize()` |
| 大数据 | `large: true`、`progressive`、`dataZoom` |
| SSR | 仅客户端 init，避免 hydration 不一致 |

**坑**：`setOption` 默认 merge，切换 tab 时旧 series 残留——切页用 `notMerge: true` 或 `clear()`。

## 何时自研 Canvas

- 定制 **非标准坐标系**（拓扑、力导向、编辑画布）
- **60fps** 动画且 ECharts 达不到
- 包体积敏感且只需一种简单 sparkline

自研成本：缩放、tooltip、legend、无障碍几乎都要自己补。团队至少留 **1 人周/季度** 维护。

## 混合架构

Dashboard 常见组合：

```
ECharts：经营指标卡片、趋势图
Canvas 层：地图热力 overlay
HTML：表格、筛选器
```

注意 **DPR**：`canvas.width = cssWidth * devicePixelRatio`，否则高清屏模糊（见 [Canvas 指南](/posts/canvas-webgl-rendering-guide)）。

## 性能对比（经验值）

| 数据量 | ECharts canvas | 自研 Canvas |
|--------|----------------|-------------|
| < 5k 点 | 流畅 | 过度工程 |
| 5k–50k | dataZoom + large | 可考虑 |
| > 50k | 需采样 | WebGL 点图 |

## 自测清单

- [ ] 能说明何时不应用 ECharts
- [ ] ECharts 切 tab 无 series 残留
- [ ] resize / dispose 无内存泄漏
- [ ] 知道 Canvas DPR 设置方式

---

**系列回顾**：[第 1 篇 · Canvas/WebGL](/posts/canvas-webgl-rendering-guide) · [可视化专题](/topics/visualization-graphics)

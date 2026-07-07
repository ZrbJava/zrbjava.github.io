---
title: "一次首屏性能优化的完整复盘"
description: "用指标拆解、瓶颈定位、方案实施和收益验证的方式，复盘一次首屏性能优化。"
pubDate: 2026-06-20
category: "性能优化"
tags: ["Performance", "Monitoring", "Web Vitals"]
series: "性能优化与可观测性"
draft: false
featured: false
---

性能优化最怕只凭体感。一次有效复盘应该从指标开始，而不是从工具开始。

## 指标定义

我会先明确要优化的是 LCP、INP、TTFB 还是业务自定义指标。不同指标背后的瓶颈完全不同。

## 定位方法

定位过程通常结合 Lighthouse、Performance 面板、线上 RUM 数据和资源瀑布图。实验环境只能说明可能性，线上数据才能说明真实影响。

## 收益验证

优化完成后要对比发布前后的 P75 指标，同时观察错误率和转化路径，避免为了局部指标牺牲业务体验。

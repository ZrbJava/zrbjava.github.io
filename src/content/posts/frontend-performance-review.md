---
title: "一次首屏性能优化的完整复盘"
description: "用指标拆解、瓶颈定位、方案实施和收益验证的方式，复盘一次首屏性能优化。"
pubDate: 2026-06-20
category: "性能优化"
tags: ["Performance", "Monitoring", "Web Vitals"]
series: "性能优化与可观测性"
draft: false
featured: false
cover: "/images/covers/frontend-performance-review.svg"
---

这是电商活动页 ` /campaign/summer2026` 的真实优化复盘。页面含轮播、商品 feed、优惠券弹层，技术栈 React 18 + Vite。**优化前生产环境 P75 LCP 4.2s、INP 380ms**；三轮迭代后 **P75 LCP 2.1s、INP 165ms**，活动页跳出率下降 12%。

## 基线：先定指标，再开 Chrome

| 指标 | 优化前 P75 | 目标 | 优化后 P75 |
|------|-----------|------|-----------|
| LCP | 4.2s | < 2.5s | 2.1s |
| INP | 380ms | < 200ms | 165ms |
| TTFB | 420ms | 保持 | 380ms |
| JS 体积（首屏） | 890KB | < 400KB | 310KB |
| 首屏请求数 | 47 | < 25 | 22 |

数据来源：自研 RUM（见 [前端监控体系](/posts/frontend-monitoring-system)）+ Lighthouse CI on PR。

**关键判断**：TTFB 正常说明瓶颈在**客户端渲染与资源加载**，不是后端。

## 瓶颈定位

### 1. LCP 元素与加载链

Chrome Performance + RUM 的 `lcpElement` 字段确认：**LCP 是首屏 hero 图**（1920×800 WebP，未 responsive）。

```
HTML 下载 (180ms)
  → 解析遇阻塞 CSS (120ms)
  → 发现 hero <img>，无 preload
  → 图片下载 1.8s（4G 模拟）
  → React hydrate 500ms（主线程长任务）
  → LCP 上报 4.2s
```

### 2. 主线程长任务

Performance 面板 Long Task > 50ms 有 **7 个**，最大 380ms。Call Tree 指向：

- 首屏 bundle 一次性 import 整个 `antd` + 图表库
- `useEffect` 里同步 `JSON.parse(localStorage)` 2MB 历史浏览记录

### 3. Layout Thrashing

商品列表首屏渲染 20 个卡片，每个 mount 时读 `offsetHeight` 算瀑布流，触发强制同步布局（见 [浏览器渲染流水线](/posts/browser-rendering-pipeline)）。

## 方案与实施

### Phase 1：LCP 资源（收益最大，1 天）

```html
<!-- index.html -->
<link
  rel="preload"
  as="image"
  href="/hero-800.webp"
  imagesrcset="/hero-400.webp 400w, /hero-800.webp 800w, /hero-1200.webp 1200w"
  imagesizes="100vw"
/>
```

```tsx
<img
  src="/hero-800.webp"
  srcSet="/hero-400.webp 400w, /hero-800.webp 800w"
  sizes="100vw"
  fetchPriority="high"
  decoding="async"
  alt="..."
/>
```

**结果**：LCP P75 4.2s → 2.8s（单这一项）。

### Phase 2：JS 拆分与延迟（3 天）

```tsx
// 路由级 lazy
const CampaignFeed = lazy(() => import('./CampaignFeed'));
const CouponModal = lazy(() => import('./CouponModal'));

// antd 按需 + 图表进 feed 视口再 load
const Chart = lazy(() => import('./SalesChart'));
```

```ts
// vite.config.ts — 手动 chunk
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],
        antd: ['antd'],
      },
    },
  },
},
```

localStorage 历史改为 **IndexedDB + requestIdleCallback** 异步 hydrate。

**结果**：首屏 JS 890KB → 520KB；LCP 2.8s → 2.3s。

### Phase 3：列表与 INP（2 天）

- 首屏只渲染 8 条，其余 `IntersectionObserver` 懒挂载
- 瀑布流改 CSS `grid` + `aspect-ratio`，去掉 mount 时读 layout
- 优惠券按钮加 `startTransition`，避免点击阻塞输入

**结果**：INP 380ms → 165ms；LCP 2.3s → 2.1s。

## 收益验证：不只看 Lighthouse

| 验证手段 | 结论 |
|----------|------|
| RUM 发布前后 7 天 P75 | LCP/INP 达标且稳定 |
| 错误率 | 无上升（排除「过度 lazy 导致白屏」） |
| 转化率 | 活动页加购率 +8%，跳出 -12% |
| 低端机抽样（Android 8） | LCP P75 2.9s，仍优于 4.2s |

**刻意没做的优化**：把 hero 改成 CSS 背景图——Lighthouse 分数会好看，但 SEO/无障碍更差，且 LCP 统计行为在不同浏览器不一致。

## 回归防护

```yaml
# lighthouse-ci 片段
assertions:
  largest-contentful-paint: ['error', { maxNumericValue: 2500 }]
  interactive: ['warn', { maxNumericValue: 3500 }]
```

每个 PR preview URL 自动跑；回退 > 300ms 标红。与 [CI 质量门禁](/posts/frontend-ci-quality-gates) 同一流水线。

## 复盘清单（可直接复用）

1. RUM 确认 LCP element 和 TTFB，区分网络 vs 客户端
2. Performance 面板找 Long Task 和 Layout Thrashing
3. 优先 **LCP 资源链**（preload、responsive、priority）
4. 再搞 **JS 体积与 hydrate 成本**
5. 最后 INP（交互、transition、虚拟列表）
6. 上线后看 7 天 P75 + 业务指标，不是只看实验室分数

性能优化最怕只凭体感。这次从 4.2s 到 2.1s，**80% 收益来自前两步**——定位对了，方案往往是常识；定位错了，上 Web Worker 也救不了 LCP。

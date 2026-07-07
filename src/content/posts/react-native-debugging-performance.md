---
title: "React Native 调试与性能治理"
description: "Flipper、Hermes、Systrace、列表优化、包体积与 New Architecture 下的性能排查路径。"
pubDate: 2026-07-12
category: "跨端开发"
tags: ["React Native", "Performance", "Hermes", "Debugging"]
series: "App 跨端开发"
seriesOrder: 2
draft: false
featured: false
cover: "/images/covers/react-native-debugging-performance.svg"
---

> **前置阅读**：[React Native 架构实践](/posts/react-native-architecture-practice) · **本专题第 2 篇**

RN 性能问题往往不在 JS 语法，而在 **Bridge 通信、列表重渲染、图片与启动路径**。这篇是线上 App 常用的排查顺序与治理手段。

## 性能排查顺序

```
用户反馈「卡」
  → 1. 是 JS 线程还是 UI 线程？（Perf Monitor）
  → 2. 是否列表滚动掉帧？（FlashList + memo）
  → 3. 是否启动慢？（Hermes + 拆包 + 预加载）
  → 4. 是否 Bridge 大包？（New Arch / 减序列化）
```

## 列表：头号杀手

```tsx
// ❌ ScrollView 塞 500 个复杂卡片
// ✅ FlashList + estimatedItemSize + keyExtractor
<FlashList
  data={items}
  estimatedItemSize={72}
  renderItem={renderRow}
  keyExtractor={(item) => item.id}
/>
```

行组件用 `React.memo`，props 避免内联 `{}` / `() =>`。`getItemType` 区分多模板可再省 20% 测量。

## Hermes 与启动

- 默认开 Hermes，字节码缩短 TTI
- **RAM bundle** / 按需加载非首屏模块
- 启动页：减少首屏 `useEffect` 同步请求链，改为 skeleton + 并行

## 图片与动画

- 大图走 CDN 裁剪；列表缩略图固定宽高防 layout thrash
- 动画优先 `useNativeDriver: true`；Layout 动画慎用
- Reanimated 3 在 New Architecture 下走 UI 线程，复杂手势可迁移

## 调试工具

| 工具 | 用途 |
|------|------|
| Flipper / RN DevTools | 网络、布局、日志 |
| Performance Monitor | JS/UI FPS |
| Systrace / Android Profiler | 原生侧瓶颈 |
| why-did-you-render | 开发环境重渲染 |

生产包关闭 LogBox、strip console；Source Map 上传 Sentry 做符号化。

## New Architecture 注意点

Fabric + TurboModule 减少异步桥接，但 **第三方库未适配** 时可能更慢。上线前对比：

- 冷启动 TTI
- 列表 scroll FPS（Systrace）
- 关键页面 Bridge call 次数（Profiling）

## 包体积

- 启用 Proguard / R8（Android）、Strip（iOS）
- 依赖审计：`npx react-native-bundle-visualizer`
- 图片资源 WebP；重复 native 模块合并

## 自测清单

- [ ] 长列表用虚拟化列表而非 ScrollView
- [ ] 能区分 JS 卡顿 vs UI 卡顿
- [ ] 生产包已关 debug、上传 source map
- [ ] 启动路径无串行阻塞请求

---

**系列回顾**：[第 1 篇 · RN 架构](/posts/react-native-architecture-practice) · [App 跨端专题](/topics/mobile-app)

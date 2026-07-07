---
title: "React Native 新架构与跨端性能实践"
description: "Fabric 渲染器、TurboModule、JSI 直连、Hermes 引擎与 RN 性能治理的系统化方法。"
pubDate: 2026-07-05
category: "跨端开发"
tags: ["React Native", "Fabric", "JSI", "Mobile App"]
series: "App 跨端开发"
seriesOrder: 1
draft: false
featured: false
cover: "/images/covers/react-native-architecture-practice.svg"
---

RN 0.73 项目开启 New Architecture 后，**冷启动 TTI 3.4s → 2.1s**，列表 scroll 掉帧明显减少。代价是 **2 个原生模块要重写 TurboModule Spec**，以及 FlashList 要按 Fabric 文档调 `estimatedItemSize`。这篇是我们在生产启用 Fabric 的步骤与踩坑。

## 新 vs 旧 Bridge

```
旧: JS ──JSON──▶ Native Module (异步)
新: JS ──JSI──▶ C++ TurboModule / Fabric (同步可批)
```

Fabric 统一布局与渲染；TurboModule 编译期生成类型安全接口。

## 启用步骤（0.73+）

```properties
# android/gradle.properties
newArchEnabled=true

# ios Podfile 同版本默认跟随 RCT_NEW_ARCH_ENABLED
```

```bash
cd ios && RCT_NEW_ARCH_ENABLED=1 pod install
```

常见 crash：

| 现象 | 原因 | 修复 |
|------|------|------|
| 红屏 `TurboModuleRegistry.getEnforcing` | 旧库未适配 | 升级或 patch |
| iOS Release 闪退 | Proguard / 错误 linking | 清 derivedData，查 autolinking |
| Android 白屏 | Hermes bytecode 不匹配 | `./gradlew clean` |

## 性能治理

| 场景 | 做法 | 我们数据 |
|------|------|----------|
| 启动 | Hermes + 延迟非关键 native init | TTI -1.3s |
| 列表 | `@shopify/flash-list` + 固定 `estimatedItemSize` | 55→58fps |
| 图片 | `react-native-fast-image` | 内存 -20% |
| 动画 | Reanimated 3 worklet | JS 线程空闲 |

```tsx
<FlashList
  data={items}
  estimatedItemSize={72}
  renderItem={({ item }) => <Row item={item} />}
/>
```

## TurboModule 片段（iOS）

```objc
// NativeLocalStorage.mm — Codegen 生成 Spec
@implementation NativeLocalStorage
- (NSString *)getItem:(NSString *)key {
  return [[NSUserDefaults standardUserDefaults] stringForKey:key];
}
RCT_EXPORT_MODULE(NativeLocalStorage)
@end
```

旧 `NativeModules.Xxx` 逐步迁移；未迁移前 **不要混用同步调用** 假设。

## RN vs Flutter（我们为什么留 RN）

团队 React 资产 + 原生模块多（蓝牙、打印）。Flutter 自绘一致性好，但 **重写成本 6 人月+**。新页面 RN，个别动画页考虑 Flutter module 嵌入——尚未落地。

## 热更新（CodePush 替代方案）

Microsoft CodePush 维护模式变化后，我们改用 **自建 OTA：签名 bundle + 差分**：

- 仅 JS bundle，不含 native 变更
- 强制版本号对齐 `nativeVersion >= x.y`
- 失败 rollback 上一 bundle

## 内存泄漏排查

- Xcode Instruments / Android Profiler
- 常见：未移除 `AppState` listener、闭包持有 `navigation`、FastImage 缓存无上限

```tsx
useEffect(() => {
  const sub = AppState.addEventListener('change', handler);
  return () => sub.remove();
}, []);
```

RN 新架构不是开关一开就完事：**Codegen 模块迁移、FlashList 配置、OTA 策略** 要一起规划。先在非核心页灰度 `newArchEnabled`，指标达标再全量。

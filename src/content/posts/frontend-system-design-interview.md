---
title: "前端系统设计面试题解"
description: "设计一个前端监控平台、微前端架构、低代码编辑器的前端系统设计思路与面试表达。"
pubDate: 2026-07-08
category: "面试指南"
tags: ["Interview", "System Design", "Architecture"]
series: "高级前端面试体系"
draft: false
featured: true
---

前端系统设计题是 P7+ 面试的区分度所在。面试官不是要你写代码，而是看**需求分析 → 架构拆分 → 技术选型 → 权衡取舍**的完整思维链。

## 系统设计答题框架

```
1. 需求澄清（5min）
   → 用户是谁？核心功能？规模？非功能需求？

2. 高层架构（5min）
   → 画架构图，说明模块划分

3. 核心模块深入（15min）
   → 选 2-3 个模块详细设计

4. 非功能需求（5min）
   → 性能、安全、可扩展性

5. 权衡与演进（5min）
   → 为什么这样选？未来怎么扩展？
```

## 题目一：设计前端监控平台

### 需求澄清

```
Q: 监控什么？
A: JS 错误、API 请求、性能指标（LCP/FCP/CLS/INP）、用户行为

Q: 规模？
A: 100+ 前端应用，日 PV 1000 万，SDK 体积 < 5KB

Q: 实时性？
A: 错误实时告警（< 1min），性能指标 T+5min 聚合
```

### 架构设计

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  SDK     │───▶│  采集网关  │───▶│  消息队列  │
│  (轻量)   │    │  (鉴权/限流)│    │  Kafka   │
└──────────┘    └──────────┘    └─────┬────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ 实时处理  │    │ 离线聚合  │    │ 告警引擎  │
              │ (错误)   │    │ (性能)   │    │ (规则)   │
              └─────┬────┘    └─────┬────┘    └─────┬────┘
                    └───────────────┼─────────────────┘
                                    ▼
                              ┌──────────┐
                              │  Dashboard│
                              │  (React)  │
                              └──────────┘
```

### SDK 设计要点

```ts
// 核心 SDK API
interface MonitorSDK {
  init(config: MonitorConfig): void;
  captureError(error: Error, context?: Record<string, unknown>): void;
  capturePerformance(entry: PerformanceEntry): void;
  captureEvent(name: string, properties?: Record<string, unknown>): void;
  setUser(userId: string, traits?: Record<string, unknown>): void;
}

// 设计原则
// 1. 异步上报，不阻塞业务
// 2. 采样率可配置（性能数据 10% 采样）
// 3. 离线队列（网络恢复后补发）
// 4. 错误去重（相同 stack 5min 内只报一次）
// 5. 体积 < 5KB gzip
```

### Dashboard 功能模块

1. **错误概览**：错误率趋势、Top 错误、影响用户数
2. **性能大盘**：Core Web Vitals P75 趋势
3. **应用列表**：100+ 应用的健康度排名
4. **告警配置**：规则引擎 + 通知渠道（钉钉/Slack/邮件）

## 题目二：设计微前端架构

### 需求澄清

```
Q: 为什么要微前端？
A: 5 个业务团队，技术栈不统一（React + Vue），独立发布

Q: 应用间如何通信？
A: 共享用户信息、权限、主题；偶尔需要跨应用跳转

Q: 部署方式？
A: 各团队独立 CI/CD，主应用统一入口
```

### 方案对比

| 方案 | 隔离性 | 技术栈 | 复杂度 | 推荐场景 |
|------|--------|--------|--------|----------|
| iframe | 完全 | 任意 | 低 | 旧系统接入 |
| Module Federation | JS 级 | 同构建工具 | 中 | Webpack 生态 |
| qiankun | JS 级 | 任意 | 中 | 国内主流 |
| Web Components | DOM 级 | 任意 | 高 | 长期方案 |
| Single-SPA | 路由级 | 任意 | 中 | 路由驱动 |

### 推荐架构（qiankun + Module Federation 混合）

```
┌─────────────────────────────────────┐
│           Shell App (React)         │
│  ┌──────┐ ┌──────┐ ┌──────────┐   │
│  │ 导航  │ │ 权限  │ │ 全局状态  │   │
│  └──────┘ └──────┘ └──────────┘   │
│  ┌─────────────────────────────┐   │
│  │     Micro App Container      │   │
│  │  ┌───────┐ ┌───────┐       │   │
│  │  │ App A │ │ App B │ ...   │   │
│  │  │ React │ │ Vue   │       │   │
│  │  └───────┘ └───────┘       │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 关键设计决策

1. **路由分发**：Shell 根据 URL 加载对应子应用
2. **样式隔离**：Shadow DOM 或 CSS Module + 前缀
3. **状态共享**：CustomEvent + 全局 Store（用户信息/主题）
4. **公共依赖**：React/Vue 通过 Module Federation shared 避免重复加载

## 题目三：设计低代码编辑器

### 核心模块

```
┌─────────────────────────────────────────┐
│              Editor Layout               │
│  ┌────────┐ ┌──────────┐ ┌───────────┐ │
│  │组件面板 │ │  画布     │ │ 属性面板   │ │
│  │Palette │ │ Canvas   │ │ Props     │ │
│  └────────┘ └──────────┘ └───────────┘ │
│  ┌─────────────────────────────────────┐│
│  │           大纲树 / 层级              ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### 数据模型

```ts
interface PageSchema {
  version: string;
  components: ComponentNode[];
  dataSources: DataSource[];
  actions: Action[];
}

interface ComponentNode {
  id: string;
  type: string;          // 'Button' | 'Table' | 'Form'
  props: Record<string, unknown>;
  children?: ComponentNode[];
  style?: CSSProperties;
  events?: Record<string, ActionRef>;
}
```

### 关键技术挑战

1. **拖拽系统**：react-dnd / dnd-kit，支持嵌套拖放
2. **Schema → React 渲染**：递归渲染器 + 组件注册表
3. **撤销/重做**：Command Pattern + 快照栈
4. **数据源绑定**：JSON Schema 驱动的表单 + API 绑定
5. **代码导出**：Schema → JSX 代码生成

## 面试评分维度

| 维度 | 权重 | 考察点 |
|------|------|--------|
| 需求分析 | 20% | 是否主动澄清，覆盖 edge case |
| 架构设计 | 30% | 模块划分合理，职责清晰 |
| 技术深度 | 25% | 核心模块有细节，不是空泛描述 |
| 权衡能力 | 15% | 能解释为什么选 A 不选 B |
| 沟通表达 | 10% | 逻辑清晰，能画架构图 |

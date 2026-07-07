---
title: "前端监控体系：错误、性能与用户行为"
description: "从错误采集、性能指标、用户行为和告警策略几个角度，搭建可用于排障的监控体系。"
pubDate: 2026-06-02
category: "工程化"
tags: ["Monitoring", "Engineering", "Observability"]
series: "性能优化与可观测性"
draft: false
featured: false
cover: "/images/covers/frontend-monitoring-system.svg"
---

监控的价值不是「有个 Dashboard」，而是**把 MTTR（平均修复时间）从小时压到分钟**。我们接入统一 RUM 后，线上 JS 错误从「用户投诉才知道」变成 **P95 告警 3 分钟内触达值班**；配合版本号和用户路径，约 70% 的 P0 能在 15 分钟内定位到具体 PR。

## 整体架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  轻量 SDK    │────▶│  采集网关     │────▶│  Kafka/队列  │
│  (<5KB gzip)│     │  鉴权·采样·限流 │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
         ┌─────────────────────────────────────┼──────────────────┐
         ▼                     ▼                 ▼                  ▼
   ┌───────────┐        ┌───────────┐    ┌───────────┐      ┌───────────┐
   │ 错误实时流  │        │ 性能聚合   │    │ 行为漏斗   │      │ 告警引擎   │
   │ (Sentry式) │        │ (T+5min)  │    │ (离线)    │      │ PagerDuty │
   └─────┬─────┘        └─────┬─────┘    └─────┬─────┘      └─────┬─────┘
         └────────────────────┴───────────────┴──────────────────┘
                                    ▼
                            ┌───────────────┐
                            │  排障 Dashboard │
                            └───────────────┘
```

与 [前端系统设计面试](/posts/frontend-system-design-interview) 里监控题的设计一致，下面展开**落地细节**。

## SDK 设计：采什么、怎么采

### 错误采集

```ts
// packages/monitor/src/error.ts
export function initErrorCapture(ctx: MonitorContext) {
  window.addEventListener('error', (e) => {
    ctx.report({
      type: 'js_error',
      message: e.message,
      stack: e.error?.stack,
      filename: e.filename,
      lineno: e.lineno,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    ctx.report({
      type: 'promise_rejection',
      message: String(e.reason),
      stack: e.reason?.stack,
    });
  });
}
```

**必须带的上下文**（否则排障等于盲人摸象）：

| 字段 | 用途 |
|------|------|
| `release` / `commit` | 对应哪次发布 |
| `env` | prod / staging |
| `userId`（哈希） | 复现用户路径 |
| `route` | 哪个页面 |
| `breadcrumbs` | 错误前 20 条用户操作 |

Breadcrumb 示例：点击、路由跳转、API 请求（脱敏 URL + status）。

### 性能指标（Web Vitals + 自定义）

```ts
import { onLCP, onINP, onCLS } from 'web-vitals';

function reportMetric(name: string, value: number, rating: string) {
  monitor.report({
    type: 'performance',
    name,
    value,
    rating,
    navigationType: performance.getEntriesByType('navigation')[0]?.type,
  });
}

onLCP((m) => reportMetric('LCP', m.value, m.rating));
onINP((m) => reportMetric('INP', m.value, m.rating));
onCLS((m) => reportMetric('CLS', m.value, m.rating));
```

自定义业务指标示例：`checkout_duration`（从点击结算到支付成功），比 LCP 更贴近转化。

### 采样与体积控制

1000 万 PV/日如果全量上报，成本和存储都扛不住：

```ts
const config = {
  errorSampleRate: 1.0,      // 错误全采
  performanceSampleRate: 0.1, // 性能 10%
  eventSampleRate: 0.05,       // 普通埋点 5%
  maxBreadcrumbs: 20,
  flushInterval: 5000,         // 批量上报，减少请求数
};
```

**不要用** `navigator.sendBeacon` 传超大 payload——单条事件建议 < 16KB，超限拆分或截断 stack。

## 告警策略：什么该叫醒人

| 规则 | 条件 | 动作 |
|------|------|------|
| 新错误类型 | 1h 内首次出现且 > 50 次 | Slack + 工单 |
| 错误率突增 | 5min 错误率 > 基线 3σ | 电话 on-call |
| LCP 退化 | 发布后 P75 LCP +500ms 持续 30min | 阻塞后续发布 |
| API 5xx 关联 | 某接口 5xx > 1% 且前端错误同步涨 | 联动后端告警 |

告警要**可行动**：「错误多了」没用，「`TypeError: Cannot read x of undefined` 在 `/checkout` 自 `v2.14.0` 新增，影响 1.2% 会话」才有用。

## 排障工作流（我们实际用的）

1. **告警 → 按 release 聚合** — 是否刚发布？是则优先考虑回滚
2. **看 breadcrumb** — 用户做了什么触发的
3. **Session replay**（如有）— 复现 UI 状态
4. **对照 Source Map** — 生产 stack 映射到源码行
5. **修复 → Canary → 观察 24h P75**

案例：某次 LCP 从 2.1s 涨到 3.8s，RUM 显示 **TTFB 正常、LCP element 变成 hero 图**。Performance 面板 + 资源瀑布发现新 CDN 未开 HTTP/2 push，换回原 CDN 后 P75 回到 2.0s。完整复盘见 [首屏性能优化](/posts/frontend-performance-review)。

## 与 CI / Code Review 的衔接

- 每个 PR 的 preview 环境跑 Lighthouse CI，LCP 回退 > 200ms 标黄
- 合并 main 后自动打 `release` tag，SDK 读 `import.meta.env.VITE_RELEASE`
- Review 清单要求：新核心路径是否加 breadcrumb（见 [Code Review 实践](/posts/code-review-practice)）

## 我们踩过的坑

1. **只采 error 不采 unhandledrejection** — 大量 async 错误漏报
2. **PII 打进事件** — 手机号、token 进日志，合规翻车；现在 SDK 层做 key 黑名单 + 正则脱敏
3. **Dashboard 没人看** — 告警阈值太松，变成噪音；收紧后 on-call 投诉「太灵敏」，最终按业务分 **SLO 分级**
4. **Source Map 上传到公网** — 源码泄露；改为私有化存储 + 鉴权下载

## 选型参考（2026）

| 方案 | 适合 | 注意 |
|------|------|------|
| Sentry + 自建 Kafka | 中大型，要深度定制 | 自运维成本 |
| Datadog RUM | 全栈统一 | 按 session 计费 |
| 自研 SDK + ClickHouse | 超大规模、成本敏感 | 要专职 1–2 人维护 |

**结论**：监控体系 = 轻量 SDK + 富上下文 + 合理采样 + 可行动告警 + 与发布链路绑定。缺任何一环，Dashboard 都只是摆设。

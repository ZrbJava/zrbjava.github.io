---
title: "BFF 容错、超时与降级设计"
description: "Promise.allSettled 聚合、熔断、超时链、错误码规范与 partial response 的前端协作模式。"
pubDate: 2026-07-09
category: "后端开发"
tags: ["Node.js", "BFF", "Resilience", "Architecture"]
series: "Node.js 与 BFF"
seriesOrder: 2
draft: false
featured: false
cover: "/images/covers/nodejs-bff-error-resilience.svg"
---

> **前置阅读**：[BFF 层架构设计](/posts/nodejs-bff-layer-design) · **本专题第 2 篇**

BFF 聚合 3 个下游时，**任意一个超时不能拖垮整页**。这篇讲我们在 Node BFF 里用的超时、降级与错误契约——前端能据此做 skeleton / 局部重试，而不是白屏。

## 错误分层

```
客户端
  ↓ 4xx/5xx + { code, message, traceId }
BFF
  ↓ 下游超时 / 熔断 / 业务错误
微服务 A / B / C
```

| 层级 | 谁处理 | 前端表现 |
|------|--------|----------|
| 下游不可用 | BFF 降级 | 模块占位 + 「部分数据加载失败」 |
| 鉴权失败 | BFF 401 | 跳登录 |
| 参数错误 | BFF 400 | 表单 inline 错误 |
| 未知异常 | BFF 500 + traceId | 全局 toast + 反馈入口 |

**原则**：BFF 对外只暴露 **一种 JSON 形态**，不要把下游原始 stack 透传给浏览器。

## 超时链

```ts
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${label}:${ms}`)), ms),
    ),
  ]);
}
```

聚合接口建议：**单下游 2s、整接口 3s**。整接口用 `AbortController` 在超时后 cancel 未完成的 fetch，避免僵尸请求占连接。

```ts
const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), 3000);
try {
  const data = await fetchDashboard(userId, { signal: ac.signal });
  ctx.body = { code: 0, data };
} finally {
  clearTimeout(timer);
}
```

## partial response 契约

```json
{
  "code": 0,
  "data": {
    "user": { "name": "..." },
    "stats": null,
    "notices": []
  },
  "partial": true,
  "errors": [
    { "module": "stats", "code": "DOWNSTREAM_TIMEOUT" }
  ],
  "traceId": "tr_abc123"
}
```

前端约定：

```tsx
if (data.partial) {
  showBanner('部分模块加载失败，可点击重试');
}
if (data.errors?.some((e) => e.module === 'stats')) {
  setStatsState('error');
}
```

**不要** partial 时还当 success 全量渲染——用户会以为 stats 真的是空的。

## 熔断与重试

下游连续失败时，BFF 侧短路（circuit breaker），直接返回缓存或空数据，保护线程池。

| 策略 | 适用 | 注意 |
|------|------|------|
| 快速失败 | 读多写少 Dashboard | 需缓存兜底 |
| 有限重试 | 幂等 GET | 最多 2 次，指数退避 |
| 不重试 | POST 支付 | 交给业务层 idempotency key |

重试只在 **BFF → 下游** 做，不要让浏览器对 BFF 自动重试 POST。

## 日志与 trace

每个请求生成 `traceId`，贯穿 BFF 日志与下游 `X-Request-Id`。前端报错时把 traceId 带给客服/监控。

```ts
ctx.set('X-Trace-Id', traceId);
logger.info({ traceId, userId, path: ctx.path, partial: body.partial });
```

## 常见坑

1. **Promise.all 聚合** — 一个 reject 全挂；用 `allSettled` + unwrap
2. **超时只设客户端** — 服务端无 timeout，连接池耗尽
3. **错误码每家一套** — 前端 if/else 爆炸；BFF 统一 `code` 枚举
4. **partial 不告知前端** — 静默丢模块，难以排查

## 自测清单

- [ ] 能画出 BFF 错误分层与前端对应 UI
- [ ] 聚合接口有整链路超时 + partial 字段
- [ ] 401/403/500 各有明确前端策略
- [ ] traceId 可从用户反馈定位到日志

---

**系列回顾**：[第 1 篇 · BFF 架构](/posts/nodejs-bff-layer-design) · [Node.js 与 BFF 专题](/topics/nodejs-bff)

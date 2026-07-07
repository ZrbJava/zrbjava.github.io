---
title: "BFF 层架构设计：从前端视角掌控 API"
description: "BFF 在微服务中的定位、Koa 中间件模型、API 聚合、鉴权与 Node 服务工程化实践。"
pubDate: 2026-07-05
category: "后端开发"
tags: ["Node.js", "BFF", "Koa", "Architecture"]
series: "Node.js 与 BFF"
seriesOrder: 1
draft: false
featured: false
cover: "/images/covers/nodejs-bff-layer-design.svg"
---

Dashboard 页需要 user + 统计 + 公告三个微服务，直连时前端 **3 个 RTT + 3 套错误格式**，移动端弱网首屏 2.8s。加 BFF 聚合后 **1 个 RTT、统一 `{ code, data }`**，P75 1.1s。BFF 不是「前端写后端」，而是 **按 UI 形态裁剪 API**。

## 架构位置

```
Web / App / 小程序
        ↓
   BFF (Node/Koa)  ← 聚合、裁剪、鉴权、缓存
        ↓
   用户 / 订单 / 商品 微服务
```

与 **API Gateway** 分工：Gateway 管 TLS、限流、路由；BFF 管 **页面级聚合**。不要重复鉴权逻辑两处各写一套。

## 聚合接口示例

```ts
router.get('/api/v1/dashboard', auth, async (ctx) => {
  const userId = ctx.state.userId;
  const results = await Promise.allSettled([
    withTimeout(userService.profile(userId), 2000),
    withTimeout(statsService.summary(userId), 2000),
    withTimeout(noticeService.latest(5), 2000),
  ]);

  ctx.body = {
    code: 0,
    data: {
      user: unwrap(results[0], null),
      stats: unwrap(results[1], { empty: true }),
      notices: unwrap(results[2], []),
    },
    partial: results.some((r) => r.status === 'rejected'),
  };
});
```

`partial: true` 时前端展示降级 UI，比 500 整页错误体验好。

## 超时、熔断与缓存

```ts
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(orderService.getDetail, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

breaker.fallback(() => ({ degraded: true }));

// 短 TTL 缓存 — 公告类
const cache = new Map<string, { exp: number; data: unknown }>();
async function cachedNotices(key: string, fn: () => Promise<unknown>) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;
  const data = await fn();
  cache.set(key, { data, exp: Date.now() + 60_000 });
  return data;
}
```

## 鉴权与权限

```ts
async function auth(ctx: Context, next: Next) {
  const token = ctx.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw httpError(401);
  const payload = await verifyJwt(token);
  ctx.state.userId = payload.sub;
  ctx.state.permissions = payload.permissions; // 供下游裁剪
  await next();
}
```

字段裁剪示例：App 端 `GET /profile` 不返回 `internalNotes`；Web 端返回。BFF 层 `pick(user, FIELDS_BY_CLIENT[ctx.state.client])`。

## GraphQL BFF vs REST BFF

| | REST BFF | GraphQL |
|---|----------|---------|
| 按页聚合 | 天然匹配 | 需 schema 治理 |
| 缓存 | HTTP/CDN 友好 | 复杂 |
| 团队学习成本 | 低 | 高 |
| 我们选型 | **REST BFF** | 仅 Admin 探索 |

Rejected GraphQL：移动端场景固定，REST 一页一接口更清晰；GraphQL N+1 要 DataLoader，运维成本高。

## 工程化

```ts
// 结构化日志 + trace id
app.use(async (ctx, next) => {
  const traceId = ctx.get('x-trace-id') || randomUUID();
  ctx.state.traceId = traceId;
  const start = Date.now();
  await next();
  logger.info({ traceId, path: ctx.path, ms: Date.now() - start, status: ctx.status });
});
```

- 部署：Docker + K8s，HPA 按 CPU
- 监控：P95 latency、下游失败率、熔断 open 次数
- 与 [CI 门禁](/posts/frontend-ci-quality-gates) 一致：BFF repo 同样 typecheck + contract test

## 小程序 / App 专用 BFF

同一域不同 **client header**：

```ts
const client = ctx.get('x-client'); // web | ios | android | weapp
const fields = FIELD_MATRIX[client] ?? FIELD_MATRIX.web;
```

小程序包体积敏感，列表接口字段比 Web 少 40%。

BFF 的成功标准是 **前端不再为拼接口写 200 行 useEffect**。聚合、降级、裁剪在一层做完，微服务保持领域纯粹。

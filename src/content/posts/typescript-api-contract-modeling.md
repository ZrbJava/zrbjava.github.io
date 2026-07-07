---
title: "TypeScript 契约类型与 API 建模"
description: "zod/io-ts 运行时校验、OpenAPI 生成类型、satisfies 与前后端契约同步策略。"
pubDate: 2026-07-13
category: "TypeScript"
tags: ["TypeScript", "Zod", "API", "Contract"]
series: "TypeScript 高级实践"
seriesOrder: 2
draft: false
featured: false
cover: "/images/covers/typescript-api-contract-modeling.svg"
---

> **前置阅读**：[TypeScript 高级类型模式](/posts/typescript-advanced-type-patterns) · **本专题第 2 篇**

编译通过 ≠ 运行时正确。接口字段改名、枚举扩值、null 变 optional——**类型只在 build 时存在**。契约类型的目标：让 API 变更在 **边界处失败**，而不是在业务深处 `undefined is not a function`。

## 三层防御

```
OpenAPI / Protobuf（源）
  → 生成 TS 类型（compile time）
  → zod parse 响应（runtime）
  → UI 组件 props（narrowed type）
```

## zod 边界 parse

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'member', 'guest']),
  avatar: z.string().url().optional(),
});

type User = z.infer<typeof UserSchema>;

async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  const json = await res.json();
  return UserSchema.parse(json.data);
}
```

`parse` 失败抛 `ZodError`，BFF 或前端统一 catch 上报，比 silent wrong shape 好查。

## satisfies 固定字面量

```ts
const routes = {
  home: '/',
  dashboard: '/app',
} as const satisfies Record<string, `/${string}`>;
```

`satisfies` 保留窄类型又做校验，比 `as const` + 手写类型更少漂移。

## 与 OpenAPI 同步

| 方式 | 优点 | 缺点 |
|------|------|------|
| openapi-typescript | 零运行时 | 无 runtime guard |
| orval + zod | 类型 + client | 生成代码需 CI |
| 手写 zod 为源 | 灵活 | 与后端文档双维护 |

推荐：**后端 OpenAPI 为 single source**，CI 里 `openapi-typescript` 生成 types，关键路径手写 zod `.safeParse` 做 spot check。

## 枚举与 discriminated union

API 返回联合类型时用 **discriminator**：

```ts
const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), target: z.string() }),
  z.object({ type: z.literal('pageview'), path: z.string() }),
]);
```

前端 switch `event.type` 时 TS 自动收窄。

## 常见坑

1. **双重断言 `as User`** — 跳过校验，假安全
2. **可选字段泛滥** — 其实是 breaking change 没对齐
3. **Date 当 string** — JSON 无 Date；zod `coerce.date()` 或 ISO string
4. **泛型 API `ApiResponse<T>` 不约束 T** — 每个 endpoint 单独 schema

## 自测清单

- [ ] 至少一个 API 边界有 runtime parse
- [ ] 能解释 compile-time vs runtime 类型差异
- [ ] 联合响应用 discriminatedUnion 建模
- [ ] CI 能检测 OpenAPI 变更

---

**系列回顾**：[第 1 篇 · 高级类型](/posts/typescript-advanced-type-patterns) · [TypeScript 专题](/topics/typescript-advanced)

---
title: "TypeScript 高级类型模式与 API 设计"
description: "泛型约束、条件类型、映射类型、模板字面量类型在 API 设计中的实战应用。"
pubDate: 2026-06-18
category: "TypeScript"
tags: ["TypeScript", "Generics", "Conditional Types"]
series: "TypeScript 高级实践"
draft: false
featured: true
---

TypeScript 高级类型是区分「会用 TS」和「用 TS 做架构约束」的分水岭。高级前端面试中，类型体操不是目的，而是**用类型系统表达业务约束**。

## 泛型约束：精确表达 API 契约

```ts
// 基础约束
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// 多参数约束
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}
```

## 条件类型：类型的 if/else

```ts
// 基础条件类型
type IsString<T> = T extends string ? true : false;

// 分布式条件类型（面试高频）
type ToArray<T> = T extends any ? T[] : never;
type Result = ToArray<string | number>;
// → string[] | number[]（不是 (string | number)[]）
```

### infer 关键字：类型层面的模式匹配

```ts
// 提取函数返回类型
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// 提取 Promise 内部类型
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

// 提取数组元素类型
type ElementType<T> = T extends (infer U)[] ? U : never;
```

## 映射类型：批量变换

```ts
// 所有属性变可选
type Partial<T> = { [K in keyof T]?: T[K] };

// 所有属性变只读
type Readonly<T> = { [K in keyof T]: Readonly<T[K]> };

// 自定义映射：所有属性变 nullable
type Nullable<T> = { [K in keyof T]: T[K] | null };

// 键名变换
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
// { name: string } → { getName: () => string }
```

## 模板字面量类型

```ts
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";
type APIPath = `/api/${string}`;

type RouteConfig<M extends HTTPMethod, P extends APIPath> = {
  method: M;
  path: P;
  handler: (req: Request) => Response;
};

// 事件名类型安全
type EventMap = {
  "user:login": { userId: string };
  "user:logout": { userId: string };
  "order:created": { orderId: string };
};

type EventName = keyof EventMap;
type EventPayload<E extends EventName> = EventMap[E];

function emit<E extends EventName>(event: E, payload: EventPayload<E>) {
  // payload 类型自动匹配 event
}
```

## 实战：类型安全的路由参数

```ts
type RouteParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof RouteParams<Rest>]: string }
    : T extends `${infer _Start}:${infer Param}`
      ? { [K in Param]: string }
      : {};

type UserRoute = RouteParams<"/users/:userId/posts/:postId">;
// { userId: string; postId: string }
```

## 实战：API 响应类型推导

```ts
type ApiEndpoints = {
  "GET /users": { response: User[] };
  "GET /users/:id": { response: User };
  "POST /users": { body: CreateUserDto; response: User };
};

type ApiResponse<E extends keyof ApiEndpoints> = ApiEndpoints[E]["response"];

async function apiCall<E extends keyof ApiEndpoints>(
  endpoint: E,
  ...args: ApiEndpoints[E] extends { body: infer B } ? [B] : []
): Promise<ApiResponse<E>> {
  // 实现...
}

const users = await apiCall("GET /users"); // User[]
const user = await apiCall("POST /users", dto); // User
```

## 类型体操的边界

**该用的时候用：**

- API 客户端类型推导
- 表单字段与校验规则的类型关联
- 事件系统的类型安全
- 配置对象的约束

**不该用的时候别用：**

- 为了炫技写 10 层嵌套条件类型
- 团队其他人看不懂的类型抽象
- 可以用 Zod/Yup 运行时校验的场景

## 面试策略

遇到类型题，用「三层回答法」：

1. **概念层**：解释这个类型模式解决什么问题
2. **实现层**：写出核心类型定义
3. **应用层**：举一个项目中的实际使用场景

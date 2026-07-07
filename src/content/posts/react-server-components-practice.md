---
title: "React Server Components 实战指南"
description: "RSC 的渲染模型、Server/Client 组件边界、数据获取模式与 Next.js App Router 落地经验。"
pubDate: 2026-07-02
category: "React"
tags: ["React", "RSC", "Next.js", "SSR"]
series: "React 工程实践"
seriesOrder: 3
draft: false
featured: false
cover: "/images/covers/react-server-components-practice.svg"
---

React Server Components（RSC）是 React 18+ 最重要的架构变革之一。它不是在 SSR 基础上加功能，而是重新定义了**组件在哪里运行、数据在哪里获取、Bundle 里包含什么**。

## 核心概念：组件运行时的分离

| 类型             | 运行环境 | 能否用 useState | 能否访问 DB | 是否进入客户端 Bundle |
| ---------------- | -------- | --------------- | ----------- | --------------------- |
| Server Component | 服务端   | 否              | 是          | 否                    |
| Client Component | 浏览器   | 是              | 否          | 是                    |

```tsx
// app/posts/page.tsx — Server Component（默认）
import { db } from "@/lib/db";

export default async function PostsPage() {
  const posts = await db.post.findMany(); // 直接访问数据库
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

```tsx
// components/LikeButton.tsx — Client Component
"use client";

import { useState } from "react";

export function LikeButton({ postId }: { postId: string }) {
  const [liked, setLiked] = useState(false);
  return (
    <button onClick={() => setLiked(!liked)}>{liked ? "已赞" : "点赞"}</button>
  );
}
```

## 数据获取模式的演进

```
Pages Router:  getServerSideProps → 组件渲染
App Router:    Server Component 直接 async/await → 流式渲染
Client:        SWR/React Query → 客户端缓存
```

RSC 的优势：

- **零客户端 JS**：Server Component 的代码不会打包到浏览器
- **无瀑布请求**：组件树中并行 fetch，而非 useEffect 链式依赖
- **天然安全**：API Key、数据库连接不会泄露到客户端

## Server/Client 边界设计原则

1. **默认 Server Component**，只在需要交互时加 `'use client'`
2. Client Component 不能 import Server Component，但可以接收 Server Component 作为 children
3. 把 `'use client'` 推到叶子节点，最大化 Server 渲染范围

```tsx
// 正确：Client 组件包裹 Server 组件的 children
"use client";
export function Modal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return open ? <dialog>{children}</dialog> : null;
}

// page.tsx (Server)
<Modal>
  <ServerOnlyContent /> {/* 作为 children 传入，不违反边界 */}
</Modal>;
```

## Streaming 与 Suspense

RSC 配合 Suspense 实现流式 HTML：

```tsx
export default function DashboardPage() {
  return (
    <div>
      <Header /> {/* 立即发送 */}
      <Suspense fallback={<ChartSkeleton />}>
        <SlowChart /> {/* 异步加载，不阻塞 Header */}
      </Suspense>
    </div>
  );
}
```

浏览器会逐步收到 HTML 片段，用户感知的首屏时间大幅缩短。

## 常见陷阱

- 在 Server Component 中使用 `useEffect` / `useState` → 编译报错
- 在 Server Component 中传递非序列化 props（函数、Date 对象）→ 运行时错误
- 过度使用 `'use client'`，导致整个子树变成客户端组件 → 失去 RSC 优势

## 与 Vue/Nuxt 的对比视角

| 维度        | React RSC              | Vue SSR (Nuxt)          |
| ----------- | ---------------------- | ----------------------- |
| 组件粒度    | Server/Client 显式标记 | 统一 SSR + hydration    |
| 数据获取    | 组件内 async           | useAsyncData / useFetch |
| Bundle 优化 | 服务端组件零 JS        | 全量 hydration          |
| 生态成熟度  | Next.js 15+ 较成熟     | Nuxt 3 稳定             |

## Streaming 与错误边界

RSC + Suspense 流式输出时，**错误不能等整页失败**：

```tsx
// app/dashboard/error.tsx
'use client';
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert">
      <p>模块加载失败：{error.message}</p>
      <button onClick={reset}>重试</button>
    </div>
  );
}
```

Server Component throw 会冒泡到最近 `error.tsx`；**部分模块失败**时用 Parallel Routes + 独立 error slot，别拖垮整页。

## Partial Prerender（Next 15+）

静态 shell 先出，动态块 Suspense 边界内流式填充——营销页 LCP 我们 **2.4s → 1.6s**，动态推荐区晚 200ms 到达可接受。

## 生产指标（文档站迁移）

- Client JS bundle：-38%（Server 组件零 JS）
- 首屏 HTML TTFB + 流式：用户 1s 内看到导航与标题
- **Rejected**：整页 `'use client'` 包一层——等于放弃 RSC

RSC 落地关键：**划清 Server/Client 边界 + Suspense 粒度 + error 隔离**，不是给每个文件加 async 那么简单。

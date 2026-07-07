---
title: "AI SDK 前端集成与流式响应实践"
description: "Vercel AI SDK、OpenAI API 流式调用、SSE 处理和 AI 聊天界面的前端架构设计。"
pubDate: 2026-07-04
category: "AI 工程"
tags: ["AI", "LLM", "Streaming", "AI SDK"]
series: "AI 应用开发体系"
draft: false
featured: true
aiLevel: "入门"
aiOrder: 2
cover: "/images/covers/ai-sdk-streaming-integration.svg"
---

> **前置阅读**：[前端 AI 应用入门](/posts/ai-frontend-getting-started) · **体系第 2 篇**

2024–2026 年，前端工程师最重要的新技能之一是**将 LLM 集成到产品中**。这不是调 API 那么简单，而是涉及流式渲染、错误回退、Token 管理和用户体验设计。

## AI 前端架构全景

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Chat UI    │────▶│  API Route   │────▶│  LLM Provider│
│  (React)    │◀────│  (Server)    │◀────│  OpenAI/等   │
│  流式渲染    │ SSE │  流式转发     │ SSE │             │
└─────────────┘     └──────────────┘     └─────────────┘
```

**核心原则：API Key 永远不暴露到客户端。**

## Vercel AI SDK 快速集成

```tsx
// app/api/chat/route.ts — Server Route
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    system: "你是一个前端技术助手。",
  });
  return result.toDataStreamResponse();
}
```

```tsx
// components/Chat.tsx — Client Component
"use client";
import { useChat } from "ai/react";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
    });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id} className={m.role}>
          {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
```

## 流式响应的底层原理

```
Client                    Server                   LLM
  │── POST /api/chat ──▶│                          │
  │                      │── stream request ──────▶│
  │                      │◀── chunk 1 ────────────│
  │◀── SSE: data chunk ──│                          │
  │                      │◀── chunk 2 ────────────│
  │◀── SSE: data chunk ──│                          │
  │                      │◀── [DONE] ──────────────│
  │◀── SSE: [DONE] ─────│                          │
```

SSE（Server-Sent Events）格式：

```
data: {"text": "你好"}\n\n
data: {"text": "，我是"}\n\n
data: [DONE]\n\n
```

## 流式 Markdown 渲染

AI 输出 Markdown 时，流式渲染的挑战是**不完整的 Markdown 语法**：

```tsx
function StreamingMarkdown({ content }: { content: string }) {
  // 策略 1：逐字追加，最后统一渲染
  const [displayContent, setDisplayContent] = useState("");

  useEffect(() => {
    // 防抖：每 50ms 更新一次渲染，避免频繁 re-render
    const timer = setTimeout(() => setDisplayContent(content), 50);
    return () => clearTimeout(timer);
  }, [content]);

  return <MarkdownRenderer content={displayContent} />;
}
```

## 错误处理与回退

```tsx
const { messages, error, reload, stop } = useChat({
  api: "/api/chat",
  onError: (err) => {
    if (err.message.includes("rate_limit")) {
      toast.error("请求过于频繁，请稍后再试");
    } else if (err.message.includes("context_length")) {
      toast.error("对话过长，请开启新对话");
    }
  },
});
```

**必须设计的回退场景：**

1. API 超时 → 显示重试按钮
2. Rate Limit → 排队提示
3. 内容审核拦截 → 友好提示
4. 网络断开 → 保留已生成内容 + 重连

## Token 管理与成本控制

```ts
// Server 端 Token 计数
import { encode } from "gpt-tokenizer";

function trimMessages(messages: Message[], maxTokens: number) {
  let total = 0;
  const trimmed = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = encode(messages[i].content).length;
    if (total + tokens > maxTokens) break;
    trimmed.unshift(messages[i]);
    total += tokens;
  }
  return trimmed;
}
```

## Abort、Retry 与成本监控

```tsx
// 客户端 — useChat 包一层 AbortController
const abortRef = useRef<AbortController | null>(null);

async function send(text: string) {
  abortRef.current?.abort();
  abortRef.current = new AbortController();
  await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
    signal: abortRef.current.signal,
  });
}

function handleStop() {
  abortRef.current?.abort();
  stop(); // AI SDK 的 stop()
}
```

服务端记录 `prompt_tokens` / `completion_tokens` 进日志，**按 userId 日限额**；超限时返回 429 + 升级提示。

Retry：仅对 502/503 指数退避 2 次，**不对 429 重试**（会雪上加霜）。

## 多模态与 Markdown 安全

图片消息走 CDN URL，不 base64 进 prompt。流式 Markdown 用 `rehype-sanitize` 白名单标签，防模型输出 `<script>`。

上线后：**流式首 token P95 900ms**；Abort 使用率 12%（长回答用户主动停）；Token 成本/account 可账单对账。

## 自测清单

- [ ] `useChat` 能流式渲染 Markdown，且支持 Abort
- [ ] API Key 只在服务端，Network 面板搜不到 `sk-`
- [ ] 429/503 有明确错误 UI，不对 429 自动重试
- [ ] 流式 Markdown 经 sanitize，无 XSS 风险
- [ ] 能解释 SSE 与 WebSocket 在本场景的取舍

全部打勾 → 进入 **[第 3 篇：RAG 前端架构](/posts/llm-rag-frontend-architecture)**。

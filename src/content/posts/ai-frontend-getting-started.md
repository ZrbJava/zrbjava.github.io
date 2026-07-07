---
title: "前端 AI 应用入门：普通开发者第一条链路"
description: "从零理解 LLM、Token 与 Chat 接口，用 React + Route 跑通第一个流式对话，并建立后续 RAG/Agent 的知识地图。"
pubDate: 2026-07-03
category: "AI 工程"
tags: ["AI", "LLM", "入门", "React"]
series: "AI 应用开发体系"
draft: false
featured: true
aiLevel: "入门"
aiOrder: 1
cover: "/images/covers/ai-frontend-getting-started.svg"
---

如果你会 React、写过 API 请求，但还没碰过大模型——这篇是 **AI 应用开发体系第 1 篇**。目标不是背概念，而是建立一张地图：**前端在 AI 产品里干什么、第一条链路怎么跑通、后面还要学什么**。

## 学完本篇你应该能

- [ ] 说清用户输入如何变成屏幕上的流式文字
- [ ] 知道 Token、上下文窗口、温度是什么意思
- [ ] 在本地跑通「React Chat + 服务端 Route + OpenAI 兼容 API」
- [ ] 理解为什么 **API Key 不能放浏览器**
- [ ] 知道下一步该读 [AI SDK 流式集成](/posts/ai-sdk-streaming-integration)

## 0. 先建立全景图

```
用户输入
  → 前端 Chat UI（React）
  → 你的服务端 Route（Node / Next / BFF）  ← API Key 只在这里
  → 大模型 API（OpenAI / DeepSeek / 通义 等）
  → 流式 token 返回
  → 前端逐字渲染
```

**前端主要负责**：输入、展示、流式体验、错误与 loading、引用/Tool 等特殊 UI。  
**不负责**：持有密钥、直接调数据库、代替服务端做权限。

后面会遇到的 **RAG**（先检索再回答）、**Agent**（多步调工具）都是在这条链路上加模块，不是另起炉灶。

## 1. 必懂概念（5 个够用很久）

### 1.1 LLM 是什么

大语言模型是 **「根据上文预测下一个 token」** 的系统。你看到的「回答」是模型一次次预测拼出来的，不是查数据库得到的固定答案。

对前端的意义：**输出是概率性的**——要有 loading、错误重试、以及「我不确定」的 UI，而不是 Spinner 结束就必须有唯一正确答案。

### 1.2 Token

模型按 **token** 计费与截断，不是按「字」。中文大致 **1 个汉字 ≈ 1–2 token**，英文一个单词约 1 token。

- **上下文窗口**：一次请求能塞多少 token（输入 + 输出），例如 128k
- 对话太长要 **截断或摘要**，否则报错或 silently 丢早期消息

### 1.3 消息结构

常见 Chat API 格式：

```json
{
  "messages": [
    { "role": "system", "content": "你是助手，回答要简洁。" },
    { "role": "user", "content": "什么是 Fiber？" },
    { "role": "assistant", "content": "Fiber 是..." }
  ]
}
```

- **system**：人设与规则（用户一般看不到）
- **user / assistant**：多轮对话历史

前端通常把 `messages` 数组存在 state 里，每次发送 append 一条 user。

### 1.4 流式 vs 非流式

| | 非流式 | 流式（SSE） |
|---|--------|-------------|
| 体验 | 等几秒一次性出字 | 逐 token 出现 |
| 实现 | `await fetch` 一次 JSON | `ReadableStream` 或 AI SDK |
| 适用 | 短回答、结构化输出 | Chat 产品默认 |

Chat 类产品 **默认用流式**；下一篇专门讲 SDK 封装。

### 1.5 温度（temperature）

0–2，越高越发散。**客服/代码** 偏低（0–0.3），**创意写作** 偏高。前端很少调，但 Route 里要知道有这个参数。

## 2. 安全红线（必须遵守）

1. **API Key 只在服务端** — 环境变量 `OPENAI_API_KEY`，不要 `NEXT_PUBLIC_`、不要进 bundle
2. **浏览器只调你自己的 `/api/chat`** — 不要从 React 直连 `api.openai.com`
3. **鉴权** — 登录用户的 Chat 要校验 session，防刷接口
4. **限流** — 按 IP / 用户限制请求次数，防 token 被刷爆

违反第 1 条，Key 一旦泄露，账单可能一夜爆炸。

## 3. 最小可运行示例

下面用 **Next.js App Router** 举例（Vite + 自建 Express Route 同理，只是文件位置不同）。

### 3.1 服务端 Route

```ts
// app/api/chat/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages,
    system: "你是前端技术助手，回答简洁，代码用 markdown。",
    maxTokens: 1024,
  });

  return result.toDataStreamResponse();
}
```

`.env.local`（不要提交 git）：

```
OPENAI_API_KEY=sk-...
```

### 3.2 客户端 Chat

```tsx
"use client";
import { useChat } from "ai/react";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({ api: "/api/chat" });

  return (
    <div>
      <div role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id}>
            <strong>{m.role === "user" ? "你" : "助手"}</strong>
            <p>{m.content}</p>
          </div>
        ))}
      </div>
      {error && <p role="alert">出错了，请重试</p>}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} disabled={isLoading} />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "生成中…" : "发送"}
        </button>
      </form>
    </div>
  );
}
```

跑通后建议改三处练手：**system 文案**、**maxTokens**、**多轮对话**（连问两句看 history 是否带上）。

## 4. 和普通 API 集成的差异

| 普通 REST | LLM Chat |
|-----------|----------|
| 请求体固定字段 | `messages[]` 越来越长 |
| 响应一次返回 | 流式，要处理半截 Markdown |
| 错误多为 4xx/5xx | 还要处理内容审核、超长、模型超时 |
| 可缓存 GET | 同 prompt 也可能不同输出 |

所以会有 **AbortController 取消**、**Markdown 流式安全渲染**、**空响应兜底**——在 [第 2 篇](/posts/ai-sdk-streaming-integration) 展开。

## 5. 能力进阶地图（入门 → 精通）

| 阶段 | 你要解决的问题 | 体系中的文章 |
|------|----------------|--------------|
| **入门** | 跑通 Chat、流式、Key 安全 | 本篇 → [AI SDK](/posts/ai-sdk-streaming-integration) |
| **进阶** | 公司文档问答、引用从哪来 | [RAG 前端](/posts/llm-rag-frontend-architecture) → [Agent UI](/posts/ai-agent-ui-design-patterns) |
| **高级** | 工具调用、MCP、Prompt 版本 | [MCP 编排](/posts/ai-app-engineering-mcp-workflow) → [Prompt 评测](/posts/ai-prompt-eval-production) |
| **精通** | 成本、监控、降级 | [可观测与成本](/posts/ai-observability-cost-governance) |

完整顺序见 [AI 应用开发体系](/topics/ai-engineering) 专题。

## 6. 常见坑（入门阶段）

1. **Key 打进前端** — 用 Network 面板搜 `sk-`，不应出现
2. **不做 loading** — 用户以为卡死，重复点击 → 双倍 token
3. **messages 无限增长** — 超上下文窗口；要滑动窗口或摘要
4. **把模型输出当 HTML 直接 innerHTML** — XSS；用 Markdown  sanitize
5. **忽略 error 态** — 429/503 要有「稍后重试」

## 7. 自测清单

- [ ] 能画出「浏览器 → Route → 模型 API」三层
- [ ] 能解释 system / user / assistant 区别
- [ ] 本地 Chat 能流式出字
- [ ] Key 只存在于服务端环境变量
- [ ] 知道 RAG、Agent 大概在链路的哪一环

全部打勾 → 进入 **[第 2 篇：AI SDK 与流式响应](/posts/ai-sdk-streaming-integration)**。

---

> 说明：本系列为学习笔记，架构与代码供参考，可在自己的栈（Vite、Nuxt、Remix）中平移 Route 与 UI 层。

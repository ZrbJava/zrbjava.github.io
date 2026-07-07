---
title: "AI 应用工程化：MCP 工作流与 Agent 编排"
description: "MCP 协议、Tool Calling 架构、Agent 状态机、Prompt 版本管理与 AI 应用从 Demo 到生产的工程化路径。"
pubDate: 2026-07-05
category: "AI 工程"
tags: ["AI", "MCP", "Agent", "Engineering"]
series: "AI 应用开发体系"
draft: false
featured: true
aiLevel: "高级"
aiOrder: 5
cover: "/images/covers/ai-app-engineering-mcp-workflow.svg"
---

> **前置阅读**：[Agent UI 设计模式](/posts/ai-agent-ui-design-patterns) · **体系第 5 篇**

MCP 与 Agent 编排解决的是：**工具如何标准化接入、多步任务如何可控**。

## 从 Demo 到生产缺什么

| Demo 常见做法 | 生产级缺口 |
|---------------|------------|
| API Route 里硬编码 `fetch` | 工具无法被 Cursor / Claude Desktop 复用 |
| OpenAI function calling 直连 DB | 换模型要重写 schema，无统一审计 |
| Prompt 改完直接上线 | 无 eval 回归，幻觉引用无法量化 |
| 流式只吐文字 | Tool 中间态不可见，出错无法重试 |

下面按 **架构 → MCP Server → Agent API → 前端 → Prompt/监控** 展开可落地实现。

## 生产架构

```
┌──────────────┐     SSE      ┌─────────────────────┐
│  Chat UI     │◀────────────▶│  BFF / Agent API    │
│  Tool 卡片   │              │  状态机 · 模型路由   │
└──────────────┘              └──────────┬──────────┘
                                         │ MCP Client (stdio/SSE)
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
              docs-server          readonly-sql           jira-server
              向量检索              只读查询               创建工单
```

与 [RAG 前端架构](/posts/llm-rag-frontend-architecture) 配合：检索走 `docs-server`，对话与 tool 编排走统一 Agent API。UI 模式见 [Agent UI 设计](/posts/ai-agent-ui-design-patterns)。

## MCP 是什么、为什么用

**Model Context Protocol（MCP）** 是 Anthropic 推动的开放协议，定义 LLM 应用如何发现、调用外部 **Tools / Resources / Prompts**。对工程团队的价值：

1. **工具与 Prompt 解耦** — 增删 tool 不改 system prompt 里的 URL 列表
2. **多端复用** — 同一 `docs-server` 给 Cursor、Claude Desktop、自研 Web 用
3. **Schema 即契约** — `inputSchema` 可 codegen、单测、文档化

传输方式常用两种：

| 传输 | 场景 |
|------|------|
| **stdio** | 本地子进程，Cursor / Claude Desktop、Node Agent 侧 |
| **SSE / HTTP** | 远程 MCP 服务，多租户、集中鉴权 |

## MCP Server 落地

使用 `@modelcontextprotocol/sdk` 启动独立进程：

```ts
// servers/docs-mcp/src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'docs', version: '1.2.0' });

server.tool(
  'search_docs',
  '搜索内部文档，返回标题、摘要与 docId',
  {
    query: z.string().min(2),
    topK: z.number().int().min(1).max(10).default(5),
  },
  async ({ query, topK }) => {
    const hits = await vectorSearch(query, topK);
    return {
      content: [{ type: 'text', text: JSON.stringify(hits) }],
    };
  },
);

server.tool(
  'get_doc_chunk',
  '按 docId 与 chunkId 取原文片段，用于引用',
  {
    docId: z.string(),
    chunkId: z.string(),
  },
  async ({ docId, chunkId }) => {
    const chunk = await loadChunk(docId, chunkId);
    return { content: [{ type: 'text', text: chunk.text }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Claude Desktop 配置**（`claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "docs": {
      "command": "node",
      "args": ["/path/to/docs-mcp/dist/index.js"],
      "env": { "DOCS_API_KEY": "..." }
    }
  }
}
```

### 我们 rejected 的方案

| 方案 | 问题 |
|------|------|
| 全写在 Next.js API Route | 工具与 UI 耦合，无法给 IDE 复用 |
| OpenAI function calling 直连 DB | 无标准 schema，换模型要重写 |
| **MCP stdio server** | 多进程运维成本 ↑，但边界清晰 ✅ |

## Agent API：MCP Client + 模型调用

BFF 层维护 MCP Client 连接池，把 LLM 的 tool call 转成 MCP 调用：

```ts
// app/api/agent/route.ts — 概念简化
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';

async function getMcpTools() {
  const client = new Client({ name: 'web-agent', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['servers/docs-mcp/dist/index.js'],
  });
  await client.connect(transport);
  const { tools: listed } = await client.listTools();
  return listed.map((t) =>
    tool({
      description: t.description ?? t.name,
      parameters: jsonSchemaToZod(t.inputSchema),
      execute: async (args) => {
        const result = await client.callTool({ name: t.name, arguments: args });
        return result.content;
      },
    }),
  );
}

export async function POST(req: Request) {
  const { messages, promptVersion } = await req.json();
  const tools = await getMcpTools();
  const result = streamText({
    model: openai('gpt-4o'),
    system: loadPrompt('doc-assistant', promptVersion),
    messages,
    tools,
    maxSteps: 5,
  });
  return result.toDataStreamResponse();
}
```

要点：

- **API Key 只在服务端** — 见 [AI SDK 流式集成](/posts/ai-sdk-streaming-integration)
- **`maxSteps`** 限制 tool 循环，防 runaway agent
- 每次请求带 `promptVersion`，日志可关联 eval

## Agent 状态机（含错误与重试）

纯「调 LLM + 等结果」无法处理：tool 失败、需人工审批、用户中途取消。我们用显式状态机：

```ts
type AgentState =
  | 'idle'
  | 'planning'
  | 'tool_calling'
  | 'generating'
  | 'awaiting_approval'
  | 'error';

type AgentEvent =
  | { type: 'USER_MESSAGE'; text: string }
  | { type: 'TOOL_RESULT'; callId: string; result: unknown }
  | { type: 'TOOL_ERROR'; callId: string; error: string }
  | { type: 'STREAM_DONE' }
  | { type: 'USER_APPROVE' }
  | { type: 'USER_REJECT' }
  | { type: 'USER_CANCEL' };

function transition(state: AgentState, event: AgentEvent, ctx: AgentContext) {
  if (event.type === 'USER_CANCEL') {
    return { next: 'idle' as const, action: 'abort_stream' as const };
  }
  if (state === 'tool_calling' && event.type === 'TOOL_ERROR') {
    if (ctx.retries < 2) {
      ctx.retries++;
      return { next: 'tool_calling' as const, action: 'retry_with_backoff' as const };
    }
    return { next: 'error' as const, action: 'surface_error_to_user' as const };
  }
  if (state === 'planning' && needsHumanApproval(ctx.pendingTool)) {
    return { next: 'awaiting_approval' as const, action: 'show_approval_dialog' as const };
  }
  // ... 其余转移
}
```

**必须人工审批的 tool**：`execute_sql`（非 readonly）、`create_jira_ticket`、`send_email`。审批 UI 用 `ApprovalDialog`，拒绝后回到 `planning` 让模型换策略。

## 前端：SSE 事件协议

前端与状态机对齐的 SSE 事件类型：

```ts
type AgentSSEEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; callId: string; name: string; args: unknown }
  | { type: 'tool_end'; callId: string; result: unknown; durationMs: number }
  | { type: 'tool_error'; callId: string; message: string }
  | { type: 'approval_required'; callId: string; summary: string }
  | { type: 'done'; usage: { promptTokens: number; completionTokens: number } }
  | { type: 'error'; message: string };
```

```tsx
// hooks/useAgentChat.ts — 简化
export function useAgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCall>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const send = async (text: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const res = await fetch('/api/agent', {
      method: 'POST',
      signal: abortRef.current.signal,
      body: JSON.stringify({ messages: [...messages, { role: 'user', content: text }] }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (const line of buffer.split('\n\n')) {
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6)) as AgentSSEEvent;
        applyEvent(event, { setMessages, setToolCalls });
      }
      buffer = '';
    }
  };

  const stop = () => abortRef.current?.abort();

  return { messages, toolCalls: [...toolCalls.values()], send, stop };
}
```

Tool 卡片展示 `name`、耗时、`result` 摘要；失败显示 retry。流式 Markdown 需 sanitize，防 XSS。

## Prompt 版本管理

```
prompts/
  doc-assistant/
    v1.0.0.system.md
    v1.1.0.system.md   # 增加「必须引用来源」
eval/
  doc-assistant.json   # 50 条标准问答 + 期望 citation 数
```

| 实践 | 落地 |
|------|------|
| 模板化 | `{{retrieved_context}}` 由 RAG 注入 |
| 版本号 | 请求体带 `promptVersion`，日志 / 工单可复现 |
| A/B | 10% 流量 v1.1.0，对比 citation 率与 👎 率 |
| 回归 | CI 跑 eval，均分降 > 5% 阻塞发布 |

eval 条目示例：

```json
{
  "id": "cite-001",
  "question": "年假有多少天？",
  "expect": { "minCitations": 1, "mustContainDoc": "员工手册" }
}
```

## 监控、成本与降级

| 指标 | 告警 | 动作 |
|------|------|------|
| Token / user / 日 | 超预算 120% | 限流 + 通知 |
| `search_docs` P95 | > 3s | 查索引 / 向量库 |
| tool 失败率 | > 5% / 15min | 查 MCP 进程、网络 |
| 👎 率 | 环比 +10% | 对比 promptVersion |

**降级链**：GPT-4o → 4o-mini → 仅返回检索摘要（不生成）→ 固定文案「服务繁忙」。

**敏感输出**：正则 + 小模型审核 gate；blocking 时不把原文返回给用户。

## 参考指标（设计目标）

以下为中等规模内部助手（日活千级、Peak 并发 ~80）的设计参考，非个人项目背书：

- P95 首 token：**1.2s**
- tool 失败率：8%（无重试）→ **1.5%**（2 次 backoff + 错误卡片）
- Prompt v1.1.0（强制引用）后，幻觉引用率 **-34%**

## 生产 checklist

- [ ] MCP tool schema 与 handler 单测
- [ ] MCP 进程健康检查 / 自动重启
- [ ] 流式中断（AbortController）与断线提示
- [ ] 高危 tool 人工确认 + 审计日志
- [ ] Prompt 版本 + eval CI 门禁
- [ ] Token / 成本 Dashboard，按 feature 分摊

## 常见坑

1. **MCP 子进程僵尸** — 请求结束 `client.close()`，或进程池 + idle timeout
2. **tool 结果过大** — 截断 + 摘要再进 context，防 token 爆炸
3. **stdio 日志污染 stdout** — MCP 协议走 stdout，日志必须打 stderr
4. **无限 tool 循环** — `maxSteps` + 状态机 `planning` 次数上限

## 自测清单

- [ ] 能说明 MCP 与 function calling 的分工
- [ ] Agent 状态机有 `maxSteps` 防无限循环
- [ ] 高危 tool 有人工确认流程
- [ ] tool 失败有重试/降级 UI
- [ ] 能画出 Chat → BFF → MCP → LLM 链路

全部打勾 → 进入 **[第 6 篇：Prompt 工程与评测](/posts/ai-prompt-eval-production)**。

AI 应用工程化的分水岭：**工具协议标准化、Agent 行为可状态化、Prompt 像代码一样版本化**。Demo 缺的后三块，正是 senior 前端 / 全栈要补的；MCP 是当前把这三块串起来的最 practical 协议之一。

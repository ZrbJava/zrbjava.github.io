---
title: "AI 应用开发体系"
description: "面向前端开发者：从 LLM 入门到 RAG、Agent、MCP 与生产级工程化，7 篇文章系统学习路径。"
order: 1
featured: true
tags: ["AI", "LLM", "RAG", "Agent", "MCP"]
---

面向 **普通前端开发者** 的系统化笔记：按顺序阅读下面 7 篇，可以从「没碰过大模型」走到「理解生产级 AI 应用该怎么设计」。每篇文首有 **路线图导航**（上一篇 / 下一篇）。

## 阶段一 · 入门（跑通 Chat）

| 序号 | 文章 | 目标 |
|------|------|------|
| 01 | [前端 AI 应用入门](/posts/ai-frontend-getting-started) | 理解 LLM 链路、Token、第一个 Chat |
| 02 | [AI SDK 与流式响应](/posts/ai-sdk-streaming-integration) | useChat、SSE、Abort、流式 Markdown |

**阶段检验**：本地 Chat 能流式出字；Key 不在浏览器；能解释 messages 结构。

## 阶段二 · 进阶（知识库与 Agent UI）

| 序号 | 文章 | 目标 |
|------|------|------|
| 03 | [RAG 前端架构](/posts/llm-rag-frontend-architecture) | 上传、检索、引用溯源 UI |
| 04 | [Agent UI 设计模式](/posts/ai-agent-ui-design-patterns) | Tool 卡片、审批、多步任务 |

**阶段检验**：能画 RAG 链路；能设计 citation 与幻觉提示 UI。

## 阶段三 · 高级（工程化）

| 序号 | 文章 | 目标 |
|------|------|------|
| 05 | [MCP 与 Agent 编排](/posts/ai-app-engineering-mcp-workflow) | 工具协议、状态机、BFF |
| 06 | [Prompt 工程与评测](/posts/ai-prompt-eval-production) | 版本化、eval、CI 门禁 |

**阶段检验**：能说明 MCP 与 function calling 分工；能设计 eval 用例。

## 阶段四 · 精通（生产运维）

| 序号 | 文章 | 目标 |
|------|------|------|
| 07 | [可观测性与成本治理](/posts/ai-observability-cost-governance) | Token、trace、降级、看板 |

**阶段检验**：能设计 trace 字段与成本告警；能说出降级链。

## 建议学习方式

1. **严格按 01 → 07 顺序**，不要跳读——后面默认你懂前面的链路。
2. 每篇文末 **自测清单** 打勾后再进下一篇。
3. 动手：每篇至少做一个小 Demo，把链路跑通后再进下一篇。

## 前端模块索引

若你更关心界面层，阶段 1–4 是核心；阶段 5–7 偏全栈/BFF，但对 **AI 应用开发岗位** 同样常考。

- 界面与交互：第 1–4 篇
- 工具与编排：第 5 篇
- 质量与成本：第 6–7 篇

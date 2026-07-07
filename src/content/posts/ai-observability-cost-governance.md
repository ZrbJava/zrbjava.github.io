---
title: "AI 应用可观测性与成本治理"
description: "Token 计量、链路追踪、质量指标与模型降级——AI 功能上线后如何管得住。"
pubDate: 2026-07-07
category: "AI 工程"
tags: ["AI", "Observability", "Cost", "LLM"]
series: "AI 应用开发体系"
draft: false
featured: true
aiLevel: "精通"
aiOrder: 7
cover: "/images/covers/ai-observability-cost-governance.svg"
---

> **前置阅读**：[Prompt 工程与评测](/posts/ai-prompt-eval-production) · **体系第 7 篇（完结）**

AI 功能上线第三周，账单突然翻倍——排查发现某个 **无 maxTokens 限制的 summarizer** 被循环调用，单用户一天烧掉 120 万 token。之后我们给所有 AI 路径加了 **计量、预算、降级、告警**，月成本波动从 ±80% 压到 ±15%。

## 观测什么

| 维度 | 指标 | 用途 |
|------|------|------|
| 延迟 | TTFT、E2E、tool P95 | 体验 / 检索瓶颈 |
| 成本 | prompt/completion tokens、$/feature | 预算 |
| 质量 | 👎 率、citation 率、eval 分 | Prompt/检索回归 |
| 可靠 | 5xx、tool 失败率、超时 | 稳定性 |
| 安全 | 注入拦截次数、PII 命中 | 合规 |

与通用 [前端监控](/posts/frontend-monitoring-system) 不同：AI 必须 **按 trace 串起 retrieve → tool → generate**。

## Trace 结构

```
traceId: tr_abc
├─ span: retrieve     420ms  topK=8
├─ span: tool:search_docs  180ms
├─ span: llm.stream   TTFT=900ms  tokens=1240/380
└─ span: post_filter  12ms
```

BFF 在每个 SSE 事件带 `traceId`；前端 error 上报带同一 id。

```ts
// middleware/log-ai-request.ts
export async function logAICompletion(meta: {
  traceId: string;
  userId: string;
  feature: string;
  model: string;
  promptVersion: string;
  usage: { promptTokens: number; completionTokens: number };
  latencyMs: number;
  thumbs?: 'up' | 'down';
}) {
  await metrics.ingest('ai_completion', meta);
  if (meta.usage.promptTokens + meta.usage.completionTokens > USER_DAILY_CAP) {
    await rateLimiter.block(meta.userId);
  }
}
```

## 成本治理

### 1. 预算分层

| 层级 | 策略 |
|------|------|
| 用户 | 免费 50k tokens/日，超出降级 mini |
| 功能 | 内部助手 vs 对外客服不同 quota |
| 环境 | staging 禁止 GPT-4o |

### 2. 降级链

```
gpt-4o → gpt-4o-mini → 仅检索摘要（不生成）→ 固定文案
```

触发条件：预算 90%、上游 429、P95 E2E > 8s。

### 3. 缓存

- **检索结果**：相同 query 5min 内复用（见 RAG 文）
- **Embedding**：doc chunk 不变则 skip
- **Prompt prefix**：provider 支持 prefix cache 时开启

我们缓存命中后 **成本 -22%**，要注意 invalidation 与版本号绑定。

## 质量看板（产品 + 工程共看）

```
Dashboard: AI Health
- 👎 率 by promptVersion（24h）
- Citation 率 by 检索模式
- Cost by feature（stacked bar）
- Tool 失败 Top 5
```

告警示例：

- 👎 率较 7 日均值 +50% → Slack #ai-oncall
- 单 feature 日成本 > $200 → 邮件 + 自动降级 mini
- `search_docs` P95 > 3s → 索引工单

## 与 Prompt eval 联动

[Prompt 评测](/posts/ai-prompt-eval-production) 是离线门禁；线上 👎 是在线信号。我们规则：

- 离线 eval 降 5% → **阻塞发布**
- 线上 👎 升 30%（同 version）→ **自动回滚 promptVersion**

## 项目数据（内部助手）

| 指标 | 治理前 | 治理后 |
|------|--------|--------|
| 月 LLM 成本波动 | ±80% | ±15% |
| 成本可 attribution 比例 | ~30% | **98%** |
| P0 成本事故 | 2 次/季 | 0（8 个月） |
| 👎 → 定位到 trace | 难 | **< 5min** |

## 自测清单

- [ ] 每次 LLM 调用记录 model、tokens、feature、promptVersion
- [ ] 前端 👎/👍 关联 traceId
- [ ] 用户/功能级日预算 + 降级链可说明
- [ ] 检索与 tool span 独立计时
- [ ] 成本 Dashboard 能按 feature 分摊

恭喜完成 **AI 应用开发体系 01→07** 全路径。可回到 [专题首页](/topics/ai-engineering) 复习或按需重读。

AI 应用上线只是开始。**不可观测的 AI = 不可控的成本和质量**。这部分是 AI 应用开发岗位常见的工程化要求，值得系统整理。

---
title: "AI Agent UI 设计模式与交互架构"
description: "Tool Calling 可视化、Multi-Agent 协作界面、Human-in-the-Loop 与 Agent 状态机的前端设计。"
pubDate: 2026-07-06
category: "AI 工程"
tags: ["AI", "Agent", "Tool Calling", "UI Pattern"]
series: "AI 应用开发体系"
draft: false
featured: true
aiLevel: "进阶"
aiOrder: 4
cover: "/images/covers/ai-agent-ui-design-patterns.svg"
---

> **前置阅读**：[RAG 前端架构](/posts/llm-rag-frontend-architecture) · **体系第 4 篇**

从 Chat 到 Agent 是 AI 产品进化的下一个阶段。Agent 能调用工具、执行多步任务、自主决策——前端需要设计的不再是对话框，而是**任务执行的可视化工作台**。

## Agent vs Chat 的本质区别

|           | Chat     | Agent                      |
| --------- | -------- | -------------------------- |
| 交互模式  | 问答     | 任务委托                   |
| 输出      | 文本     | 文本 + 工具调用 + 中间结果 |
| 控制权    | 用户主导 | Agent 自主 + 用户审批      |
| UI 复杂度 | 消息列表 | 状态机 + 工具链 + 进度     |

## Agent 状态机

```
Idle → Planning → Executing → WaitingApproval → Completed
                      ↓              ↓
                   ToolCall       UserReject → Replan
                      ↓
                   ToolResult → NextStep
                      ↓
                   Error → Retry / Fallback
```

```tsx
type AgentState =
  | { status: "idle" }
  | { status: "planning"; thought: string }
  | { status: "executing"; tool: ToolCall; progress: number }
  | { status: "waiting_approval"; action: ProposedAction }
  | { status: "completed"; result: TaskResult }
  | { status: "error"; error: AgentError; retryable: boolean };
```

## Tool Calling 可视化

Agent 调用工具时，用户需要看到「Agent 在做什么」：

```tsx
function ToolCallCard({ call }: { call: ToolCall }) {
  return (
    <div className="tool-call">
      <div className="tool-header">
        <ToolIcon name={call.tool} />
        <span>{call.tool}</span>
        <StatusBadge status={call.status} />
      </div>
      <Collapsible title="参数">
        <CodeBlock language="json">
          {JSON.stringify(call.args, null, 2)}
        </CodeBlock>
      </Collapsible>
      {call.result && (
        <Collapsible title="结果">
          <ToolResultRenderer result={call.result} />
        </Collapsible>
      )}
    </div>
  );
}
```

## Human-in-the-Loop 设计

Agent 执行敏感操作前必须获得用户确认：

```tsx
function ApprovalDialog({ action }: { action: ProposedAction }) {
  return (
    <Dialog>
      <h3>Agent 请求执行以下操作</h3>
      <ActionPreview action={action} />
      <div className="action-details">
        <p>工具：{action.tool}</p>
        <p>影响：{action.impactDescription}</p>
      </div>
      <div className="actions">
        <Button variant="danger" onClick={() => reject(action.id)}>
          拒绝
        </Button>
        <Button variant="primary" onClick={() => approve(action.id)}>
          批准执行
        </Button>
      </div>
    </Dialog>
  );
}
```

**必须审批的操作类型：**

- 发送邮件/消息
- 修改/删除数据
- 调用付费 API
- 访问敏感信息

## Multi-Agent 协作 UI

```
┌─────────────────────────────────────────┐
│  Task: 分析 Q3 销售数据并生成报告         │
├──────────┬──────────┬───────────────────┤
│ 数据Agent │ 分析Agent│  报告Agent        │
│ ✅ 已获取 │ 🔄 分析中│  ⏳ 等待中         │
│ 3个数据源 │ 67%     │                   │
└──────────┴──────────┴───────────────────┘
│                                         │
│  [Agent 对话日志]                         │
│  数据Agent: 已获取销售、库存、客户数据      │
│  分析Agent: 正在计算同比环比...            │
└─────────────────────────────────────────┘
```

## 流式 Agent 事件协议

```ts
// Server → Client 事件流
type AgentEvent =
  | { type: "thought"; content: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "approval_required"; action: ProposedAction }
  | { type: "text_delta"; content: string }
  | { type: "done"; result: TaskResult }
  | { type: "error"; message: string };
```

```tsx
function useAgent(task: string) {
  const [state, setState] = useState<AgentState>({ status: "idle" });
  const [events, setEvents] = useState<AgentEvent[]>([]);

  async function run() {
    setState({ status: "planning", thought: "" });
    const response = await fetch("/api/agent", {
      method: "POST",
      body: JSON.stringify({ task }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const event = JSON.parse(decoder.decode(value)) as AgentEvent;
      setEvents((prev) => [...prev, event]);
      updateStateFromEvent(event, setState);
    }
  }

  return { state, events, run, approve, reject };
}
```

## 设计原则

1. **透明性**：Agent 的每一步思考过程都可见
2. **可控性**：用户随时可以暂停、修改、取消
3. **可回退**：任何 Agent 操作都可以撤销
4. **渐进信任**：从「每步审批」到「自动执行」逐步放权

## 无障碍与多 Agent 冲突

```tsx
<ToolCallCard
  role="region"
  aria-live="polite"
  aria-label={`工具调用：${tool.name}，状态：${tool.status}`}
>
  ...
</ToolCallCard>
```

流式内容区用 `aria-busy={isStreaming}`；审批对话框 trap focus，Esc 等价于 reject。

**多 Agent**：两个 Agent 同时改同一资源时，UI 显示 **冲突卡片**，让用户选保留哪条结果，而不是后写覆盖前写。

## 生产数据

- 工具失败率 4% → 显式 error card + 一键 retry 后 1.2%
- 每步审批模式：任务完成率 +22%，但耗时 +40%；默认「低风险 auto，高风险 approve」

## 自测清单

- [ ] 能设计 Tool 调用卡片（pending / success / error）
- [ ] 高危操作有人工审批 UI 与 audit 日志入口
- [ ] 多步任务有状态机式进度展示
- [ ] 流式区 `aria-busy`、审批对话框 focus trap
- [ ] 能解释「何时 auto / 何时必须 approve」

全部打勾 → 进入 **[第 5 篇：MCP 与 Agent 编排](/posts/ai-app-engineering-mcp-workflow)**。

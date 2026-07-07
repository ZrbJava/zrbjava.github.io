/** AI 应用开发体系：从前端开发者视角，入门 → 精通 */
export const AI_ROADMAP_SERIES = "AI 应用开发体系";

export const AI_STAGES = ["入门", "进阶", "高级", "精通"] as const;
export type AIStage = (typeof AI_STAGES)[number];

export const aiRoadmapSteps = [
  {
    order: 1,
    stage: "入门" as AIStage,
    slug: "ai-frontend-getting-started",
    title: "前端 AI 应用入门",
    goal: "理解 LLM 链路，跑通第一个 Chat",
  },
  {
    order: 2,
    stage: "入门" as AIStage,
    slug: "ai-sdk-streaming-integration",
    title: "AI SDK 与流式响应",
    goal: "useChat、SSE、Abort、Markdown 流式渲染",
  },
  {
    order: 3,
    stage: "进阶" as AIStage,
    slug: "llm-rag-frontend-architecture",
    title: "RAG 前端架构",
    goal: "上传、检索、引用溯源 UI",
  },
  {
    order: 4,
    stage: "进阶" as AIStage,
    slug: "ai-agent-ui-design-patterns",
    title: "Agent UI 设计模式",
    goal: "Tool 可视化、审批、多步任务",
  },
  {
    order: 5,
    stage: "高级" as AIStage,
    slug: "ai-app-engineering-mcp-workflow",
    title: "MCP 与 Agent 编排",
    goal: "工具协议、状态机、BFF 集成",
  },
  {
    order: 6,
    stage: "高级" as AIStage,
    slug: "ai-prompt-eval-production",
    title: "Prompt 工程与评测",
    goal: "版本化、eval 数据集、CI 门禁",
  },
  {
    order: 7,
    stage: "精通" as AIStage,
    slug: "ai-observability-cost-governance",
    title: "可观测性与成本治理",
    goal: "Token、trace、降级、看板",
  },
] as const;

export function getRoadmapStep(slug: string) {
  return aiRoadmapSteps.find((s) => s.slug === slug);
}

export function getAdjacentRoadmapSteps(slug: string) {
  const index = aiRoadmapSteps.findIndex((s) => s.slug === slug);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? aiRoadmapSteps[index - 1] : null,
    next: index < aiRoadmapSteps.length - 1 ? aiRoadmapSteps[index + 1] : null,
  };
}

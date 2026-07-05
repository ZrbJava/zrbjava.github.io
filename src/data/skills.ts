export interface SkillPoint {
  label: string;
  value: number;
}

export interface KnowledgeDomain {
  title: string;
  topics: string[];
  level: "熟练" | "掌握";
}

export const skillRadar: SkillPoint[] = [
  { label: "Vue", value: 95 },
  { label: "小程序", value: 88 },
  { label: "React", value: 90 },
  { label: "TypeScript", value: 90 },
  { label: "工程化", value: 92 },
  { label: "浏览器/性能", value: 88 },
  { label: "Electron", value: 85 },
  { label: "AI 应用", value: 82 },
  { label: "监控/埋点", value: 80 },
  { label: "移动端/H5", value: 78 },
  { label: "Node/BFF", value: 75 },
];

export const knowledgeDomains: KnowledgeDomain[] = [
  {
    title: "Vue 生态",
    level: "熟练",
    topics: ["响应式原理", "Composition API", "Pinia", "组件架构", "SSR"],
  },
  {
    title: "跨端开发",
    level: "熟练",
    topics: ["小程序", "H5 适配", "Electron", "React Native", "WebView"],
  },
  {
    title: "React 工程",
    level: "熟练",
    topics: ["Fiber", "RSC", "状态管理", "复杂表单", "性能优化"],
  },
  {
    title: "工程化",
    level: "熟练",
    topics: ["Vite/Webpack", "Monorepo", "CI/CD", "质量门禁", "包治理"],
  },
  {
    title: "AI 工程",
    level: "熟练",
    topics: ["LLM 集成", "RAG", "Agent UI", "MCP", "流式交互"],
  },
  {
    title: "数据/监控",
    level: "熟练",
    topics: ["埋点 SDK", "RUM", "错误监控", "漏斗分析", "A/B 实验"],
  },
  {
    title: "后端/BFF",
    level: "掌握",
    topics: ["Node.js", "BFF 聚合", "鉴权中间件", "GraphQL", "部署"],
  },
  {
    title: "可视化",
    level: "掌握",
    topics: ["Canvas", "WebGL", "ECharts", "大数据渲染"],
  },
];

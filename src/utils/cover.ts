import { withBase } from "@/utils/url";

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  Vue: ["#42b883", "#2c3e50"],
  React: ["#61dafb", "#20232a"],
  "AI 工程": ["#7c3aed", "#1e1b4b"],
  工程化: ["#64748b", "#1e293b"],
  浏览器原理: ["#f59e0b", "#78350f"],
  可视化: ["#ec4899", "#831843"],
  TypeScript: ["#3178c6", "#1e3a5f"],
  面试指南: ["#10b981", "#064e3b"],
  跨端开发: ["#6366f1", "#312e81"],
  后端开发: ["#22c55e", "#14532d"],
  数据工程: ["#0ea5e9", "#0c4a6e"],
  性能优化: ["#ef4444", "#7f1d1d"],
  前端架构: ["#14b8a6", "#134e4a"],
};

export function getCategoryGradient(category: string): string {
  const [from, to] = CATEGORY_GRADIENTS[category] ?? ["#146c5f", "#0f4f47"];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function getCategoryAccent(category: string): string {
  const [from] = CATEGORY_GRADIENTS[category] ?? ["#146c5f", "#0f4f47"];
  return from;
}

export function resolveCoverPath(cover?: string): string | undefined {
  if (!cover) return undefined;
  return cover.startsWith("http") ? cover : withBase(cover);
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const postsDir = path.join(root, "src/content/posts");
const coversDir = path.join(root, "public/images/covers");

const CATEGORY_COLORS = {
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

/** 每篇文章专属装饰主题 */
const THEMES = {
  "vue3-reactivity-system-deep-dive": "nodes",
  "vue3-composition-architecture": "layers",
  "pinia-state-management-design": "stores",
  "react-fiber-reconciliation-deep-dive": "fiber",
  "react-server-components-practice": "split",
  "react-state-management-comparison": "flow",
  "react-complex-form-architecture": "form",
  "component-layering": "stack",
  "llm-rag-frontend-architecture": "rag",
  "ai-sdk-streaming-integration": "stream",
  "ai-agent-ui-design-patterns": "agent",
  "ai-app-engineering-mcp-workflow": "workflow",
  "ai-frontend-getting-started": "stream",
  "ai-prompt-eval-production": "types",
  "ai-observability-cost-governance": "chart",
  "vite-webpack-build-pipeline": "bundle",
  "monorepo-governance-strategy": "tree",
  "frontend-ci-quality-gates": "pipeline",
  "code-review-practice": "diff",
  "frontend-monitoring-system": "chart",
  "browser-rendering-pipeline": "render",
  "frontend-security-defense": "shield",
  "canvas-webgl-rendering-guide": "grid",
  "typescript-advanced-type-patterns": "types",
  "senior-frontend-interview-roadmap": "roadmap",
  "frontend-system-design-interview": "system",
  "electron-architecture-security": "desktop",
  "electron-performance-packaging": "package",
  "wechat-mini-program-architecture": "phone",
  "react-native-architecture-practice": "bridge",
  "mobile-h5-adaptation-architecture": "responsive",
  "nodejs-bff-layer-design": "bff",
  "nodejs-bff-error-resilience": "bff",
  "mini-program-login-payment-flow": "phone",
  "mobile-h5-viewport-safe-area": "responsive",
  "react-native-debugging-performance": "bridge",
  "typescript-api-contract-modeling": "types",
  "data-visualization-echarts-canvas": "grid",
  "frontend-testing-pyramid-practice": "pipeline",
  "frontend-analytics-funnel-retention": "events",
  "frontend-tracking-sdk-design": "events",
  "frontend-performance-review": "speed",
  "frontend-permission-system": "matrix",
};

function parseFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`No frontmatter: ${filePath}`);

  const data = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\w+):\s*"(.*)"\s*$/);
    if (m) data[m[1]] = m[2];
  }
  return { raw, data, slug: path.basename(filePath, ".md") };
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapTitle(title, maxChars = 18) {
  if (title.length <= maxChars) return [title];
  const parts = [];
  let current = "";
  for (const char of title) {
    if (current.length >= maxChars) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts.slice(0, 2);
}

function decor(theme) {
  switch (theme) {
    case "nodes":
      return `
        <circle cx="920" cy="120" r="48" fill="rgba(255,255,255,0.08)"/>
        <circle cx="1020" cy="220" r="32" fill="rgba(255,255,255,0.12)"/>
        <circle cx="880" cy="260" r="22" fill="rgba(255,255,255,0.1)"/>
        <line x1="920" y1="120" x2="1020" y2="220" stroke="rgba(255,255,255,0.25)" stroke-width="3"/>
        <line x1="920" y1="120" x2="880" y2="260" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>`;
    case "layers":
      return `
        <rect x="820" y="90" width="280" height="56" rx="12" fill="rgba(255,255,255,0.08)"/>
        <rect x="860" y="160" width="240" height="56" rx="12" fill="rgba(255,255,255,0.12)"/>
        <rect x="900" y="230" width="200" height="56" rx="12" fill="rgba(255,255,255,0.16)"/>`;
    case "stores":
      return `
        <rect x="860" y="100" width="120" height="90" rx="14" fill="rgba(255,255,255,0.1)"/>
        <rect x="1000" y="130" width="120" height="90" rx="14" fill="rgba(255,255,255,0.14)"/>
        <path d="M980 145 L1000 145" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>`;
    case "fiber":
      return `
        <circle cx="930" cy="170" r="18" fill="rgba(255,255,255,0.2)"/>
        <circle cx="990" cy="120" r="14" fill="rgba(255,255,255,0.16)"/>
        <circle cx="1050" cy="180" r="14" fill="rgba(255,255,255,0.16)"/>
        <circle cx="1010" cy="250" r="14" fill="rgba(255,255,255,0.16)"/>
        <path d="M930 170 L990 120 L1050 180 L1010 250 Z" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="3"/>`;
    case "split":
      return `
        <rect x="820" y="90" width="150" height="220" rx="16" fill="rgba(255,255,255,0.08)"/>
        <rect x="990" y="90" width="150" height="220" rx="16" fill="rgba(255,255,255,0.14)"/>
        <path d="M970 120 L1010 120 L1010 280 L970 280 Z" fill="rgba(255,255,255,0.2)"/>`;
    case "flow":
      return `
        <path d="M840 280 C900 180, 980 180, 1040 280" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="5"/>
        <polygon points="1040,280 1020,260 1020,300" fill="rgba(255,255,255,0.35)"/>`;
    case "form":
      return `
        <rect x="850" y="110" width="260" height="28" rx="8" fill="rgba(255,255,255,0.1)"/>
        <rect x="850" y="160" width="260" height="28" rx="8" fill="rgba(255,255,255,0.12)"/>
        <rect x="850" y="210" width="180" height="28" rx="8" fill="rgba(255,255,255,0.14)"/>
        <rect x="850" y="260" width="120" height="36" rx="10" fill="rgba(255,255,255,0.22)"/>`;
    case "stack":
      return `
        <rect x="860" y="240" width="220" height="36" rx="8" fill="rgba(255,255,255,0.08)"/>
        <rect x="880" y="190" width="220" height="36" rx="8" fill="rgba(255,255,255,0.12)"/>
        <rect x="900" y="140" width="220" height="36" rx="8" fill="rgba(255,255,255,0.16)"/>`;
    case "rag":
      return `
        <rect x="850" y="120" width="90" height="120" rx="10" fill="rgba(255,255,255,0.12)"/>
        <rect x="960" y="150" width="90" height="90" rx="10" fill="rgba(255,255,255,0.1)"/>
        <circle cx="1080" cy="190" r="36" fill="rgba(255,255,255,0.16)"/>
        <path d="M940 180 L960 190 L1080 190" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>`;
    case "stream":
      return `
        <path d="M840 180 H1120" stroke="rgba(255,255,255,0.15)" stroke-width="8" stroke-linecap="round"/>
        <path d="M840 220 H1080" stroke="rgba(255,255,255,0.22)" stroke-width="8" stroke-linecap="round"/>
        <path d="M840 260 H1040" stroke="rgba(255,255,255,0.3)" stroke-width="8" stroke-linecap="round"/>`;
    case "agent":
      return `
        <circle cx="920" cy="180" r="34" fill="rgba(255,255,255,0.14)"/>
        <circle cx="1010" cy="130" r="24" fill="rgba(255,255,255,0.12)"/>
        <circle cx="1060" cy="230" r="24" fill="rgba(255,255,255,0.12)"/>
        <line x1="920" y1="180" x2="1010" y2="130" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>
        <line x1="920" y1="180" x2="1060" y2="230" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>`;
    case "workflow":
      return `
        <rect x="840" y="150" width="70" height="70" rx="14" fill="rgba(255,255,255,0.12)"/>
        <rect x="940" y="150" width="70" height="70" rx="14" fill="rgba(255,255,255,0.16)"/>
        <rect x="1040" y="150" width="70" height="70" rx="14" fill="rgba(255,255,255,0.2)"/>
        <path d="M910 185 H940 M1010 185 H1040" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>`;
    case "bundle":
      return `
        <rect x="860" y="110" width="80" height="80" rx="12" fill="rgba(255,255,255,0.1)"/>
        <rect x="950" y="110" width="80" height="80" rx="12" fill="rgba(255,255,255,0.14)"/>
        <rect x="1040" y="110" width="80" height="80" rx="12" fill="rgba(255,255,255,0.18)"/>
        <rect x="920" y="210" width="140" height="70" rx="14" fill="rgba(255,255,255,0.22)"/>`;
    case "tree":
      return `
        <rect x="900" y="110" width="120" height="36" rx="8" fill="rgba(255,255,255,0.12)"/>
        <rect x="860" y="170" width="90" height="32" rx="8" fill="rgba(255,255,255,0.1)"/>
        <rect x="970" y="170" width="90" height="32" rx="8" fill="rgba(255,255,255,0.1)"/>
        <rect x="1030" y="230" width="70" height="28" rx="8" fill="rgba(255,255,255,0.14)"/>`;
    case "pipeline":
      return `
        <circle cx="870" cy="190" r="24" fill="rgba(255,255,255,0.14)"/>
        <circle cx="960" cy="190" r="24" fill="rgba(255,255,255,0.18)"/>
        <circle cx="1050" cy="190" r="24" fill="rgba(255,255,255,0.22)"/>
        <line x1="894" y1="190" x2="936" y2="190" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>
        <line x1="984" y1="190" x2="1026" y2="190" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>`;
    case "diff":
      return `
        <rect x="850" y="120" width="260" height="18" rx="4" fill="rgba(255,255,255,0.08)"/>
        <rect x="850" y="150" width="220" height="18" rx="4" fill="rgba(255,255,255,0.14)"/>
        <rect x="850" y="180" width="240" height="18" rx="4" fill="rgba(255,255,255,0.1)"/>
        <rect x="850" y="210" width="200" height="18" rx="4" fill="rgba(255,255,255,0.16)"/>`;
    case "chart":
      return `
        <polyline points="840,280 900,210 960,240 1020,160 1080,190 1120,130" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "render":
      return `
        <rect x="850" y="250" width="260" height="28" rx="6" fill="rgba(255,255,255,0.08)"/>
        <rect x="850" y="210" width="260" height="28" rx="6" fill="rgba(255,255,255,0.12)"/>
        <rect x="850" y="170" width="260" height="28" rx="6" fill="rgba(255,255,255,0.16)"/>
        <rect x="850" y="130" width="260" height="28" rx="6" fill="rgba(255,255,255,0.2)"/>`;
    case "shield":
      return `
        <path d="M960 100 L1080 150 V230 C1080 260 960 300 960 300 C960 300 840 260 840 230 V150 Z" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>`;
    case "grid":
      return `
        <g stroke="rgba(255,255,255,0.12)" stroke-width="2">
          ${Array.from({ length: 6 }, (_, i) => `<line x1="${820 + i * 40}" y1="100" x2="${820 + i * 40}" y2="300"/>`).join("")}
          ${Array.from({ length: 6 }, (_, i) => `<line x1="820" y1="${100 + i * 40}" x2="1060" y2="${100 + i * 40}"/>`).join("")}
        </g>`;
    case "types":
      return `
        <text x="900" y="220" fill="rgba(255,255,255,0.22)" font-size="120" font-family="ui-monospace, monospace" font-weight="700">&lt;T&gt;</text>`;
    case "roadmap":
      return `
        <path d="M850 260 C900 120, 980 280, 1030 140, 1100 220" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="5" stroke-dasharray="12 10"/>
        <circle cx="850" cy="260" r="10" fill="rgba(255,255,255,0.35)"/>
        <circle cx="1030" cy="140" r="10" fill="rgba(255,255,255,0.35)"/>
        <circle cx="1100" cy="220" r="10" fill="rgba(255,255,255,0.35)"/>`;
    case "system":
      return `
        <rect x="860" y="120" width="110" height="70" rx="12" fill="rgba(255,255,255,0.12)"/>
        <rect x="990" y="120" width="110" height="70" rx="12" fill="rgba(255,255,255,0.12)"/>
        <rect x="925" y="220" width="110" height="70" rx="12" fill="rgba(255,255,255,0.18)"/>`;
    case "desktop":
      return `
        <rect x="860" y="110" width="220" height="140" rx="16" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" stroke-width="4"/>
        <rect x="930" y="260" width="80" height="12" rx="4" fill="rgba(255,255,255,0.2)"/>`;
    case "package":
      return `
        <rect x="900" y="120" width="140" height="140" rx="18" fill="rgba(255,255,255,0.14)"/>
        <path d="M900 160 H1040 M970 120 V260" stroke="rgba(255,255,255,0.28)" stroke-width="4"/>`;
    case "phone":
      return `
        <rect x="930" y="100" width="120" height="210" rx="22" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.28)" stroke-width="4"/>
        <circle cx="990" cy="285" r="10" fill="rgba(255,255,255,0.2)"/>`;
    case "bridge":
      return `
        <rect x="850" y="130" width="110" height="160" rx="16" fill="rgba(255,255,255,0.1)"/>
        <rect x="980" y="130" width="110" height="160" rx="16" fill="rgba(255,255,255,0.14)"/>
        <path d="M960 210 H980" stroke="rgba(255,255,255,0.35)" stroke-width="6"/>`;
    case "responsive":
      return `
        <rect x="850" y="170" width="280" height="18" rx="9" fill="rgba(255,255,255,0.12)"/>
        <rect x="870" y="210" width="220" height="18" rx="9" fill="rgba(255,255,255,0.16)"/>
        <rect x="900" y="250" width="160" height="18" rx="9" fill="rgba(255,255,255,0.2)"/>`;
    case "bff":
      return `
        <rect x="850" y="140" width="90" height="120" rx="12" fill="rgba(255,255,255,0.1)"/>
        <rect x="960" y="160" width="90" height="80" rx="12" fill="rgba(255,255,255,0.16)"/>
        <rect x="1070" y="170" width="70" height="60" rx="12" fill="rgba(255,255,255,0.22)"/>`;
    case "events":
      return `
        ${[[880, 140], [950, 220], [1020, 160], [1080, 250], [920, 260]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="14" fill="rgba(255,255,255,0.18)"/>`).join("")}`;
    case "speed":
      return `
        <path d="M900 260 A90 90 0 0 1 1080 260" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="10" stroke-linecap="round"/>
        <path d="M900 260 A90 90 0 0 1 1040 170" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="10" stroke-linecap="round"/>
        <circle cx="990" cy="260" r="8" fill="rgba(255,255,255,0.4)"/>`;
    case "matrix":
      return `
        <g fill="rgba(255,255,255,0.14)">
          ${Array.from({ length: 9 }, (_, i) => {
            const x = 880 + (i % 3) * 70;
            const y = 130 + Math.floor(i / 3) * 70;
            return `<rect x="${x}" y="${y}" width="48" height="48" rx="10"/>`;
          }).join("")}
        </g>`;
    default:
      return `<circle cx="980" cy="190" r="80" fill="rgba(255,255,255,0.08)"/>`;
  }
}

function buildCoverSvg({ title, category, slug }) {
  const [from, to] = CATEGORY_COLORS[category] ?? ["#146c5f", "#0f4f47"];
  const theme = THEMES[slug] ?? "default";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="fade" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${from}" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="${from}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${to}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#fade)"/>
  <circle cx="150" cy="120" r="180" fill="rgba(255,255,255,0.05)"/>
  <circle cx="1180" cy="560" r="220" fill="rgba(0,0,0,0.1)"/>
  ${decor(theme)}
</svg>`;
}

function upsertCoverFrontmatter(raw, coverPath) {
  if (/^cover:\s/m.test(raw)) {
    return raw.replace(/^cover:\s.*$/m, `cover: "${coverPath}"`);
  }

  return raw.replace(/^(featured:\s.*)$/m, `$1\ncover: "${coverPath}"`);
}

fs.mkdirSync(coversDir, { recursive: true });

const files = fs.readdirSync(postsDir).filter((file) => file.endsWith(".md"));
let generated = 0;

for (const file of files) {
  const filePath = path.join(postsDir, file);
  const { raw, data, slug } = parseFrontmatter(filePath);
  const coverPath = `/images/covers/${slug}.svg`;
  const svg = buildCoverSvg({
    title: data.title,
    category: data.category,
    slug,
  });

  fs.writeFileSync(path.join(coversDir, `${slug}.svg`), svg, "utf8");
  fs.writeFileSync(filePath, upsertCoverFrontmatter(raw, coverPath), "utf8");
  generated += 1;
}

console.log(`Generated ${generated} covers in public/images/covers/`);

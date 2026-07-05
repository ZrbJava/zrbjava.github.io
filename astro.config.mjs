import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import rehypeSlug from "rehype-slug";
import rehypeMermaid from "rehype-mermaid";

const deployTarget = process.env.DEPLOY_TARGET;
const isGithubPages = deployTarget === "github";

const site =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://zrbjava.github.io");

const base = isGithubPages ? (process.env.GITHUB_PAGES_BASE ?? "/blog") : "/";

export default defineConfig({
  site,
  base,
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: unified({
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeMermaid,
          {
            strategy: "inline-svg",
            mermaidConfig: {
              theme: "neutral",
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            },
          },
        ],
      ],
    }),
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["mermaid"],
    },
    shikiConfig: {
      theme: "github-dark",
    },
  },
});

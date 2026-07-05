import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import rehypeSlug from "rehype-slug";
import rehypeMermaid from "rehype-mermaid";

export default defineConfig({
  site: "https://example.com",
  integrations: [mdx(), sitemap()],
  markdown: {
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
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["mermaid"],
    },
    shikiConfig: {
      theme: "github-dark",
    },
  },
});

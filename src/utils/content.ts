import type { CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"posts">;
export type Topic = CollectionEntry<"topics">;
export type Project = CollectionEntry<"projects">;

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function sortByDate<T extends { data: { pubDate: Date } }>(items: T[]) {
  return [...items].sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );
}

/** 技术栈展示优先级：AI > Vue > React > 小程序 > Electron > 其他 */
const TECH_PRIORITY = {
  ai: 0,
  vue: 1,
  react: 2,
  miniProgram: 3,
  electron: 4,
  other: 5,
} as const;

function postSearchText(post: Post) {
  const { category, tags, series } = post.data;
  return [category, series ?? "", ...tags, post.id].join(" ").toLowerCase();
}

export function getPostTechPriority(post: Post) {
  const text = postSearchText(post);
  const { category, tags, series } = post.data;

  const isAi =
    category.includes("AI") ||
    series?.includes("AI") ||
    /\b(ai|llm|rag|agent|mcp|gpt|embedding|vector)\b/.test(text) ||
    text.includes("ai 工程") ||
    text.includes("ai 应用") ||
    text.includes("ai 时代");

  const isVue =
    category === "Vue" ||
    series?.includes("Vue") ||
    tags.some((tag) => /vue|pinia|composition api/i.test(tag));

  const isReact =
    !text.includes("react native") &&
    (category === "React" ||
      series?.includes("React 工程") ||
      tags.some((tag) => tag === "React" || tag === "RSC" || tag === "Fiber"));

  const isMiniProgram =
    series?.includes("小程序") ||
    /\b(mini program|wechat|taro)\b/.test(text) ||
    text.includes("小程序") ||
    text.includes("微信");

  const isElectron =
    series?.includes("Electron") ||
    tags.some((tag) => /electron/i.test(tag)) ||
    text.includes("electron");

  if (isAi) return TECH_PRIORITY.ai;
  if (isVue) return TECH_PRIORITY.vue;
  if (isReact) return TECH_PRIORITY.react;
  if (isMiniProgram) return TECH_PRIORITY.miniProgram;
  if (isElectron) return TECH_PRIORITY.electron;
  return TECH_PRIORITY.other;
}

export function sortByTechPriority(posts: Post[]) {
  return [...posts].sort((a, b) => {
    const priorityDiff = getPostTechPriority(a) - getPostTechPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return b.data.pubDate.getTime() - a.data.pubDate.getTime();
  });
}

export function visiblePosts(posts: Post[]) {
  return sortByTechPriority(posts.filter((post) => !post.data.draft));
}

export function getReadingTime(body = "") {
  const words = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_\-[\]()`]/g, "")
    .trim().length;
  const minutes = Math.max(1, Math.ceil(words / 450));
  return `${minutes} min`;
}

export function getAllTags(posts: Post[]) {
  const tagMap = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }
  return [...tagMap.entries()].sort((a, b) => b[1] - a[1]);
}

function createTagSlug(tag: string) {
  return tag
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "");
}

export function tagToSlug(tag: string) {
  return createTagSlug(tag);
}

export function tagFromSlug(slug: string, tags: string[]) {
  const lookup = new Map(tags.map((tag) => [createTagSlug(tag), tag]));
  return lookup.get(slug) ?? slug;
}

export function getAllCategories(posts: Post[]) {
  const categoryMap = new Map<string, number>();
  for (const post of posts) {
    categoryMap.set(
      post.data.category,
      (categoryMap.get(post.data.category) ?? 0) + 1,
    );
  }
  return [...categoryMap.entries()].sort((a, b) => b[1] - a[1]);
}

export function getSeriesPosts(posts: Post[], seriesTitle: string) {
  return posts
    .filter((post) => post.data.series === seriesTitle)
    .sort((a, b) => a.data.pubDate.getTime() - b.data.pubDate.getTime());
}

export function getAdjacentInSeries(posts: Post[], current: Post) {
  if (!current.data.series) return { prev: null, next: null };
  const seriesPosts = getSeriesPosts(posts, current.data.series);
  const index = seriesPosts.findIndex((post) => post.id === current.id);
  return {
    prev: index > 0 ? seriesPosts[index - 1] : null,
    next:
      index >= 0 && index < seriesPosts.length - 1
        ? seriesPosts[index + 1]
        : null,
  };
}

export function getRelatedPosts(posts: Post[], current: Post, limit = 3) {
  const tagSet = new Set(current.data.tags);
  return posts
    .filter((post) => post.id !== current.id)
    .map((post) => ({
      post,
      score:
        post.data.tags.filter((tag) => tagSet.has(tag)).length +
        (post.data.category === current.data.category ? 1 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        getPostTechPriority(a.post) - getPostTechPriority(b.post) ||
        b.post.data.pubDate.getTime() - a.post.data.pubDate.getTime(),
    )
    .slice(0, limit)
    .map(({ post }) => post);
}

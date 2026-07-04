import type { CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"posts">;
export type Topic = CollectionEntry<"topics">;
export type Project = CollectionEntry<"projects">;

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function sortByDate<T extends { data: { pubDate: Date } }>(items: T[]) {
  return [...items].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export function visiblePosts(posts: Post[]) {
  return sortByDate(posts.filter((post) => !post.data.draft));
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

export function getAllCategories(posts: Post[]) {
  const categoryMap = new Map<string, number>();
  for (const post of posts) {
    categoryMap.set(post.data.category, (categoryMap.get(post.data.category) ?? 0) + 1);
  }
  return [...categoryMap.entries()].sort((a, b) => b[1] - a[1]);
}

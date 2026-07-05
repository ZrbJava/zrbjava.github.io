import GitHubSlugger from "github-slugger";

export interface TocHeading {
  level: 2 | 3;
  text: string;
  slug: string;
}

export interface TocItem {
  slug: string;
  text: string;
  children: TocItem[];
}

export function extractHeadings(markdown: string): TocHeading[] {
  const slugger = new GitHubSlugger();
  const headings: TocHeading[] = [];

  for (const line of markdown.split("\n")) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h2) {
      const text = stripMarkdown(h2[1]);
      headings.push({ level: 2, text, slug: slugger.slug(text) });
    } else if (h3) {
      const text = stripMarkdown(h3[1]);
      headings.push({ level: 3, text, slug: slugger.slug(text) });
    }
  }

  return headings;
}

export function buildTocTree(headings: TocHeading[]): TocItem[] {
  const tree: TocItem[] = [];
  let current: TocItem | null = null;

  for (const heading of headings) {
    const node: TocItem = {
      slug: heading.slug,
      text: heading.text,
      children: [],
    };
    if (heading.level === 2) {
      current = node;
      tree.push(node);
    } else if (current) {
      current.children.push(node);
    } else {
      tree.push(node);
    }
  }

  return tree;
}

function stripMarkdown(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

export function countTocSections(tree: TocItem[]) {
  return tree.length;
}

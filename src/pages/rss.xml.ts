import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { site } from "@/data/site";
import { sortByDate, visiblePosts } from "@/utils/content";
import { absoluteUrl } from "@/utils/url";

export async function GET() {
  const posts = sortByDate(visiblePosts(await getCollection("posts")));
  return rss({
    title: site.name,
    description: site.description,
    site: import.meta.env.SITE,
    xmlns: {
      atom: "http://www.w3.org/2005/Atom",
    },
    customData: `<atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml" />`,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: absoluteUrl(`/posts/${post.id}`),
      categories: [post.data.category, ...post.data.tags.slice(0, 5)],
    })),
  });
}

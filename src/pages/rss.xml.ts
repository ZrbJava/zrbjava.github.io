import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { site } from "@/data/site";
import { visiblePosts } from "@/utils/content";

export async function GET() {
  const posts = visiblePosts(await getCollection("posts"));
  return rss({
    title: site.name,
    description: site.description,
    site: site.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/posts/${post.id}`
    }))
  });
}

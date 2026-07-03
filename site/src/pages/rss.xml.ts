import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getSortedPosts, postUrl } from '../lib/blog';

export async function GET(context: APIContext) {
  const posts = await getSortedPosts();
  return rss({
    title: "Stefan Prodan's Blog",
    description: "Stefan Prodan's open source portfolio and tech blog.",
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postUrl(post),
      categories: post.data.categories,
    })),
  });
}

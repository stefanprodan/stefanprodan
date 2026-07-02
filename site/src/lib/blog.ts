import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export const POSTS_PER_PAGE = 5;

export async function getSortedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog');
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function postYear(post: Post): string {
  return String(post.data.date.getUTCFullYear());
}

export function postUrl(post: Post): string {
  return `/blog/${postYear(post)}/${post.data.slug}/`;
}

export function categorySlug(category: string): string {
  return category.toLowerCase();
}

/* Plain-text excerpt: body up to the mkdocs `<!-- more -->` marker,
   with markdown/HTML syntax stripped. */
export function postExcerpt(post: Post): string {
  const marker = post.body?.indexOf('<!-- more -->') ?? -1;
  const raw = marker > 0 ? post.body!.slice(0, marker) : (post.data.description ?? '');
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Social embed image: the first image in the body, or the thumbnail of the
   first YouTube embed for video posts. Returns undefined when neither exists. */
export function postSocialImage(post: Post): string | undefined {
  const body = post.body ?? '';
  const md = body.match(/!\[[^\]]*\]\(([^)\s]+)/);
  const html = body.match(/<img[^>]+src="([^"]+)"/);
  const candidates = [md, html]
    .filter((m): m is RegExpMatchArray => m !== null && m.index !== undefined)
    .sort((a, b) => a.index! - b.index!);
  if (candidates.length > 0) return candidates[0][1];
  const video = body.match(/youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)([\w-]+)|youtu\.be\/([\w-]+)/);
  if (video) return `https://i.ytimg.com/vi/${video[1] ?? video[2]}/hqdefault.jpg`;
  return undefined;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* Slice a sorted post list into /base/ + /base/page/N/ routes. */
export function paginatePosts(posts: Post[]) {
  const total = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  return Array.from({ length: total }, (_, i) => ({
    page: i + 1,
    total,
    posts: posts.slice(i * POSTS_PER_PAGE, (i + 1) * POSTS_PER_PAGE),
  }));
}

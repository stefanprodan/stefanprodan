import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, basename } from 'node:path';
import type { APIContext } from 'astro';
import { getSortedPosts, postYear } from '../../../../lib/blog';

/* Serves the original files colocated with a post (content/blog/<post>/) at
   /blog/<year>/<slug>/<file>, so the raw markdown endpoint can reference them.
   The rendered page keeps using the optimized /_astro/ builds. */

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export async function getStaticPaths() {
  const posts = await getSortedPosts();
  return posts
    .filter((post) => post.filePath && basename(post.filePath) === 'index.md')
    .flatMap((post) => {
      const dir = dirname(post.filePath!);
      return readdirSync(dir)
        .filter((file) => TYPES[extname(file).toLowerCase()])
        .map((file) => ({
          params: { year: postYear(post), slug: post.data.slug, file },
          props: { path: join(dir, file) },
        }));
    });
}

export function GET({ props, params }: APIContext) {
  return new Response(readFileSync(props.path), {
    headers: { 'Content-Type': TYPES[extname(params.file!).toLowerCase()] },
  });
}

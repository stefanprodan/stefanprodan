import type { APIContext } from 'astro';
import { getSortedPosts, postYear, formatDate } from '../../../lib/blog';

/* Raw markdown for AI agents: every post is also served at its URL with `.md`
   in place of the trailing slash, e.g. /blog/2026/some-post.md */

export async function getStaticPaths() {
  const posts = await getSortedPosts();
  return posts.map((post) => ({
    params: { year: postYear(post), slug: post.data.slug },
    props: { post },
  }));
}

export function GET({ props, site }: APIContext) {
  const { post } = props;
  /* Colocated files are served next to the page (see [slug]/[file].ts);
     point relative refs there, and make root-relative URLs absolute, so the
     markdown is self-contained when read outside a browser. */
  const postDir = `${site}blog/${postYear(post)}/${post.data.slug}/`;
  const body = (post.body ?? '')
    .replace(/(!\[[^\]]*\]\()(?:\.\/)?(?![a-z]+:|\/|#)/g, `$1${postDir}`)
    .replace(/(\]\()\/(?!\/)/g, `$1${site}`)
    .replace(/((?:src|href)=")\/(?!\/)/g, `$1${site}`);
  const doc = `# ${post.data.title}\n\n> ${post.data.description.trim()}.\n\nPublished: ${formatDate(post.data.date)}\n\n${body}`;
  return new Response(doc, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

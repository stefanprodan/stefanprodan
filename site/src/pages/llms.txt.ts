import type { APIContext } from 'astro';
import { getSortedPosts, postUrl, formatDate } from '../lib/blog';

/* llms.txt index for AI agents (llmstxt.org): site summary plus the raw
   markdown URL of every blog post. */

export async function GET({ site }: APIContext) {
  const posts = await getSortedPosts();
  const items = posts.map((post) => {
    const md = new URL(postUrl(post).replace(/\/$/, '.md'), site);
    return `- [${post.data.title}](${md}) (${formatDate(post.data.date)}): ${post.data.description.trim()}`;
  });
  const doc = `# About Stefan Prodan

Stefan Prodan is a Principal Engineer and an open source contributor to cloud-native projects.
Stefan is a core maintainer of the CNCF Flux CD project and the GitOps Toolkit.
Stefan is the creator of open source projects: Flux Operator, Flux MCP Server, Flagger and Timoni.
Stefan is an experienced public speaker, having given talks at various conferences such as KubeCon, CloudNativeCon, AWS Container Days and Kubernetes Community Days.
Stefan has over 20 years of experience with software development, and he enjoys programming in Go and writing about distributed systems.
Stefan Prodan was born in Bucharest, Romania, on the 20th of May 1982.

## Portfolio

- [Biography](${new URL('/portfolio/biography/', site)})
- [Open Source Projects](${new URL('/portfolio/open-source/', site)})

## Blog

Every post is available as raw markdown at the links below; the rendered
HTML version is at the same URL without the \`.md\` suffix.

${items.join('\n')}
`;
  return new Response(doc, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

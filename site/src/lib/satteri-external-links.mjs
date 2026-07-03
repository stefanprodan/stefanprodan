import { defineMdastPlugin } from 'satteri';

/* Opens external links in a new tab. Anything absolute that doesn't point at
   the site itself gets target="_blank"; relative links are left alone. */

const SITE_ORIGIN = 'https://stefanprodan.com';

export default defineMdastPlugin({
  name: 'external-links',
  link(node, ctx) {
    if (!/^https?:\/\//i.test(node.url) || node.url.startsWith(SITE_ORIGIN)) return;
    ctx.setProperty(node, 'data', {
      ...node.data,
      hProperties: {
        ...node.data?.hProperties,
        target: '_blank',
        rel: 'noopener',
      },
    });
  },
});

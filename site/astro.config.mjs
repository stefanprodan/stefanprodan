import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkEmbeds from './src/lib/remark-embeds.mjs';

export default defineConfig({
  site: 'https://stefanprodan.com',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkEmbeds],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});

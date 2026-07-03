import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkEmbeds from './src/lib/remark-embeds.mjs';

export default defineConfig({
  site: 'https://stefanprodan.com',
  integrations: [sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkEmbeds],
    }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});

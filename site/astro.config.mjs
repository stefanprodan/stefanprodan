import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import satteriEmbeds from './src/lib/satteri-embeds.mjs';

export default defineConfig({
  site: 'https://stefanprodan.com',
  integrations: [sitemap()],
  markdown: {
    processor: satteri({
      mdastPlugins: [satteriEmbeds],
    }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});

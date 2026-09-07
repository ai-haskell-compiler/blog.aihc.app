import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({
  site: 'https://blog.aihc.app',
  integrations: [sitemap()],
  trailingSlash: 'always',
  markdown: { shikiConfig: { themes: { light: 'github-light', dark: 'github-dark-dimmed' } } },
});

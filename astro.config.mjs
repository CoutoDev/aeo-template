// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import sitemap from '@astrojs/sitemap';

// SITE_URL vem do .env de cada instância (ver .env.example).
const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
});

// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Troque pelo dominio real de cada marca ao clonar este template.
const SITE_URL = 'https://torraalta.example.com';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
});

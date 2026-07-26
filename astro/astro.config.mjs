// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import sitemap from '@astrojs/sitemap';
import { isValidSiteUrl, SITE_URL_INVALID_MESSAGE } from './src/lib/site-url.ts';

// SITE_URL vem do .env de cada instância (ver .env.example).
const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

// Valor vazio (inclusive o truncado por um "#" sem aspas no .env) conta como
// ausente, mesma regra do schema de brand.ts. Como `site` é opcional, o build
// segue e brand.ts reporta a falta junto com o resto da config da marca.
const siteUrl = SITE_URL || undefined;

// Já um valor preenchido e inválido para aqui: o Astro validaria `site`
// sozinho, mas falha com um "Invalid URL" que não diz qual variável errou.
if (siteUrl && !isValidSiteUrl(siteUrl)) {
  throw new Error(`${SITE_URL_INVALID_MESSAGE}. Confira o .env da instância.`);
}

export default defineConfig({
  site: siteUrl,
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
});

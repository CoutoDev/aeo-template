// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import sitemap from '@astrojs/sitemap';
import { isValidSiteUrl, SITE_URL_INVALID_MESSAGE } from './src/lib/site-url.ts';

// .env vive na raiz do repo (compartilhado com o env_file: do docker-compose),
// não em astro/ (raiz do projeto Astro desde a separação astro/tina) — sem
// isso, tanto esta leitura quanto o import.meta.env exposto pelo Vite (ver
// "vite.envDir" abaixo) apontariam pra astro/.env, que nunca existe.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// SITE_URL vem do .env de cada instância (ver .env.example).
const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', repoRoot, '');

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
  vite: {
    // Mesma razão do "repoRoot" acima: sem isso, o Vite/Astro carregaria
    // .env de dentro de astro/ (raiz do projeto) em vez da raiz do repo, e
    // brand.ts/Header.astro (que leem import.meta.env direto) ficariam sem
    // nenhuma variável de marca em "npm run dev" fora do Docker.
    envDir: repoRoot,
  },
});

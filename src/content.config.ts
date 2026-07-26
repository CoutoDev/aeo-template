import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// O backend do Tina (ver tina/) grava "null" explícito no frontmatter pra
// qualquer campo opcional deixado em branco no formulário (em vez de
// simplesmente omitir a chave) — confirmado testando um mutation completo
// via GraphQL. z.optional() do zod só aceita "undefined", não "null": sem
// isso, um campo em branco vira erro de build (ex: author: null → "Expected
// type string, received object") ou, pior, um valor errado sem erro nenhum
// (updatedDate: null seria normalizado pra 1970-01-01 na serialização do
// Tina antes de chegar aqui). Trata null como ausente antes da validação.
function nullToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((data) => {
    if (!data || typeof data !== 'object') return data;
    const cleaned: Record<string, unknown> = { ...(data as Record<string, unknown>) };
    for (const key of Object.keys(cleaned)) {
      if (cleaned[key] === null) delete cleaned[key];
    }
    return cleaned;
  }, schema);
}

// Cada item de FAQ vira, automaticamente:
//  - um bloco visual "AnswerBlock" na pagina /faq
//  - uma entrada no schema.org FAQPage (JSON-LD)
//  - uma linha no llms.txt gerado no build
const faq = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faq' }),
  schema: nullToUndefined(
    z.object({
      question: z.string(),
      // Resposta curta e autocontida (1-3 frases) pensada para ser
      // extraida por agentes/LLMs sem precisar do resto da pagina.
      shortAnswer: z.string(),
      order: z.number().default(0),
    })
  ),
});

// Cada post vira uma pagina com Article schema + entrada no llms.txt.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    nullToUndefined(
      z.object({
        title: z.string(),
        description: z.string(),
        publishDate: z.date(),
        updatedDate: z.date().optional(),
        author: z.string().default('Equipe Editorial'),
        tags: z.array(z.string()).default([]),
        // Capa opcional. Arquivo de imagem ao lado do .md, referenciado por
        // caminho relativo no frontmatter (ex: cover: ./artigo-1-cover.jpg).
        // O Astro otimiza em build time (resize + reformat) via astro:assets
        // — não sobe o arquivo original pro dist, só as variantes geradas.
        cover: image().optional(),
        coverAlt: z.string().optional(),
      })
    ),
});

// Conteudo estrutural das paginas fixas (home, sobre, index de faq/jornal).
// O corpo Markdown vira a prosa (lede do hero, paragrafos da pagina "sobre");
// o frontmatter cobre os campos curtos (titulo, meta description, specs).
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: ({ image }) =>
    nullToUndefined(
      z.object({
        eyebrow: z.string().optional(),
        title: z.string(),
        heading: z.string().optional(),
        metaDescription: z.string(),
        specs: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
        // Banner hero opcional — mesmo padrão de "cover" em posts. Hoje só a
        // home usa, mas fica disponível pra qualquer página fixa.
        hero: image().optional(),
        heroAlt: z.string().optional(),
      })
    ),
});

export const collections = { faq, posts, pages };

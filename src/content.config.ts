import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Cada item de FAQ vira, automaticamente:
//  - um bloco visual "AnswerBlock" na pagina /faq
//  - uma entrada no schema.org FAQPage (JSON-LD)
//  - uma linha no llms.txt gerado no build
const faq = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faq' }),
  schema: z.object({
    question: z.string(),
    // Resposta curta e autocontida (1-3 frases) pensada para ser
    // extraida por agentes/LLMs sem precisar do resto da pagina.
    shortAnswer: z.string(),
    order: z.number().default(0),
  }),
});

// Cada post vira uma pagina com Article schema + entrada no llms.txt.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    updatedDate: z.date().optional(),
    author: z.string().default('Equipe Torra Alta'),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { faq, posts };

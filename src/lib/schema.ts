import type { CollectionEntry } from 'astro:content';
import { brand } from './brand';

// Blocos JSON-LD (schema.org) injetados no <head> por BaseLayout.astro. É a
// versão legível por máquina do que a página diz — motores de resposta usam
// isso para extrair a resposta e atribuir autoria.

/** Identidade da marca, repetida em todas as páginas. */
export function organizationSchema(siteUrl: URL | undefined) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    url: siteUrl?.toString(),
    description: brand.description,
    ...(brand.areaServed ? { areaServed: brand.areaServed } : {}),
  };
}

/** Pergunta + resposta curta de cada FAQ listado na página. */
export function faqPageSchema(faqs: CollectionEntry<'faq'>[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.data.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.data.shortAnswer },
    })),
  };
}

/** Metadados de um post do jornal (datas, autoria, capa). */
export function articleSchema(post: CollectionEntry<'posts'>, siteUrl: URL | undefined) {
  const { title, description, publishDate, updatedDate, cover, author } = post.data;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: publishDate.toISOString(),
    ...(updatedDate ? { dateModified: updatedDate.toISOString() } : {}),
    ...(cover ? { image: new URL(cover.src, siteUrl).toString() } : {}),
    author: { '@type': 'Person', name: author },
  };
}

import { getCollection, getEntry } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

// getEntry() na collection "pages" (carregada via glob()) não consegue provar
// em tempo de compilação que um id específico existe — o retorno inclui
// `| undefined`. Isso é real: se uma marca renomear/apagar um .md obrigatório
// (home/about/faq/jornal), a página quebra. Falha cedo com mensagem clara em
// vez de deixar o erro estourar mais abaixo em `.data`.
export async function getRequiredPage(id: string): Promise<CollectionEntry<'pages'>> {
  const entry = await getEntry('pages', id);
  if (!entry) {
    throw new Error(`Conteúdo obrigatório ausente: src/content/pages/${id}.md`);
  }
  return entry;
}

/** FAQs na ordem editorial definida pelo campo `order` do frontmatter. */
export async function getFaqsInOrder(): Promise<CollectionEntry<'faq'>[]> {
  const faqs = await getCollection('faq');
  return faqs.sort((a, b) => a.data.order - b.data.order);
}

/** Posts do mais recente para o mais antigo. */
export async function getPostsNewestFirst(): Promise<CollectionEntry<'posts'>[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
}

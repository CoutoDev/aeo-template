import { getEntry } from 'astro:content';
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

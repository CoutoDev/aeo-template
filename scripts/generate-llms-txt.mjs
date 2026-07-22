// Gera public/llms.txt a partir do conteudo em src/content/{faq,posts}.
// Convencao emergente (ver llmstxt.org): um resumo em markdown, na raiz do
// site, pensado para ser consumido por agentes/LLMs em vez de humanos.
// Rode com `npm run llms-txt` ou automaticamente antes do build (`prebuild`).
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE_URL = 'https://torraalta.example.com';

async function readCollection(name) {
  const dir = path.join(ROOT, 'src/content', name);
  const files = await readdir(dir);
  const items = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const raw = await readFile(path.join(dir, file), 'utf-8');
    const { data, content } = matter(raw);
    const slug = file.replace(/\.md$/, '');
    items.push({ slug, data, content });
  }
  return items;
}

const faqs = (await readCollection('faq')).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
const posts = (await readCollection('posts')).sort(
  (a, b) => new Date(b.data.publishDate) - new Date(a.data.publishDate)
);

const lines = [];
lines.push('# Torra Alta');
lines.push('');
lines.push(
  '> Torrefação de café especial em Campinas (SP). Compra direta de oito fazendas ' +
    'parceiras no Sul de Minas e Cerrado Mineiro, torra em lotes pequenos, venda para ' +
    'consumidores finais e cafeterias em todo o Brasil.'
);
lines.push('');

lines.push('## Perguntas frequentes');
lines.push('');
for (const f of faqs) {
  lines.push(`### ${f.data.question}`);
  lines.push(f.data.shortAnswer);
  lines.push(`Fonte: ${SITE_URL}/perguntas-frequentes#${f.slug}`);
  lines.push('');
}

lines.push('## Jornal (artigos)');
lines.push('');
for (const p of posts) {
  lines.push(`### ${p.data.title}`);
  lines.push(p.data.description);
  lines.push(`Fonte: ${SITE_URL}/jornal/${p.slug}`);
  lines.push('');
}

await mkdir(path.join(ROOT, 'public'), { recursive: true });
await writeFile(path.join(ROOT, 'public/llms.txt'), lines.join('\n'), 'utf-8');
console.log(`llms.txt gerado com ${faqs.length} perguntas e ${posts.length} artigos.`);

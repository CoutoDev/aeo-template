// Gera public/llms.txt a partir do conteudo em src/content/{faq,posts}.
// Convencao emergente (ver llmstxt.org): um resumo em markdown, na raiz do
// site, pensado para ser consumido por agentes/LLMs em vez de humanos.
// Rode com `npm run llms-txt` ou automaticamente antes do build (`prebuild`).
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

// Roda como processo Node isolado (fora do Vite), então precisa carregar o
// .env explicitamente. Em Docker/produção as vars já vêm do ambiente real,
// então a ausência de um arquivo .env é esperada e ignorada.
try {
  process.loadEnvFile();
} catch {
  // sem .env local — assume que as vars já estão no ambiente
}

const ROOT = new URL('..', import.meta.url).pathname;
const { SITE_NAME, SITE_URL, SITE_DESCRIPTION } = process.env;

for (const [key, value] of Object.entries({ SITE_NAME, SITE_URL, SITE_DESCRIPTION })) {
  if (!value) {
    throw new Error(`${key} não definida — configure o .env da instância (ver .env.example).`);
  }
}

/** Lê o frontmatter de todos os .md de uma collection. */
async function readCollection(name) {
  const dir = path.join(ROOT, 'src/content', name);
  const files = await readdir(dir);
  const items = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const raw = await readFile(path.join(dir, file), 'utf-8');
    const slug = file.replace(/\.md$/, '');
    items.push({ slug, data: matter(raw).data });
  }
  return items;
}

/** Bloco "## Titulo" seguido de uma entrada por item: titulo, resumo, fonte. */
function section(heading, entries) {
  return [
    `## ${heading}`,
    '',
    ...entries.flatMap(({ title, summary, source }) => [
      `### ${title}`,
      summary,
      `Fonte: ${source}`,
      '',
    ]),
  ];
}

const faqs = (await readCollection('faq')).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
const posts = (await readCollection('posts')).sort(
  (a, b) => new Date(b.data.publishDate) - new Date(a.data.publishDate)
);

const llmsTxt = [
  `# ${SITE_NAME}`,
  '',
  `> ${SITE_DESCRIPTION}`,
  '',
  ...section(
    'Perguntas frequentes',
    faqs.map((faq) => ({
      title: faq.data.question,
      summary: faq.data.shortAnswer,
      source: `${SITE_URL}/perguntas-frequentes#${faq.slug}`,
    }))
  ),
  ...section(
    'Jornal (artigos)',
    posts.map((post) => ({
      title: post.data.title,
      summary: post.data.description,
      source: `${SITE_URL}/jornal/${post.slug}`,
    }))
  ),
].join('\n');

await mkdir(path.join(ROOT, 'public'), { recursive: true });
await writeFile(path.join(ROOT, 'public/llms.txt'), llmsTxt, 'utf-8');
console.log(`llms.txt gerado com ${faqs.length} perguntas e ${posts.length} artigos.`);

#!/usr/bin/env node
// Scaffolder de instancias de marca. Copia a raiz deste pacote para um novo
// diretorio e gera o .env daquela instancia. Sem dependencias externas —
// so modulos nativos do Node (>=22, ja exigido em package.json#engines).
import { parseArgs } from 'node:util';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const COPY_EXCLUDE = new Set([
  'node_modules',
  'dist',
  '.astro',
  '.git',
  '.env',
  '.env.production',
  'package-lock.json',
  'cli',
]);

function printUsage() {
  console.log(`Uso: npx create-brand-site <diretorio> [opcoes]

Opcoes:
  --site-name <nome>      Nome da marca (ex: "Minha Marca")
  --site-url <url>        URL canonica (ex: https://minhamarca.com.br)
  --description <texto>   Descricao curta da marca
  --location <texto>      Localizacao (opcional, ex: "Campinas, SP")
  --locale <locale>       Locale (default: pt-BR)
  --dev-port <porta>      Porta do docker compose "dev" (default: 4321)
  --web-port <porta>      Porta do docker compose "prod" (default: 8080)

Campos obrigatorios nao passados via flag sao pedidos interativamente.`);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'site-name': { type: 'string' },
    'site-url': { type: 'string' },
    description: { type: 'string' },
    location: { type: 'string' },
    locale: { type: 'string' },
    'dev-port': { type: 'string' },
    'web-port': { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  printUsage();
  process.exit(0);
}

const targetDirName = positionals[0];
if (!targetDirName) {
  printUsage();
  process.exit(1);
}

const targetDir = path.resolve(process.cwd(), targetDirName);
if (existsSync(targetDir)) {
  console.error(`Erro: ${targetDir} já existe.`);
  process.exit(1);
}

async function prompt(rl, question, fallback) {
  const suffix = fallback ? ` (${fallback})` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback || '';
}

async function collectAnswers() {
  const needsPrompt = !values['site-name'] || !values['site-url'] || !values.description;
  if (!needsPrompt) {
    return {
      siteName: values['site-name'],
      siteUrl: values['site-url'],
      description: values.description,
      location: values.location ?? '',
      locale: values.locale ?? 'pt-BR',
      devPort: values['dev-port'] ?? '4321',
      webPort: values['web-port'] ?? '8080',
    };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const siteName = values['site-name'] ?? (await prompt(rl, 'Nome da marca'));
    const siteUrl = values['site-url'] ?? (await prompt(rl, 'URL do site (ex: https://minhamarca.com.br)'));
    const description = values.description ?? (await prompt(rl, 'Descrição curta da marca'));
    const location = values.location ?? (await prompt(rl, 'Localização (opcional)'));
    const locale = values.locale ?? (await prompt(rl, 'Locale', 'pt-BR'));
    const devPort = values['dev-port'] ?? (await prompt(rl, 'Porta do docker compose "dev"', '4321'));
    const webPort = values['web-port'] ?? (await prompt(rl, 'Porta do docker compose "prod"', '8080'));
    return { siteName, siteUrl, description, location, locale, devPort, webPort };
  } finally {
    rl.close();
  }
}

function slugify(input) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

const answers = await collectAnswers();
if (!answers.siteName || !answers.siteUrl || !answers.description) {
  console.error('Erro: nome, URL e descrição da marca são obrigatórios.');
  process.exit(1);
}

await cp(PACKAGE_ROOT, targetDir, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(PACKAGE_ROOT, src);
    if (rel === '') return true;
    const top = rel.split(path.sep)[0];
    return !COPY_EXCLUDE.has(top);
  },
});

const envContent = `SITE_NAME=${answers.siteName}
SITE_URL=${answers.siteUrl}
SITE_DESCRIPTION=${answers.description}
SITE_LOCATION=${answers.location}
SITE_LOCALE=${answers.locale}
DEV_PORT=${answers.devPort}
WEB_PORT=${answers.webPort}
`;
await writeFile(path.join(targetDir, '.env'), envContent, 'utf-8');

const pkgPath = path.join(targetDir, 'package.json');
const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
pkg.name = slugify(answers.siteName) || 'brand-site';
delete pkg.bin;
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

console.log(`\n✓ Instância "${answers.siteName}" criada em ${targetDir}`);
console.log(`\nPróximos passos:
  cd ${targetDirName}
  npm install
  npm run dev                        # dev local
  docker compose --profile dev up    # dev em container
  docker compose --profile prod up   # build + serve estático via nginx
`);

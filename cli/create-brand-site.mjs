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
  // Infra da VPS (proxy reverso Traefik compartilhado entre marcas), não de
  // uma instância — roda uma vez por VPS, não é duplicada por marca. Ver
  // traefik/README.md.
  'traefik',
]);

const DEFAULTS = {
  locale: 'pt-BR',
  devPort: '4321',
  webPort: '8080',
};

function printUsage() {
  console.log(`Uso: npx create-brand-site <diretorio> [opcoes]

Opcoes:
  --site-name <nome>      Nome da marca (ex: "Minha Marca")
  --site-url <url>        URL canonica (ex: https://minhamarca.com.br)
  --description <texto>   Descricao curta da marca
  --location <texto>      Localizacao (opcional, ex: "Campinas, SP")
  --locale <locale>       Locale (default: ${DEFAULTS.locale})
  --dev-port <porta>      Porta do docker compose "dev" (default: ${DEFAULTS.devPort})
  --web-port <porta>      Porta do docker compose "prod" (default: ${DEFAULTS.webPort})
  --domain <dominio>      Dominio publico (ex: minhamarca.com.br), usado
                          pelo Traefik compartilhado (ver traefik/README.md).
                          Default: extraido de --site-url.

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
    domain: { type: 'string' },
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

function domainFromUrl(siteUrl) {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return '';
  }
}

// Flags da linha de comando com os nomes usados no resto do script.
const flags = {
  siteName: values['site-name'],
  siteUrl: values['site-url'],
  description: values.description,
  location: values.location,
  locale: values.locale,
  devPort: values['dev-port'],
  webPort: values['web-port'],
  domain: values.domain,
};

// Só os campos obrigatórios disparam o modo interativo; o resto cai no default.
async function collectAnswers() {
  const hasRequiredFlags = flags.siteName && flags.siteUrl && flags.description;
  if (hasRequiredFlags) {
    return {
      ...flags,
      location: flags.location ?? '',
      locale: flags.locale ?? DEFAULTS.locale,
      devPort: flags.devPort ?? DEFAULTS.devPort,
      webPort: flags.webPort ?? DEFAULTS.webPort,
      domain: flags.domain ?? domainFromUrl(flags.siteUrl),
    };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const siteName = flags.siteName ?? (await prompt(rl, 'Nome da marca'));
    const siteUrl = flags.siteUrl ?? (await prompt(rl, 'URL do site (ex: https://minhamarca.com.br)'));
    const description = flags.description ?? (await prompt(rl, 'Descrição curta da marca'));
    const location = flags.location ?? (await prompt(rl, 'Localização (opcional)'));
    const locale = flags.locale ?? (await prompt(rl, 'Locale', DEFAULTS.locale));
    const devPort = flags.devPort ?? (await prompt(rl, 'Porta do docker compose "dev"', DEFAULTS.devPort));
    const webPort = flags.webPort ?? (await prompt(rl, 'Porta do docker compose "prod"', DEFAULTS.webPort));
    const domain = flags.domain ?? (await prompt(rl, 'Domínio público (Traefik)', domainFromUrl(siteUrl)));
    return { siteName, siteUrl, description, location, locale, devPort, webPort, domain };
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

/** Copia o template para a nova instância, pulando o que é do repo/pacote. */
async function copyTemplate() {
  await cp(PACKAGE_ROOT, targetDir, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(PACKAGE_ROOT, src);
      if (rel === '') return true;
      const topLevelName = rel.split(path.sep)[0];
      return !COPY_EXCLUDE.has(topLevelName);
    },
  });
}

async function writeEnvFile(answers, slug) {
  const content = `SITE_NAME=${answers.siteName}
SITE_URL=${answers.siteUrl}
SITE_DESCRIPTION=${answers.description}
SITE_LOCATION=${answers.location}
SITE_LOCALE=${answers.locale}
DEV_PORT=${answers.devPort}
WEB_PORT=${answers.webPort}

# Usados pelo proxy compartilhado (Traefik) quando esta marca roda numa VPS
# com outras marcas — ver traefik/README.md no template. BRAND_SLUG precisa
# ser único entre as marcas que compartilham a mesma VPS/Traefik.
DOMAIN=${answers.domain}
BRAND_SLUG=${slug}
`;
  await writeFile(path.join(targetDir, '.env'), content, 'utf-8');
}

/** Renomeia o package.json para a marca e devolve a versão do template. */
async function personalizePackageJson(slug) {
  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  const templateVersion = pkg.version;
  pkg.name = slug;
  delete pkg.bin;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  return templateVersion;
}

// Ancora a versão do template usada na criação desta instância. Não
// implementa update nenhum agora — só evita que uma futura ferramenta de
// atualização (diff rastreado ou split em pacote npm) precise de outra
// migração de formato para saber "a partir de onde" atualizar.
async function writeTemplateVersion(templateVersion) {
  const content =
    JSON.stringify({ template: 'create-brand-site', version: templateVersion }, null, 2) + '\n';
  await writeFile(path.join(targetDir, '.template-version'), content, 'utf-8');
}

function printNextSteps(siteName) {
  console.log(`\n✓ Instância "${siteName}" criada em ${targetDir}`);
  console.log(`\nPróximos passos:
  cd ${targetDirName}
  npm install
  npm run dev                        # dev local
  docker compose --profile dev up    # dev em container
  docker compose --profile prod up   # build + serve estático via nginx

Rodando várias marcas na mesma VPS atrás do proxy compartilhado (Traefik)?
Ver traefik/README.md no template — precisa de "docker network create edge"
uma única vez por VPS antes do primeiro "docker compose --profile prod up".
`);
}

const answers = await collectAnswers();
if (!answers.siteName || !answers.siteUrl || !answers.description) {
  console.error('Erro: nome, URL e descrição da marca são obrigatórios.');
  process.exit(1);
}

const slug = slugify(answers.siteName) || 'brand-site';

await copyTemplate();
await writeEnvFile(answers, slug);
await writeTemplateVersion(await personalizePackageJson(slug));
printNextSteps(answers.siteName);

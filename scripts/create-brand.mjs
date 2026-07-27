#!/usr/bin/env node
// Gera um repositório mínimo de deploy pra uma instância de marca nova:
// docker-compose.yml (aponta pra imagem publicada) + .env preenchido, sem
// copiar o template inteiro — ver README, "Provisionar uma marca nova". O
// diretório de saída é pra virar o repo/servidor da marca, não fica dentro
// deste checkout. Também popula (git push) o repositório de CONTEUDO
// (--content-repo-url, um repo GitHub separado) com o exemplo de
// templates/brand-content-example/ na primeira vez — ver bootstrapContent().
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FLAGS = [
  'site-name',
  'site-url',
  'site-description',
  'domain',
  'brand-slug',
  'content-repo-url',
];

function usage(missing = []) {
  const lines = [
    'Uso: node scripts/create-brand.mjs <diretorio-saida> [opções]',
    '',
    'Obrigatórias:',
    '  --site-name <str>           SITE_NAME',
    '  --site-url <url>            SITE_URL',
    '  --site-description <str>    SITE_DESCRIPTION',
    '  --domain <dominio>          DOMAIN',
    '  --brand-slug <slug>         BRAND_SLUG',
    '  --content-repo-url <url>    CONTENT_REPO_URL',
    '',
    'Opcionais:',
    '  --content-repo-token <tok>  CONTENT_REPO_TOKEN (só se o repo for privado)',
    '  --image-tag <tag>           default: sha-<HEAD atual deste checkout>',
    '  --force                     sobrescreve <diretorio-saida> se não estiver vazio',
    '',
    'Exemplo:',
    '  node scripts/create-brand.mjs ../minha-marca \\',
    '    --site-name "Minha Marca" --site-url "https://minhamarca.com" \\',
    '    --site-description "Descrição curta da marca." \\',
    '    --domain minhamarca.com --brand-slug minha-marca \\',
    '    --content-repo-url git@github.com:org/minha-marca-conteudo.git',
  ];
  if (missing.length) lines.unshift(`Faltando: ${missing.join(', ')}\n`);
  console.error(lines.join('\n'));
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    if (arg === '--force') {
      flags.force = true;
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      flags[arg.slice(2)] = argv[++i];
    }
  }
  return { positional, flags };
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: 'pipe',
    // Sem terminal interativo: um repo privado sem token (ou token sem
    // permissão) precisa falhar na hora, não travar pedindo usuário/senha no
    // stdin — mesma classe de sintoma documentada no README pro entrypoint.sh.
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
}

function authHeaderArgs(token) {
  if (!token) return [];
  const header = `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
  return ['-c', `http.extraHeader=${header}`];
}

// Popula CONTENT_REPO_URL com o conteúdo de exemplo (templates/brand-content-example/)
// na primeira vez: sem isso, um repositório recém-criado no GitHub (vazio, sem
// commits) faz o entrypoint.sh do container falhar no boot logo no primeiro
// `git rev-parse HEAD` do conteúdo clonado. Se o repo já tiver qualquer commit,
// não mexe em nada — nunca sobrescreve conteúdo real de uma marca já em produção.
// Retorna 'populated' | 'already-had-content' | 'failed'.
function bootstrapContent(contentRepoUrl, token) {
  const authArgs = authHeaderArgs(token);
  const tmpDir = mkdtempSync(join(tmpdir(), 'brand-engine-content-'));
  try {
    git([...authArgs, 'clone', '--quiet', contentRepoUrl, tmpDir]);

    try {
      git(['-C', tmpDir, 'rev-parse', 'HEAD']);
      console.log(`Repositório de conteúdo (${contentRepoUrl}) já tem commits — não mexi nele.`);
      return 'already-had-content';
    } catch {
      // Repo clonado com sucesso mas sem nenhum commit ainda — cai pro bootstrap abaixo.
    }

    for (const sub of ['pages', 'faq', 'posts']) {
      cpSync(join(REPO_ROOT, 'templates/brand-content-example', sub), join(tmpDir, sub), {
        recursive: true,
      });
    }

    git(['-C', tmpDir, 'add', '-A']);
    git([
      '-C',
      tmpDir,
      '-c',
      'user.name=brand-engine',
      '-c',
      'user.email=brand-engine@localhost',
      'commit',
      '--quiet',
      '-m',
      'Conteúdo inicial (a partir de templates/brand-content-example/)',
    ]);

    const branch = git(['-C', tmpDir, 'symbolic-ref', '--short', 'HEAD']).trim();
    git([...authArgs, '-C', tmpDir, 'push', '--quiet', '-u', 'origin', 'HEAD']);

    console.log(`Conteúdo de exemplo empurrado pra ${contentRepoUrl} (branch "${branch}").`);
    if (branch !== 'main') {
      console.warn(
        `AVISO: branch padrão do repo de conteúdo é "${branch}", não "main" — defina ` +
          `CONTENT_REPO_BRANCH="${branch}" no .env gerado (tina/database.ts usa "main" como default).`,
      );
    }
    return 'populated';
  } catch (err) {
    console.error(`\nAVISO: não consegui popular o repositório de conteúdo (${contentRepoUrl}) automaticamente:`);
    console.error(err.stderr?.toString() || err.message);
    console.error(
      'Confirme que o repositório existe (crie um repo GitHub vazio primeiro, "create-brand" não cria ' +
        'repositórios remotos) e que --content-repo-token (se privado) tem permissão de leitura+escrita em ' +
        '"Contents". Pra popular manualmente:\n' +
        `  git clone ${contentRepoUrl} conteudo-temp\n` +
        '  cp -r templates/brand-content-example/{pages,faq,posts} conteudo-temp/\n' +
        '  cd conteudo-temp && git add -A && git commit -m "Conteúdo inicial" && git push',
    );
    return 'failed';
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function applyEnvReplacements(template, replacements) {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    if (value.includes('"')) {
      throw new Error(`Valor de ${key} não pode conter aspas duplas: ${value}`);
    }
    result = result.replace(new RegExp(`^${key}="[^"]*"$`, 'm'), `${key}="${value}"`);
  }
  return result;
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const outputArg = positional[0];

if (!outputArg) {
  usage(['<diretorio-saida>']);
  process.exit(1);
}

const missing = REQUIRED_FLAGS.filter((f) => !flags[f]);
if (missing.length) {
  usage(missing.map((f) => `--${f}`));
  process.exit(1);
}

const outDir = resolve(process.cwd(), outputArg);
if (existsSync(outDir) && readdirSync(outDir).length > 0 && !flags.force) {
  console.error(`"${outDir}" já existe e não está vazio. Use --force pra sobrescrever.`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

// Sem uma tag vX.Y.Z publicada (o CI só cria tags semver quando uma tag git
// "vX.Y.Z" é empurrada — ver ci.yml), todo push pro main publica só "latest"
// e "sha-<commit>". "latest" é flutuante (README recomenda não fixar nela —
// rollback fica impossível sem editar o compose primeiro), então o default
// aqui é o sha de origin/main, NÃO o HEAD local: CI só builda o que foi
// empurrado, e um checkout com commits locais não empurrados (comum em dev)
// geraria uma tag "sha-<commit>" que ainda não existe no GHCR — pull falharia
// com 403/"not found" indistinguível de erro de autenticação (ver README,
// "Autenticação no GHCR"). Mesmo assim, ainda depende do job "publish" do CI
// já ter terminado com sucesso pra esse commit — confirme antes do pull.
let originSha;
try {
  originSha = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
} catch {
  originSha = null;
}
const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
if (!flags['image-tag'] && originSha && originSha !== headSha) {
  console.warn(
    `Aviso: HEAD deste checkout (${headSha}) difere de origin/main (${originSha}) — ` +
      'usando origin/main pro default de --image-tag, já que só commits empurrados têm imagem publicada. ' +
      'Rode `git fetch origin main` antes se origin/main local puder estar desatualizado.',
  );
}
const resolvedSha = originSha || headSha;
const imageTag = flags['image-tag'] || `sha-${resolvedSha}`;
if (!flags['image-tag']) {
  console.warn(
    `Sem --image-tag: usando sha-${resolvedSha}. ` +
      'Confirme que o job "publish" do CI publicou essa tag antes de rodar `docker compose pull` de verdade.',
  );
}

let compose = readFileSync(join(REPO_ROOT, 'docker-compose.example.yml'), 'utf8');
compose = compose.replace(
  /image: ghcr\.io\/brand-engine\/brand-engine:\S+/,
  `image: ghcr.io/brand-engine/brand-engine:${imageTag}`,
);
writeFileSync(join(outDir, 'docker-compose.yml'), compose);

const envReplacements = {
  SITE_NAME: flags['site-name'],
  SITE_URL: flags['site-url'],
  SITE_DESCRIPTION: flags['site-description'],
  DOMAIN: flags['domain'],
  BRAND_SLUG: flags['brand-slug'],
  CONTENT_REPO_URL: flags['content-repo-url'],
};
if (flags['content-repo-token']) {
  envReplacements.CONTENT_REPO_TOKEN = flags['content-repo-token'];
}

const envExampleSrc = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
const env = applyEnvReplacements(envExampleSrc, envReplacements);
writeFileSync(join(outDir, '.env'), env);

// .env.example commitável: mesmos valores, com os dois segredos reais
// sempre em branco — é o que deixa o repo da marca autossuficiente (alguém
// clona, roda `cp .env.example .env`, só preenche os segredos de verdade).
const envExample = applyEnvReplacements(env, {
  CONTENT_REPO_TOKEN: '',
  TINA_ADMIN_PASSWORD_HASH: '',
});
writeFileSync(join(outDir, '.env.example'), envExample);

writeFileSync(join(outDir, '.gitignore'), '.env\n');

const readme = `# ${flags['site-name']}

Repositório de deploy desta marca — instância do template
[brand-engine](https://github.com/brand-engine/brand-engine) rodando a
imagem publicada. Não contém código do site: Astro/Nginx/Tina vêm de
\`ghcr.io/brand-engine/brand-engine:${imageTag}\` (ver \`docker-compose.yml\`);
o conteúdo (Markdown) vem de \`${flags['content-repo-url']}\`, clonado em
runtime pelo container (ver \`entrypoint.sh\` no template).

## Subir a instância

Pré-requisito (uma vez por VPS, não por marca): rede \`edge\` do Traefik — ver
README do template, "Múltiplas marcas na mesma VPS".

\`\`\`bash
# TINA_ADMIN_PASSWORD_HASH: gere com um container descartável da própria
# imagem desta instância (o script já vem empacotado nela — não precisa do
# container já estar de pé, nem de um checkout do template):
docker compose run --rm --entrypoint node web tina/scripts/hash-tina-password.mjs "senha-desta-marca"

# Preencha os segredos que não vêm neste repo (.env não é commitado):
#   CONTENT_REPO_TOKEN       — se o repo de conteúdo for privado ou for usar /admin
#   TINA_ADMIN_PASSWORD_HASH — o hash gerado acima
$EDITOR .env

docker compose pull
docker compose up -d
\`\`\`

## Atualizar / rollback

Troque a tag da imagem em \`docker-compose.yml\` (linha \`image:\`) pra outra
tag publicada (\`latest\`, \`sha-<commit>\` ou \`X.Y.Z\` se o template tiver
publicado uma release semver) e rode \`docker compose pull && docker compose
up -d\`. O volume \`data\` (conteúdo clonado, banco do Tina) sobrevive à
troca. Ver README do template, "Atualizar o template" / "Rollback".
`;
writeFileSync(join(outDir, 'README.md'), readme);

console.log(`Gerado em ${outDir}:`);
console.log('  docker-compose.yml');
console.log('  .env');
console.log('  .env.example');
console.log('  .gitignore');
console.log('  README.md');

console.log(`\nPopulando repositório de conteúdo (${flags['content-repo-url']})...`);
const contentStatus = bootstrapContent(flags['content-repo-url'], flags['content-repo-token']);
if (contentStatus === 'failed') process.exitCode = 1;

try {
  execFileSync('docker', ['compose', '-f', join(outDir, 'docker-compose.yml'), 'config'], {
    cwd: outDir,
    stdio: 'pipe',
  });
  console.log('\n`docker compose config` validou o compose file + .env.');
} catch (err) {
  console.error('\nAVISO: `docker compose config` falhou — confira docker-compose.yml/.env antes de usar:');
  console.error(err.stderr?.toString() || err.message);
  process.exitCode = 1;
}

const contentStep =
  contentStatus === 'failed'
    ? '2. O repositório de conteúdo NÃO foi populado (ver AVISO acima) — crie um\n' +
      '   repositório GitHub vazio em --content-repo-url e rode este comando de novo\n' +
      '   (ou popule manualmente, ver instruções no AVISO acima).'
    : '2. Repositório de conteúdo OK (já tinha commits ou foi populado com o\n' +
      '   exemplo de templates/brand-content-example/ agora).';

console.log(`
Próximos passos:
1. Confirme que a tag da imagem (${imageTag}) foi publicada de verdade
   (gh run list --repo brand-engine/brand-engine, ou o pacote em
   https://github.com/brand-engine/brand-engine/pkgs/container/brand-engine).
${contentStep}
3. Preencha CONTENT_REPO_TOKEN (se o repo de conteúdo for privado ou for usar
   /admin) e TINA_ADMIN_PASSWORD_HASH em ${join(outDir, '.env')} — gere o hash com:
   docker compose run --rm --entrypoint node web tina/scripts/hash-tina-password.mjs "senha-desta-marca"
4. cd ${outDir} && git init && git add -A && git commit -m "Instância inicial"
   (revise o que está sendo commitado antes — .env já está no .gitignore).`);

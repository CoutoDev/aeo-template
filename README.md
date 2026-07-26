# brand-engine

Template Astro agnóstico de marca, focado em AEO/SEO (JSON-LD, `llms.txt`,
respostas diretas extraíveis por agentes/LLMs). A identidade de cada marca
(nome, domínio, descrição, cores) vem de variáveis de ambiente; o conteúdo
longo (hero, "sobre", FAQ, posts) vive como Markdown em `src/content/`.

Este repositório é o **template**: uma única imagem Docker genérica
(`brand-engine`), sem conteúdo de nenhuma marca embutido. Cada marca é uma
**instância** — um container isolado rodando essa mesma imagem, com seu
próprio `.env` e seu próprio repositório de conteúdo (Markdown/imagens),
clonado em runtime. Não existe mais um scaffold que copia este repo por
marca — atualizar o template passa a ser "publicar uma nova tag da imagem e
reiniciar as instâncias", não "reconciliar uma cópia".

## Como uma instância sobe

`entrypoint.sh` roda a cada boot do container e, nesta ordem:

1. Valida as variáveis de ambiente obrigatórias (ver `.env.example`).
2. Clona o repositório de conteúdo da marca (`CONTENT_REPO_URL`) num volume
   persistente.
3. Compara o commit clonado + a versão do template contra o último build
   feito (um "carimbo" salvo no mesmo volume). Se nada mudou, pula direto
   pra servir o build existente — boot rápido. Se mudou (conteúdo novo,
   primeiro boot da marca, ou upgrade de imagem), roda `astro build`.
4. Sobe o Nginx servindo o build.

Se um build falhar (ex: um commit de conteúdo com frontmatter inválido), a
instância continua no ar servindo o último build válido, e tenta de novo no
próximo boot — um commit quebrado não derruba o site.

## Provisionar uma marca nova

Passos únicos ao lançar uma marca (não se repetem em updates — ver
"Atualizar o template" abaixo):

1. **Repositório de conteúdo**: crie um repositório GitHub novo pra marca e
   comece a partir de
   [`templates/brand-content-example/`](templates/brand-content-example) —
   copie `pages/`, `faq/`, `posts/` pra **raiz** desse repo novo (não
   aninhado em `src/content/`; é assim que o backend do Tina espera, ver
   `tina/schema.ts`).
2. **Token do GitHub**: gere um fine-grained Personal Access Token (ou deploy
   key) com escopo restrito a esse repositório único, permissão de
   leitura+escrita em "Contents" — nunca um token amplo de organização (ver
   `CONTENT_REPO_TOKEN` em `.env.example`). Só é necessário se a marca vai
   editar pelo `/admin`; clone/leitura funcionam sem ele.
3. **Senha do `/admin`**: gere o hash com
   `node scripts/hash-tina-password.mjs "senha-da-marca"` e preencha
   `TINA_ADMIN_USER`/`TINA_ADMIN_PASSWORD_HASH` no passo seguinte.
4. **`.env`**: `cp .env.example .env` e preencha `SITE_*`, `DOMAIN`,
   `BRAND_SLUG`, `CONTENT_REPO_URL` (+ `CONTENT_REPO_TOKEN` se for usar o
   `/admin`), `TINA_ADMIN_*`.
5. **Suba a instância**: no repositório/servidor da marca (não neste
   template), use [`docker-compose.example.yml`](docker-compose.example.yml)
   como `docker-compose.yml` e rode `docker compose up -d`. O primeiro boot
   roda o `astro build` completo (mais lento que os restarts seguintes — ver
   "Como uma instância sobe" acima).

## Rodar uma instância (dev deste template)

```bash
cp .env.example .env   # preencher SITE_*, CONTENT_REPO_URL, etc.
docker compose --profile prod up -d
```

| Comando | Ação |
| --- | --- |
| `docker compose --profile dev up` | Dev com hot-reload em container (conteúdo de exemplo, sem clone) |
| `docker compose --profile prod up -d` | Sobe a instância: clona o conteúdo real da marca e serve via Nginx |

Localmente, fora de Docker, `npm run dev` / `npm run build` usam o conteúdo
de exemplo em [`templates/brand-content-example/`](templates/brand-content-example)
(symlinkado em `src/content` automaticamente por
`scripts/ensure-example-content.mjs` — ver `predev`/`prebuild` em
`package.json`). Esse conteúdo de exemplo nunca entra na imagem Docker (ver
`.dockerignore`); numa instância real ele é substituído pelo clone do
repositório da marca.

## Variáveis de ambiente

[`.env.example`](.env.example) lista todas as variáveis e seus defaults.
Obrigatórias: `SITE_NAME`, `SITE_URL`, `SITE_DESCRIPTION`, `BRAND_SLUG`,
`CONTENT_REPO_URL`. O resto — localização, locale, paleta de cores, portas —
tem default ou é opcional. Sem nenhuma `THEME_*`, o site usa o tema padrão do
template: o primeiro preset de
[`src/lib/brand-presets.ts`](src/lib/brand-presets.ts). Cada `THEME_*`
definida sobrescreve só aquele token.

Diferente de um site puramente estático, essas variáveis são lidas em
**runtime dentro do container** (`docker-compose.yml` injeta o `.env` via
`env_file`, e é isso que `entrypoint.sh` usa pra rodar `npm run build`) — não
em build-time da imagem. Nenhum `.env` de marca entra na imagem genérica (ver
`.dockerignore`).

## Estrutura de conteúdo

- `src/content/pages/{home,about,faq,jornal}.md` — título, meta description e
  corpo (Markdown) das 4 páginas fixas.
- `src/content/faq/*.md` — cada arquivo é uma pergunta (vira bloco visual +
  entrada no FAQPage JSON-LD + linha no `llms.txt`).
- `src/content/posts/*.md` — artigos do blog (`/jornal`).

Numa instância real, esse caminho é o destino do clone do repositório de
conteúdo da marca (ver `entrypoint.sh`), não conteúdo commitado neste repo.

## Backend do Tina (CMS self-hosted)

Cada instância sobe, além do Nginx, um segundo processo Node (`tina/server.mjs`)
expondo o GraphQL do [TinaCMS](https://tina.io) self-hosted em `/api/tina/gql`,
com a UI de edição estática em `/admin` (atrás do Traefik, ambos os paths do
mesmo domínio da marca — ver labels em `docker-compose.yml`). Sem Tina Cloud:

- **Auth**: usuário/senha único por marca via HTTP Basic Auth, checado a cada
  requisição (`tina/auth.ts`). Gere o hash da senha com
  `node scripts/hash-tina-password.mjs "sua-senha"` e preencha
  `TINA_ADMIN_USER`/`TINA_ADMIN_PASSWORD_HASH` no `.env`.
- **Banco**: SQLite embutido (`sqlite-level`, sem serviço externo — nunca
  Postgres/Mongo por marca), um arquivo por instância no volume persistente.
- **Git provider**: GitHub, via `CONTENT_REPO_TOKEN` (fine-grained PAT ou
  deploy key com escopo restrito a este único repositório — nunca um token
  amplo de organização).
- **Schema** (`tina/schema.ts`) espelha exatamente as collections de
  `src/content.config.ts` (`pages`/`faq`/`posts`) — é o mesmo conteúdo dos
  dois lados, não um modelo paralelo.

O schema/admin UI (`tina/__generated__/`, `public/admin/`) é gerado uma vez
na imagem (`npm run tina:build`, ver `Dockerfile`) — não depende de conteúdo
de marca, só do schema, então não roda a cada boot de container.

### Escrita (editar pelo `/admin`)

Uma edição salva pelo `/admin` grava o Markdown localmente (no mesmo
`CONTENT_DIR` que o clone da marca) e, via `CONTENT_REPO_TOKEN`, comita e
empurra o commit direto pro `CONTENT_REPO_URL` pela API do GitHub — não é
git local (clone/push), é `GitHubProvider.onPut`/`onDelete` da REST API.

A publicação **não é instantânea**: como decidido para este modelo (ver
"Atualizar o template" abaixo), o site servido só reflete uma edição no
próximo boot do container, quando `entrypoint.sh` clona de novo e vê um HEAD
diferente. Reiniciar a instância (`docker compose --profile prod up -d`)
depois de editar é o mecanismo de publicação — não existe rebuild automático
disparado pela própria escrita.

**Upload de imagem pelo `/admin` ainda não está implementado.** `tina/server.mjs`
usa `TinaNodeBackend`, que só expõe a rota `/gql` — não tem endpoint de mídia.
Por isso `hero`/`cover` em `tina/schema.ts` são campos de texto (caminho
relativo ao `.md`, ex: `./home-hero.jpg`), não campo de imagem com upload:
o editor referencia um arquivo já commitado no repo de conteúdo, do mesmo
jeito que funciona hoje sem Tina nenhum. Um media store customizado (upload
gravando dentro do próprio repo de conteúdo, mantendo compatibilidade com
`astro:assets`) fica como trabalho futuro.

**Campos opcionais vazios**: um campo deixado em branco no formulário grava
`null` no frontmatter (não omite a chave) — `src/content.config.ts` trata
isso normalizando `null` pra "ausente" antes da validação, então o build não
quebra e o `.default(...)` do zod continua funcionando. Exceção: `updatedDate`
(post) não é editável pelo `/admin` de propósito — é o único campo de data
opcional do schema, e `@tinacms/graphql` serializa uma data vazia como
`1970-01-01` (bug upstream: `new Date(null)` vira epoch, e passa validação
sem erro por ser uma data "válida", só errada). Continua editável direto no
Markdown/git se precisar.

## Múltiplas marcas na mesma VPS

Cada instância já roda isolada em container. Para dar a cada marca um domínio
próprio na mesma VPS, use o proxy reverso compartilhado (Traefik) em
[`traefik/`](traefik/): infra da VPS, não de uma marca — roda uma vez.

```bash
# Uma vez por VPS
docker network create edge
cp traefik/.env.example traefik/.env   # editar ACME_EMAIL
(cd traefik && docker compose up -d)

# Por marca (preencha DOMAIN/BRAND_SLUG/CONTENT_REPO_URL no .env dela;
# aponte o DNS da marca — registro A — pro IP da VPS antes de subir)
docker compose --profile prod up -d
```

O Traefik descobre o container pela label `traefik.enable=true`, já presente
no `docker-compose.yml`, e emite o certificado Let's Encrypt do domínio na
primeira requisição HTTPS.

Importante: `docker-compose.yml` referencia a rede `edge` como
`external: true`, então ela precisa existir mesmo que você não use o
Traefik. Crie-a uma única vez por VPS, no passo acima. Com ou sem o proxy, o
acesso direto via `WEB_PORT` continua funcionando.

## Imagem publicada (CI/CD)

`.github/workflows/ci.yml` builda e publica `ghcr.io/coutodev/brand-engine`:

- Em todo push/PR, roda o gate (`npm run check`, `npm run build` contra o
  conteúdo de exemplo, `docker build` da imagem) — publicar depende deste
  job passar.
- Em push pro `main`, publica a tag `latest` (+ a tag `sha-<commit>`, sempre,
  pra rollback preciso mesmo sem uma tag semver).
- Em push de uma tag `vX.Y.Z`, publica `X.Y.Z` e `X.Y` além de `sha-<commit>`.

Uma instância de marca **não** usa este `docker-compose.yml` (esse é só pra
dev do template, com `build:` local) — usa
[`docker-compose.example.yml`](docker-compose.example.yml), que referencia a
imagem publicada (`image: ghcr.io/coutodev/brand-engine:...`). Copie esse
arquivo pro repositório/servidor da marca junto com o `.env` dela.

## Atualizar o template

Trocar a tag da imagem no `docker-compose.example.yml` da marca (ex: de
`latest` pra uma versão fixa, ou de uma versão pra outra) e rodar
`docker compose pull && docker compose up -d` já é suficiente — o carimbo de
build compara o commit de conteúdo junto com a identidade da imagem
(`TEMPLATE_BUILD_ID`, o sha do commit que o CI usou pra publicar — ver
`ci.yml`/`Dockerfile` — não a `version` do `package.json`, que nem sempre
muda entre publicações), então trocar de imagem sempre reconstrói mesmo que
o conteúdo da marca não tenha mudado. Uma marca específica pode ficar presa
numa tag anterior (fixando `image:` nela) se um update quebrar algo só pra
ela — sempre existe uma tag `sha-<commit>` publicada, então dá pra fixar
numa versão exata mesmo sem uma tag semver correspondente.

**Rollback** de uma marca (voltar pra tag anterior, ex: `v0.4.0` quebrou algo
que `v0.5.0` não tinha): edite `image:` no `docker-compose.yml` dessa marca
pra tag anterior (ou `sha-<commit-anterior>`, achado nos runs do
`ci.yml`/nos pacotes do GHCR) e rode `docker compose up -d` de novo — o
volume `data` (conteúdo clonado, banco do Tina) sobrevive à troca, só o
código do template muda. Não afeta as outras marcas: cada uma tem seu
próprio `docker-compose.yml`/tag de imagem.

## Documentação

Este template usa [Astro](https://docs.astro.build). Consulte a documentação
para rotas, componentes, content collections e i18n.

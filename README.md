# brand-engine

Template Astro agnóstico de marca, focado em AEO/SEO (JSON-LD, `llms.txt`,
respostas diretas extraíveis por agentes/LLMs). A identidade de cada marca
(nome, domínio, descrição, cores) vem de variáveis de ambiente; o conteúdo
longo (hero, "sobre", FAQ, posts) vive como Markdown em `astro/src/content/`.

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
   aninhado em `astro/src/content/`; é assim que o backend do Tina espera,
   ver `tina/schema.ts`).
2. **Token do GitHub (conteúdo)**: gere um fine-grained Personal Access Token
   (ou deploy key) com escopo restrito a esse repositório único, permissão de
   leitura+escrita em "Contents" — nunca um token amplo de organização (ver
   `CONTENT_REPO_TOKEN` em `.env.example`). **Obrigatório sempre que o
   repositório de conteúdo for privado** (o `entrypoint.sh` usa o token pra
   autenticar o clone) ou se a marca vai editar pelo `/admin` — na prática o
   caso comum, já que o repo de conteúdo raramente é público. Sem o token
   nesse caso, o container não erra na hora: ele crash-loopa no boot com
   `could not read Username for 'https://github.com'` (o `git clone` tentando
   pedir credencial interativa dentro do container) — sintoma que não parece
   um problema de auth à primeira vista. Repo público + `/admin` desativado:
   pode deixar em branco.
3. **Autentique no GHCR**: `ghcr.io/brand-engine/brand-engine` é um pacote
   **privado** — sem login, qualquer `docker` que precise da imagem (inclusive
   o passo seguinte) falha com um 403/"not found" indistinguível de um erro
   de tag inexistente. Ver "Autenticação no GHCR" abaixo — a forma que
   funciona hoje não é a que a documentação do GitHub recomenda por padrão.
4. **Senha do `/admin`**: gere o hash com um container descartável da própria
   imagem — não precisa de `docker-compose.yml` nenhum ainda, só da tag que
   você vai usar (a mesma de `docker-compose.example.yml`, ou a que você
   escolher):
   `docker run --rm --entrypoint node ghcr.io/brand-engine/brand-engine:<tag> tina/scripts/hash-tina-password.mjs "senha-da-marca"`
   — preencha `TINA_ADMIN_USER`/`TINA_ADMIN_PASSWORD_HASH` no passo seguinte.
   (Depois que o `docker-compose.yml` da marca existir, `docker compose run
   --rm --entrypoint node web tina/scripts/hash-tina-password.mjs "..."`
   funciona igual, sem repetir a tag — é o que `npm run create-brand` deixa
   pronto no README que ele gera.)
5. **`.env`**: `cp .env.example .env` e preencha `SITE_*`, `DOMAIN`,
   `BRAND_SLUG`, `CONTENT_REPO_URL` (+ `CONTENT_REPO_TOKEN` se o repo for
   privado ou for usar o `/admin`), `TINA_ADMIN_*`.
6. **Suba a instância**: no repositório/servidor da marca (não neste
   template), use [`docker-compose.example.yml`](docker-compose.example.yml)
   como `docker-compose.yml` e rode `docker compose up -d`. O primeiro boot
   roda o `astro build` completo (mais lento que os restarts seguintes — ver
   "Como uma instância sobe" acima).

Os passos 5 e 6 (copiar `docker-compose.example.yml` e preencher o `.env`) têm
um atalho: `npm run create-brand -- <diretorio-saida> --site-name ... --site-url
... --site-description ... --domain ... --brand-slug ... --content-repo-url
...` gera os dois arquivos prontos (+ `.env.example`, `.gitignore`, `README.md`)
num diretório novo, que já é o repositório da marca. Rode sem argumentos pra
ver a lista completa de opções.

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
(symlinkado em `astro/src/content` automaticamente por
`astro/scripts/ensure-example-content.mjs` — ver `predev`/`prebuild` em
`package.json`). Esse conteúdo de exemplo nunca entra na imagem Docker (ver
`.dockerignore`); numa instância real ele é substituído pelo clone do
repositório da marca.

## Variáveis de ambiente

[`.env.example`](.env.example) lista todas as variáveis e seus defaults.
Obrigatórias: `SITE_NAME`, `SITE_URL`, `SITE_DESCRIPTION`, `BRAND_SLUG`,
`CONTENT_REPO_URL`. O resto — localização, locale, paleta de cores, portas —
tem default ou é opcional. Sem nenhuma `THEME_*`, o site usa o tema padrão do
template: o primeiro preset de
[`astro/src/lib/brand-presets.ts`](astro/src/lib/brand-presets.ts). Cada `THEME_*`
definida sobrescreve só aquele token.

Diferente de um site puramente estático, essas variáveis são lidas em
**runtime dentro do container** (`docker-compose.yml` injeta o `.env` via
`env_file`, e é isso que `entrypoint.sh` usa pra rodar `npm run build`) — não
em build-time da imagem. Nenhum `.env` de marca entra na imagem genérica (ver
`.dockerignore`).

## Estrutura de conteúdo

- `astro/src/content/pages/{home,about,faq,jornal}.md` — título, meta
  description e corpo (Markdown) das 4 páginas fixas.
- `astro/src/content/faq/*.md` — cada arquivo é uma pergunta (vira bloco
  visual + entrada no FAQPage JSON-LD + linha no `llms.txt`).
- `astro/src/content/posts/*.md` — artigos do blog (`/jornal`).

Numa instância real, esse caminho é o destino do clone do repositório de
conteúdo da marca (ver `entrypoint.sh`), não conteúdo commitado neste repo.

## Backend do Tina (CMS self-hosted)

Cada instância sobe, além do Nginx, um segundo processo Node (`tina/server.mjs`)
expondo o GraphQL do [TinaCMS](https://tina.io) self-hosted em `/api/tina/gql`
(porta 4001). A UI de edição estática em `/admin` é só mais um asset público
do build do Astro (ver `astro/public/admin/` abaixo) — serve pelo Nginx na
porta 80, junto com o resto do site, não pelo processo do Tina. Atrás do
Traefik, só `/api/tina` é roteado pra porta 4001; `/admin` cai na rota "pega
tudo" do domínio da marca, como qualquer outra página (ver labels em
`docker-compose.yml`). Sem Tina Cloud:

- **Auth**: usuário/senha único por marca via HTTP Basic Auth, checado a cada
  requisição (`tina/auth.ts`). Gere o hash da senha com
  `node tina/scripts/hash-tina-password.mjs "sua-senha"` e preencha
  `TINA_ADMIN_USER`/`TINA_ADMIN_PASSWORD_HASH` no `.env`.
- **Banco**: SQLite embutido (`sqlite-level`, sem serviço externo — nunca
  Postgres/Mongo por marca), um arquivo por instância no volume persistente.
- **Git provider**: GitHub, via `CONTENT_REPO_TOKEN` (fine-grained PAT ou
  deploy key com escopo restrito a este único repositório — nunca um token
  amplo de organização).
- **Schema** (`tina/schema.ts`) espelha exatamente as collections de
  `astro/src/content.config.ts` (`pages`/`faq`/`posts`) — é o mesmo conteúdo
  dos dois lados, não um modelo paralelo.

O schema/admin UI (`tina/__generated__/`, `astro/public/admin/`) é gerado uma vez
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
`null` no frontmatter (não omite a chave) — `astro/src/content.config.ts` trata
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

`.github/workflows/ci.yml` builda e publica `ghcr.io/brand-engine/brand-engine`:

- Em todo push/PR, roda o gate (`npm run check`, `npm run build` contra o
  conteúdo de exemplo, `docker build` da imagem) — publicar depende deste
  job passar.
- Em push pro `main`, publica a tag `latest` (+ a tag `sha-<commit>`, sempre,
  pra rollback preciso mesmo sem uma tag semver).
- Em push de uma tag `vX.Y.Z`, publica `X.Y.Z` e `X.Y` além de `sha-<commit>`.

Uma instância de marca **não** usa este `docker-compose.yml` (esse é só pra
dev do template, com `build:` local) — usa
[`docker-compose.example.yml`](docker-compose.example.yml), que referencia a
imagem publicada (`image: ghcr.io/brand-engine/brand-engine:...`). Copie esse
arquivo pro repositório/servidor da marca junto com o `.env` dela.

Nenhuma tag `vX.Y.Z` foi publicada ainda (isso só acontece num push de tag
`vX.Y.Z` — ver acima), então hoje as únicas tags que existem de verdade são
`latest` e as `sha-<commit>` (uma por push pro main). `docker-compose.example.yml`
está fixado numa dessas `sha-<commit>` reais — **não** assuma que uma tag
semver tipo `0.5.2` existe só porque `package.json`/o `Dockerfile` mencionam
uma "version"; confira o pacote no GHCR (ou `gh run list`) antes de pinar uma.

## Autenticação no GHCR

`ghcr.io/brand-engine/brand-engine` é um pacote **privado** — todo
`docker compose pull`/`up` numa instância de marca precisa de um login no
GHCR primeiro, ou falha com um 403/"not found" que parece um erro de tag
inexistente (item acima) mas é na verdade falta de autenticação.

Confirmado empiricamente (e documentado pelo próprio GitHub): a forma de
autenticar que a documentação do GitHub recomenda por padrão hoje em dia —
fine-grained PAT ou token de instalação de GitHub App — **não funciona** pra
puxar pacotes de container:

- Fine-grained PAT não tem permissão de "Packages" nenhuma — não dá nem pra
  tentar dar esse escopo a um fine-grained PAT.
- Token de instalação de GitHub App (mesmo com `packages: write` e a app
  instalada/vinculada certo) não consegue ler pacotes de container de
  organização — limitação reconhecida da própria plataforma GitHub, sem
  prazo de correção (ver GitHub Community Discussion #171423).
- **Só um PAT clássico com escopo `read:packages` funciona de verdade**:

  ```bash
  echo "$GHCR_TOKEN" | docker login ghcr.io -u <seu-usuario-github> --password-stdin
  ```

[`scripts/ghcr-pull.sh`](scripts/ghcr-pull.sh) empacota esse login (lendo
`GHCR_USERNAME`/`GHCR_TOKEN` do ambiente) + um `docker pull` opcional, pra não
reinventar isso a cada marca nova.

**Alternativa que elimina o problema inteiro**: tornar o pacote público. A
imagem não carrega segredo nenhum de marca (o `Dockerfile` só copia o código
deste template — `.env`, `.env.production` e o conteúdo de marca são
excluídos via `.dockerignore`; segredos reais entram só em runtime, via
`.env` de cada instância). Pública, qualquer `docker compose pull` funciona
sem login nenhum. É uma decisão de quem administra a organização no GitHub
(troca de visibilidade de pacote, feita pela UI do GitHub) — não algo pra
mudar sem essa decisão explícita.

## Atualizar o template

`docker-compose.example.yml` já sobe fixado numa versão concreta (não
`latest` — ver comentário no arquivo: um tag flutuante torna rollback
impossível sem editar isto primeiro). Trocar a tag da imagem nele pra uma
versão mais nova e rodar `docker compose pull && docker compose up -d` já é
suficiente — o carimbo de
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

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

## Rodar uma instância

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

## Atualizar o template

Publicar uma nova tag da imagem `brand-engine` e reiniciar a instância
(`docker compose pull && docker compose --profile prod up -d`) já é
suficiente — o carimbo de build compara a versão do template junto com o
commit de conteúdo, então uma imagem nova sempre reconstrói mesmo que o
conteúdo da marca não tenha mudado. Uma marca específica pode ficar presa
numa tag anterior (fixando `image:` no `docker-compose.yml` dela) se um
update quebrar algo só pra ela.

## Documentação

Este template usa [Astro](https://docs.astro.build). Consulte a documentação
para rotas, componentes, content collections e i18n.

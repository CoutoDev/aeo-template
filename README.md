# create-brand-site

Template Astro agnóstico de marca, com foco em AEO/SEO (JSON-LD, `llms.txt`,
respostas diretas extraíveis por agentes/LLMs). Identidade de cada marca
(nome, domínio, descrição, cores) vem de variáveis de ambiente; conteúdo
longo (hero, "sobre", FAQ, posts) vive como Markdown em `src/content/`.

Cada marca vira sua própria **instância**: uma pasta independente, com seu
próprio `.env`, conteúdo e deploy Docker — gerada via CLI a partir deste
pacote.

## Criar uma instância de marca

```bash
npx create-brand-site minha-marca --site-name "Minha Marca" --site-url "https://minhamarca.com.br" --description "O que a marca faz, em 1-2 frases."
```

Flags omitidas são pedidas interativamente. Veja todas com:

```bash
npx create-brand-site --help
```

Isso cria `./minha-marca/` com uma cópia deste template + um `.env` já
preenchido. Depois:

```bash
cd minha-marca
npm install
```

Edite o conteúdo de exemplo (`src/content/pages/*.md`, `src/content/faq/*.md`,
`src/content/posts/*.md`) com o conteúdo real da marca, e troque
`public/favicon.svg` / `public/favicon.ico`.

## Rodar uma instância

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de dev local em `localhost:4321` |
| `npm run build` | Build estático em `./dist/` |
| `npm run preview` | Preview do build local |
| `docker compose --profile dev up` | Dev com hot-reload em container |
| `docker compose --profile prod up -d` | Build + serve estático via Nginx |

Cada instância tem seu próprio `DEV_PORT`/`WEB_PORT` no `.env`, então rodar
várias marcas ao mesmo tempo no mesmo host não colide porta — mas se cada
marca precisa do próprio domínio (não só porta), ver
[Múltiplas marcas na mesma VPS](#múltiplas-marcas-na-mesma-vps) abaixo.

## Variáveis de ambiente

Ver [`.env.example`](.env.example) para a lista completa e defaults.
Obrigatórias: `SITE_NAME`, `SITE_URL`, `SITE_DESCRIPTION`. O resto
(localização, locale, paleta de cores, portas Docker) tem default ou é
opcional.

Como o site é 100% estático, essas variáveis precisam existir em **build
time** (`npm run build` / `docker build`), não só em runtime — o `.env` da
instância entra no build context do Docker de propósito (ver comentário em
`.dockerignore`).

## Estrutura de conteúdo

- `src/content/pages/{home,about,faq,jornal}.md` — título, meta description e
  corpo (Markdown) das 4 páginas fixas.
- `src/content/faq/*.md` — cada arquivo é uma pergunta (vira bloco visual +
  entrada no FAQPage JSON-LD + linha no `llms.txt`).
- `src/content/posts/*.md` — artigos do blog (`/jornal`).

## Múltiplas marcas na mesma VPS

Cada instância já roda isolada em container; pra cada marca ter seu próprio
domínio (não só uma porta) na mesma VPS, existe um proxy reverso
compartilhado (Traefik) em [`traefik/`](traefik/) — infra da VPS, não de
nenhuma marca, roda uma vez e não é copiada pelo scaffold do CLI.

```bash
# Uma vez por VPS
docker network create edge
cp traefik/.env.example traefik/.env   # editar ACME_EMAIL
(cd traefik && docker compose up -d)

# Por marca (o CLI já preenche DOMAIN/BRAND_SLUG no .env; aponte o DNS
# da marca — registro A — pro IP da VPS antes de subir)
cd minha-marca
docker compose --profile prod up -d
```

O Traefik descobre o container pela label `traefik.enable=true` (já presente
no `docker-compose.yml` do template) e emite o certificado Let's Encrypt do
domínio automaticamente na primeira requisição HTTPS. Detalhes em
[`traefik/README.md`](traefik/README.md).

Importante: a rede `edge` é referenciada como `external: true` no
`docker-compose.yml` de toda instância — ela precisa existir (passo acima)
mesmo se você não for usar o Traefik, é criada uma única vez por VPS. Acesso
direto via `WEB_PORT` continua funcionando normalmente com ou sem o proxy.

## O que é do template vs. o que é da marca

Uma futura atualização deste template para instâncias já em produção (via
diff rastreado ou split em pacote npm — ainda não decidido) só deve
sobrescrever o que é **template-owned**. O que é **brand-owned** nunca deve
ser tocado por essa atualização; é conteúdo/config exclusivo de cada
instância. A lista oficial (consumível por máquina) vive em
[`template.manifest.json`](template.manifest.json).

| Brand-owned (nunca sobrescrever) | Template-owned (propaga em update) |
| --- | --- |
| `.env`, `.env.production` | `src/components/`, `src/layouts/`, `src/pages/` |
| `src/content/**` (conteúdo real da marca) | `src/lib/`, `src/content.config.ts`, `src/styles/global.css` |
| `public/favicon.ico`, `public/favicon.svg` | `astro.config.mjs`, `cli/`, `scripts/`, `Dockerfile`, `nginx.conf` |

Na prática: mudar cor de tema é seguro porque cor nunca vive em componente —
vem de `THEME_*` (`.env`) → `src/lib/brand.ts` → CSS custom properties
injetadas por `BaseLayout.astro`. `npm run check:theme` falha o processo se
alguém hardcodar um hex fora de `brand.ts`, pra essa garantia não regredir.
Mudar estrutura de componentes/páginas é o caso "deve afetar a marca" — e só
afeta de fato no próximo build+deploy daquela instância, nunca antes.

Cada instância gerada carrega um `.template-version` com a versão do
template que a originou, para uma ferramenta de update futura saber a
partir de onde atualizar.

`traefik/` é uma terceira categoria: infra da VPS, nem brand-owned nem
template-owned de uma instância — o CLI nem copia essa pasta pro scaffold
(ver [Múltiplas marcas na mesma VPS](#múltiplas-marcas-na-mesma-vps)).

## Documentação

Este template usa [Astro](https://docs.astro.build). Consulte a documentação
para rotas, componentes, content collections e i18n.

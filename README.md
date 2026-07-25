# create-brand-site

Template Astro agnóstico de marca, focado em AEO/SEO (JSON-LD, `llms.txt`,
respostas diretas extraíveis por agentes/LLMs). A identidade de cada marca
(nome, domínio, descrição, cores) vem de variáveis de ambiente; o conteúdo
longo (hero, "sobre", FAQ, posts) vive como Markdown em `src/content/`.

Cada marca vira uma **instância**: pasta independente, com `.env`, conteúdo e
deploy Docker próprios, gerada pelo CLI a partir deste pacote.

## Criar uma instância de marca

```bash
npx create-brand-site minha-marca --site-name "Minha Marca" --site-url "https://minhamarca.com.br" --description "O que a marca faz, em 1-2 frases."
```

O CLI pergunta as flags omitidas. Veja todas com:

```bash
npx create-brand-site --help
```

O comando cria `./minha-marca/` com uma cópia deste template e um `.env` já
preenchido. Depois:

```bash
cd minha-marca
npm install
```

Substitua o conteúdo de exemplo (`src/content/pages/*.md`,
`src/content/faq/*.md`, `src/content/posts/*.md`) pelo conteúdo real da marca e
troque `public/favicon.svg` e `public/favicon.ico`.

## Rodar uma instância

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de dev local em `localhost:4321` |
| `npm run build` | Build estático em `./dist/` |
| `npm run preview` | Preview do build local |
| `docker compose --profile dev up` | Dev com hot-reload em container |
| `docker compose --profile prod up -d` | Build + serve estático via Nginx |

Cada instância define seu próprio `DEV_PORT` e `WEB_PORT` no `.env`, então
várias marcas rodam ao mesmo tempo no mesmo host sem colidir porta. Para dar a
cada marca um domínio próprio, e não só uma porta, veja
[Múltiplas marcas na mesma VPS](#múltiplas-marcas-na-mesma-vps).

## Variáveis de ambiente

[`.env.example`](.env.example) lista todas as variáveis e seus defaults. Três
são obrigatórias: `SITE_NAME`, `SITE_URL` e `SITE_DESCRIPTION`. O resto —
localização, locale, paleta de cores, portas Docker — tem default ou é
opcional. Sem nenhuma `THEME_*`, o site usa o tema padrão do template: o
primeiro preset de [`src/lib/brand-presets.ts`](src/lib/brand-presets.ts). Cada
`THEME_*` definida sobrescreve só aquele token.

Como o site é 100% estático, essas variáveis precisam existir em **build time**
(`npm run build`, `docker build`), e não em runtime. Por isso o `.env` da
instância entra no build context do Docker de propósito (veja o comentário em
`.dockerignore`).

## Estrutura de conteúdo

- `src/content/pages/{home,about,faq,jornal}.md` — título, meta description e
  corpo (Markdown) das 4 páginas fixas.
- `src/content/faq/*.md` — cada arquivo é uma pergunta (vira bloco visual +
  entrada no FAQPage JSON-LD + linha no `llms.txt`).
- `src/content/posts/*.md` — artigos do blog (`/jornal`).

## Múltiplas marcas na mesma VPS

Cada instância já roda isolada em container. Para dar a cada marca um domínio
próprio na mesma VPS, use o proxy reverso compartilhado (Traefik) em
[`traefik/`](traefik/): infra da VPS, não de uma marca — roda uma vez, e o
scaffold do CLI não copia essa pasta.

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

O Traefik descobre o container pela label `traefik.enable=true`, já presente no
`docker-compose.yml` do template, e emite o certificado Let's Encrypt do
domínio na primeira requisição HTTPS.

Importante: todo `docker-compose.yml` de instância referencia a rede `edge`
como `external: true`, então ela precisa existir mesmo que você não use o
Traefik. Crie-a uma única vez por VPS, no passo acima. Com ou sem o proxy, o
acesso direto via `WEB_PORT` continua funcionando.

## O que é do template vs. o que é da marca

Uma futura atualização deste template em instâncias já em produção (via diff
rastreado ou split em pacote npm — ainda não decidido) deve sobrescrever apenas
o que é **template-owned**. O que é **brand-owned** — conteúdo e config
exclusivos de cada instância — permanece intocado.
[`template.manifest.json`](template.manifest.json) guarda a lista oficial,
consumível por máquina.

| Brand-owned (nunca sobrescrever) | Template-owned (propaga em update) |
| --- | --- |
| `.env`, `.env.production` | `src/components/`, `src/layouts/`, `src/pages/` |
| `src/content/**` (conteúdo real da marca) | `src/lib/`, `src/content.config.ts`, `src/styles/global.css` |
| `public/favicon.ico`, `public/favicon.svg` | `astro.config.mjs`, `cli/`, `scripts/`, `Dockerfile`, `nginx.conf` |

Na prática, mudar cor de tema é seguro, porque cor nunca vive em componente:
ela vem de `THEME_*` no `.env` — ou do preset padrão, quando a variável não
existe — passa por `src/lib/brand.ts` e chega como CSS custom property
injetada pelo `BaseLayout.astro`. Para essa garantia não regredir,
`npm run check:theme` falha o processo quando alguém hardcoda um hex fora de
`src/lib/`. Já mudar estrutura de componentes ou páginas é o caso que **deve**
afetar a marca — e só afeta no próximo build e deploy daquela instância.

Cada instância carrega um `.template-version` com a versão do template que a
gerou, para uma futura ferramenta de update saber de onde partir.

`traefik/` forma uma terceira categoria: infra da VPS, nem brand-owned nem
template-owned de uma instância. O CLI não copia essa pasta para o scaffold
(veja [Múltiplas marcas na mesma VPS](#múltiplas-marcas-na-mesma-vps)).

## Documentação

Este template usa [Astro](https://docs.astro.build). Consulte a documentação
para rotas, componentes, content collections e i18n.

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

Rodando várias marcas ao mesmo tempo no mesmo host: cada instância tem seu
próprio `DEV_PORT`/`WEB_PORT` no `.env` (ver `.env.example`), então basta
`docker compose --profile prod up -d` em cada pasta de instância sem
colisão de porta.

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

## Documentação

Este template usa [Astro](https://docs.astro.build). Consulte a documentação
para rotas, componentes, content collections e i18n.

// Schema espelha exatamente as collections de src/content.config.ts (mesmos
// campos, mesmos paths) — o objetivo é editar o MESMO conteudo que o Astro
// consome, nao um modelo paralelo. Ver README na raiz sobre o backend
// self-hosted (tina/database.ts, tina/auth.ts, tina/server.mjs).
//
// Modulo separado de tina/config.ts DE PROPOSITO: nao importa nada do
// pacote `tinacms` (client-side, pesado — traz React/toolkit de UI junto).
// tina/server.mjs importa so este arquivo pra rodar buildSchema() num
// processo Node leve; tina/config.ts importa este arquivo E o `tinacms`,
// só pro build da imagem/admin UI (ver Dockerfile).
export const tinaConfig = {
  // Backend proprio (Node, fora do Next.js/TinaCloud) montado por
  // tina/server.mjs — ver esse arquivo pra auth e persistencia.
  contentApiUrlOverride: '/api/tina/gql',
  build: {
    publicFolder: 'public',
    outputFolder: 'admin',
    // sqlite-level embala uma binding nativa (better-sqlite3) que o esbuild
    // nao consegue empacotar — sem isso, tina/database.ts falha em runtime
    // com "Cannot read properties of undefined (reading 'exec')".
    externalDependencies: ['sqlite-level', 'better-sqlite3', 'abstract-level'],
  },
  media: {
    tina: {
      publicFolder: 'public',
      mediaRoot: 'uploads',
    },
  },
  schema: {
    collections: [
      {
        name: 'pages',
        label: 'Páginas',
        path: 'src/content/pages',
        format: 'md',
        fields: [
          { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
          { type: 'string', name: 'title', label: 'Título', required: true },
          { type: 'string', name: 'heading', label: 'Heading' },
          {
            type: 'string',
            name: 'metaDescription',
            label: 'Meta description',
            required: true,
            ui: { component: 'textarea' },
          },
          {
            type: 'object',
            name: 'specs',
            label: 'Especificações',
            list: true,
            fields: [
              { type: 'string', name: 'label', label: 'Label', required: true },
              { type: 'string', name: 'value', label: 'Valor', required: true },
            ],
          },
          { type: 'image', name: 'hero', label: 'Imagem de hero' },
          { type: 'string', name: 'heroAlt', label: 'Texto alternativo do hero' },
          { type: 'rich-text', name: 'body', label: 'Conteúdo', isBody: true },
        ],
      },
      {
        name: 'faq',
        label: 'Perguntas frequentes',
        path: 'src/content/faq',
        format: 'md',
        fields: [
          { type: 'string', name: 'question', label: 'Pergunta', required: true },
          {
            type: 'string',
            name: 'shortAnswer',
            label: 'Resposta curta',
            required: true,
            ui: { component: 'textarea' },
          },
          { type: 'number', name: 'order', label: 'Ordem' },
          { type: 'rich-text', name: 'body', label: 'Conteúdo', isBody: true },
        ],
      },
      {
        name: 'posts',
        label: 'Jornal (artigos)',
        path: 'src/content/posts',
        format: 'md',
        fields: [
          { type: 'string', name: 'title', label: 'Título', required: true },
          {
            type: 'string',
            name: 'description',
            label: 'Descrição',
            required: true,
            ui: { component: 'textarea' },
          },
          { type: 'datetime', name: 'publishDate', label: 'Data de publicação', required: true },
          { type: 'datetime', name: 'updatedDate', label: 'Data de atualização' },
          { type: 'string', name: 'author', label: 'Autor' },
          { type: 'string', name: 'tags', label: 'Tags', list: true },
          { type: 'image', name: 'cover', label: 'Capa' },
          { type: 'string', name: 'coverAlt', label: 'Texto alternativo da capa' },
          { type: 'rich-text', name: 'body', label: 'Conteúdo', isBody: true },
        ],
      },
    ],
  },
};

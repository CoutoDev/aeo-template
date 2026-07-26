// Schema espelha exatamente as collections de astro/src/content.config.ts (mesmos
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
    // Relativo à raiz do repo (rootPath do CLI, cwd por padrão) — public/
    // vive em astro/public desde a separação astro/tina, não na raiz.
    publicFolder: 'astro/public',
    outputFolder: 'admin',
    // sqlite-level embala uma binding nativa (better-sqlite3) que o esbuild
    // nao consegue empacotar — sem isso, tina/database.ts falha em runtime
    // com "Cannot read properties of undefined (reading 'exec')".
    externalDependencies: ['sqlite-level', 'better-sqlite3', 'abstract-level'],
  },
  // Sem bloco "media": TinaNodeBackend (tina/server.mjs) só expõe a rota
  // /gql, sem endpoint de upload — configurar media.tina aqui ligaria o
  // botão "Media Manager" na UI sem um backend funcional atrás dele. Upload
  // de imagem fica fora do escopo por ora (ver 'hero'/'cover' abaixo, e o
  // README) — editor referencia arquivos já commitados no repo de conteúdo.
  schema: {
    collections: [
      {
        name: 'pages',
        label: 'Páginas',
        // Relativo à raiz do repositorio de CONTEUDO (CONTENT_DIR), não do
        // template — ver o outputPath do FilesystemBridge em database.ts.
        // O repo de uma marca tem pages/, faq/, posts/ na raiz (mesmo layout
        // de templates/brand-content-example/), nao aninhado em astro/src/content.
        path: 'pages',
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
          // 'string', não 'image': TinaNodeBackend (tina/server.mjs) só expõe
          // a rota /gql, sem endpoint de upload de mídia — o widget de imagem
          // do Tina dependeria de um media store que não existe aqui. Editor
          // digita o caminho relativo ao .md (ex: ./home-hero.jpg), igual ao
          // que já funciona hoje via git — ver image() em content.config.ts.
          { type: 'string', name: 'hero', label: 'Imagem de hero (caminho relativo, ex: ./home-hero.jpg)' },
          { type: 'string', name: 'heroAlt', label: 'Texto alternativo do hero' },
          { type: 'rich-text', name: 'body', label: 'Conteúdo', isBody: true },
        ],
      },
      {
        name: 'faq',
        label: 'Perguntas frequentes',
        path: 'faq',
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
        path: 'posts',
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
          // Sem 'updatedDate' aqui de proposito: e o UNICO campo datetime
          // opcional do schema (publishDate e obrigatorio, o form nunca
          // manda vazio), e @tinacms/graphql tem um bug real na serialização
          // — resolveDateInput faz "new Date(null)", que o JS trata como
          // epoch (1970-01-01), e o date-fns considera "valida" — confirmado
          // testando um mutation completo com o campo vazio. Resultado seria
          // corrupção silenciosa (nenhum erro, so a data errada gravada no
          // repo da marca), não algo pra expor no /admin sem correção
          // upstream. Continua editável direto no arquivo/git se precisar.
          { type: 'string', name: 'author', label: 'Autor' },
          { type: 'string', name: 'tags', label: 'Tags', list: true },
          // Ver comentário equivalente em 'hero' acima.
          { type: 'string', name: 'cover', label: 'Capa (caminho relativo, ex: ./artigo-1-cover.jpg)' },
          { type: 'string', name: 'coverAlt', label: 'Texto alternativo da capa' },
          { type: 'rich-text', name: 'body', label: 'Conteúdo', isBody: true },
        ],
      },
    ],
  },
};

#!/usr/bin/env node
// Processo Node separado do Astro/nginx (ver entrypoint.sh) — expõe o
// GraphQL do Tina self-hosted. tina/__generated__/ é gerado UMA VEZ, na
// imagem (schema nao depende de conteudo de marca nenhuma — ver Dockerfile,
// TINA_PUBLIC_IS_LOCAL=true so nesse passo). Em runtime, sem essa env var,
// databaseClient usa o banco real (tina/database.ts): SQLite local +
// GitHubProvider apontando pro repo de conteudo desta marca.
import { createServer } from 'node:http';
import { TinaNodeBackend } from '@tinacms/datalayer';
import { buildSchema } from '@tinacms/graphql';
import databaseClient from './__generated__/databaseClient.js';
import database from './database.ts';
import { tinaConfig } from './schema.ts';
import { createBasicAuthProvider } from './auth.ts';

const port = Number(process.env.TINA_PORT || 4001);

// O banco (SQLite local, por marca) precisa ser indexado com o schema antes
// de servir queries reais — sem isso, toda query falha com "GraphQL schema
// not found". buildSchema() recompila o schema a partir de tina/config.ts
// (rapido, nao depende de conteudo); a indexacao do CONTEUDO em si roda na
// primeira query/mutação e fica cacheada no SQLite entre boots.
const { graphQLSchema, tinaSchema, lookup } = await buildSchema(tinaConfig);
await database.indexContent({ graphQLSchema, tinaSchema, lookup });
console.log('[tina] schema indexado no banco local.');

const handler = TinaNodeBackend({
  authProvider: createBasicAuthProvider(),
  databaseClient,
  options: { basePath: '/api/tina' },
});

// TinaNodeBackend espera req.body ja populado (como o Next.js faz nas suas
// API routes) — nosso servidor eh http puro, entao le e faz parse do corpo
// manualmente antes de repassar pro handler.
async function readJsonBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

createServer(async (req, res) => {
  try {
    req.body = await readJsonBody(req);
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON body' }));
    return;
  }
  handler(req, res).catch((error) => {
    console.error('[tina] erro nao tratado:', error);
    if (!res.headersSent) res.writeHead(500);
    res.end('Internal server error');
  });
}).listen(port, () => {
  console.log(`[tina] backend escutando na porta ${port}`);
});

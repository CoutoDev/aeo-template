// A imagem brand-engine nao carrega conteudo de marca nenhuma — em
// producao, entrypoint.sh clona o conteudo real e cria esse symlink em
// runtime (ver entrypoint.sh). Este script faz o analogo pra quem esta
// desenvolvendo o TEMPLATE localmente (npm run dev / npm run build fora do
// Docker): sem ele, src/content nao existe e as content collections
// (src/content.config.ts) ficam vazias.
import { existsSync, symlinkSync } from 'node:fs';
import path from 'node:path';

const contentPath = path.resolve('src/content');
const exampleContentPath = path.resolve('templates/brand-content-example');

if (!existsSync(contentPath)) {
  symlinkSync(exampleContentPath, contentPath, 'dir');
  console.log('src/content -> templates/brand-content-example (symlink de dev criado)');
}

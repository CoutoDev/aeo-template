import { defineConfig, LocalAuthProvider } from 'tinacms';
import { tinaConfig } from './schema';

// So usado pelo build do admin UI (ver Dockerfile / package.json) — o
// schema em si vive em tina/schema.ts, sem depender do pacote `tinacms`.
//
// authProvider explicito: sem isso, o client-side (pacote `tinacms`) cai no
// default de `Client`, que e o `TinaCloudAuthProvider` — o botao "Enter Edit
// Mode" do /admin abriria um popup de login (email/senha) em app.tina.io,
// mesmo sem Tina Cloud configurado (nenhum clientId setado aqui). Root
// cause: contentApiUrlOverride ('/api/tina/gql', em tina/schema.ts) e um
// path relativo — o parseURL() do client (@tinacms/schema-tools) so marca
// isLocalClient=true pra URLs contendo "localhost" literalmente; qualquer
// outra coisa cai no `Client` "cloud", nunca no `LocalClient`. LocalAuthProvider
// bypassa isso: nao fala com TinaCloud, so guarda um flag no localStorage —
// a autenticacao de verdade continua sendo o Basic Auth HTTP checado a cada
// requisicao ao /api/tina/gql (ver tina/auth.ts, tina/server.mjs).
export default defineConfig({ ...tinaConfig, authProvider: new LocalAuthProvider() });

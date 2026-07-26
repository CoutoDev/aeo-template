import { createDatabase, createLocalDatabase, FilesystemBridge } from '@tinacms/datalayer';
import { GitHubProvider } from 'tinacms-gitprovider-github';
import { SqliteLevel } from 'sqlite-level';

// Sem TinaCMS Cloud: banco embutido (SQLite, mantido pelo proprio time do
// Tina — ver package.json) e git provider proprio (GitHub), nunca
// Postgres/Mongo por marca. bridge aponta pro MESMO checkout que o Astro lê
// (ver entrypoint.sh) — leitura via arquivo local; escrita vai tanto pro
// arquivo local (bridge) quanto, via gitProvider, direto pro GitHub por API
// (GitHubProvider.onPut/onDelete usam a REST API, nao git local).
function parseGitHubRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!match) {
    throw new Error(`CONTENT_REPO_URL nao parece um repositorio GitHub valido: ${url}`);
  }
  return { owner: match[1], repo: match[2] };
}

const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === 'true';

export default isLocal
  ? createLocalDatabase()
  : createDatabase({
      bridge: new FilesystemBridge(process.cwd()),
      databaseAdapter: new SqliteLevel({
        filename: process.env.TINA_SQLITE_PATH || '/app/data/tina.sqlite',
      }),
      gitProvider: new GitHubProvider({
        ...parseGitHubRepoUrl(requireEnv('CONTENT_REPO_URL')),
        token: requireEnv('CONTENT_REPO_TOKEN'),
        branch: process.env.CONTENT_REPO_BRANCH || 'main',
      }),
    });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} nao definida — obrigatoria pro backend do Tina. Ver .env.example.`);
  }
  return value;
}

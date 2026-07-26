import { defineConfig } from 'tinacms';
import { tinaConfig } from './schema';

// So usado pelo build do admin UI (ver Dockerfile / package.json) — o
// schema em si vive em tina/schema.ts, sem depender do pacote `tinacms`.
export default defineConfig(tinaConfig);

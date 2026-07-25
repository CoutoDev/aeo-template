#!/usr/bin/env node
// Garante que nenhuma cor hex fique hardcoded fora de src/lib/. Cor de marca
// só pode existir em src/lib/brand.ts (lida de THEME_* em build time) e fluir
// como var(--token) — nunca literal em componente/CSS. src/lib/ também
// hospeda src/lib/brand-presets.ts, paletas de comparação só de dev — por
// isso o diretório inteiro fica de fora do scan. Ver template.manifest.json.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCAN_DIRS = ['src/components', 'src/layouts', 'src/pages', 'src/styles'];
const SCAN_EXT = new Set(['.astro', '.css']);
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;

/** Todos os arquivos escaneáveis abaixo de `dir`, recursivamente. */
async function findScannableFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await findScannableFiles(full)));
    else if (SCAN_EXT.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const violations = [];
for (const dir of SCAN_DIRS) {
  for (const file of await findScannableFiles(path.join(ROOT, dir))) {
    const content = await readFile(file, 'utf-8');
    content.split('\n').forEach((line, index) => {
      const matches = line.match(HEX_COLOR);
      if (matches) {
        violations.push({ file: path.relative(ROOT, file), line: index + 1, matches });
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Cor hex hardcoded encontrada fora de src/lib/brand.ts:\n');
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} — ${violation.matches.join(', ')}`);
  }
  console.error(
    '\nCores de marca devem vir de THEME_* (.env) via src/lib/brand.ts e ser consumidas como var(--token). Ver template.manifest.json.'
  );
  process.exit(1);
}

console.log('check:theme — nenhuma cor hardcoded encontrada.');

#!/usr/bin/env node
// Gera o valor de TINA_ADMIN_PASSWORD_HASH (.env) a partir de uma senha em
// texto puro. Ver tina/auth.ts pro formato ("scrypt:<salt>:<hash>") e a
// verificacao em runtime.
import { hashPassword } from '../tina/auth.ts';

const password = process.argv[2];
if (!password) {
  console.error('Uso: node scripts/hash-tina-password.mjs "minha-senha"');
  process.exit(1);
}

console.log(hashPassword(password));

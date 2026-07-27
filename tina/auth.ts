import { timingSafeEqual, scryptSync, randomBytes, createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Auth simples e proprio, sem Tina Cloud nem provedor terceiro: um unico
// usuario/senha por marca, via env var (TINA_ADMIN_USER / PASSWORD_HASH),
// checado a cada requisicao via HTTP Basic Auth. O navegador ja sabe pedir
// essas credenciais nativamente quando recebe 401 + WWW-Authenticate —
// nenhuma tela de login custom pra construir/manter.
//
// TINA_ADMIN_PASSWORD_HASH usa o formato "scrypt:<salt-hex>:<hash-hex>",
// gerado por tina/scripts/hash-tina-password.mjs. Nunca guarde a senha em texto
// puro no .env.
const SCRYPT_KEY_LENGTH = 64;

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(':');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

// Comparacao de string em tempo constante. timingSafeEqual exige buffers do
// MESMO tamanho (senao lanca) — comparar os bytes crus do usuario vazaria o
// comprimento e ainda quebraria com nomes de tamanhos diferentes. Comparar o
// SHA-256 de cada lado resolve os dois: digests tem sempre 32 bytes (sem vazar
// comprimento) e timingSafeEqual roda em tempo constante sobre eles.
function safeEqual(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest();
  const bh = createHash('sha256').update(b).digest();
  return timingSafeEqual(ah, bh);
}

function parseBasicAuth(header: string | undefined): { user: string; password: string } | null {
  if (!header?.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf-8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return null;
  return { user: decoded.slice(0, separatorIndex), password: decoded.slice(separatorIndex + 1) };
}

export function createBasicAuthProvider() {
  const adminUser = process.env.TINA_ADMIN_USER;
  const adminPasswordHash = process.env.TINA_ADMIN_PASSWORD_HASH;
  if (!adminUser || !adminPasswordHash) {
    throw new Error(
      'TINA_ADMIN_USER e TINA_ADMIN_PASSWORD_HASH sao obrigatorias pra subir o backend do Tina. Veja .env.example e tina/scripts/hash-tina-password.mjs.'
    );
  }

  return {
    isAuthorized: async (req: IncomingMessage, res: ServerResponse) => {
      const credentials = parseBasicAuth(req.headers.authorization);

      const challenge = () => {
        res.setHeader('WWW-Authenticate', 'Basic realm="Tina admin"');
        return {
          isAuthorized: false as const,
          errorMessage: 'Credenciais invalidas ou ausentes.',
          errorCode: 401,
        };
      };

      // Sem header Basic (ou malformado): 401 imediato, sem rodar scrypt. Esse
      // e o fluxo normal do browser (primeira request sem credenciais -> 401 ->
      // reenvia com credenciais), entao nao vale pagar scrypt aqui — o rate
      // limit no Traefik (ver docker-compose*.yml) cobre flood nesse caminho.
      if (!credentials) return challenge();

      // Com credenciais presentes, roda SEMPRE verifyPassword — inclusive com
      // usuario errado — pra o custo do scrypt nao revelar, por timing, se o
      // usuario existe: senao um usuario invalido retornaria rapido (curto-
      // circuito antes do scrypt) e o valido com senha errada retornaria lento.
      const userOk = safeEqual(credentials.user, adminUser);
      const passOk = verifyPassword(credentials.password, adminPasswordHash);
      if (!userOk || !passOk) return challenge();

      return { isAuthorized: true as const };
    },
  };
}

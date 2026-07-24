import { z } from 'zod';
import { modeVars } from './theme-css';

// Config de identidade/tema da marca, lida de env vars em build time.
// Textos longos (hero, sobre, FAQ, posts) NÃO vivem aqui — ficam como
// Markdown em src/content/{pages,faq,posts}. Ver .env.example.

// Valores hex (#rrggbb) em arquivos .env precisam de aspas — sem aspas,
// "#" inicia um comentário e o parser trunca o valor para "". Como
// zod .default() só entra em ação para `undefined`, não para "", este
// preprocess trata "" como "não definido" para que o default funcione
// mesmo se alguém esquecer as aspas.
const optional = (fallback: string) =>
  z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.string().default(fallback));

const schema = z.object({
  SITE_NAME: z.string().min(1, 'SITE_NAME é obrigatório'),
  SITE_URL: z.string().url('SITE_URL precisa ser uma URL válida (ex: https://minhamarca.com.br)'),
  SITE_DESCRIPTION: z.string().min(1, 'SITE_DESCRIPTION é obrigatório'),
  SITE_LOCATION: optional(''),
  SITE_LOCALE: optional('pt-BR'),
  SITE_AREA_SERVED: optional(''),
  THEME_DEFAULT_MODE: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.enum(['dark', 'light']).default('dark')
  ),

  THEME_BG_DARK: optional('#1c1512'),
  THEME_BG_LIGHT: optional('#faf6f0'),
  THEME_SURFACE_DARK: optional('#251c17'),
  THEME_SURFACE_LIGHT: optional('#f2ebe1'),
  THEME_SURFACE_RAISED_DARK: optional('#2f231d'),
  THEME_SURFACE_RAISED_LIGHT: optional('#e9ddcd'),
  THEME_INK_DARK: optional('#ede6dd'),
  THEME_INK_LIGHT: optional('#2a211b'),
  THEME_INK_MUTED_DARK: optional('#b3a294'),
  THEME_INK_MUTED_LIGHT: optional('#6b5d4f'),
  THEME_ACCENT_DARK: optional('#c9a54a'),
  THEME_ACCENT_LIGHT: optional('#806519'),
  THEME_ACCENT_SOFT_DARK: optional('#e4c877'),
  THEME_ACCENT_SOFT_LIGHT: optional('#886c1b'),
  THEME_ACCENT_2_DARK: optional('#cc7366'),
  THEME_ACCENT_2_LIGHT: optional('#8b3a2e'),
  THEME_LINE_DARK: optional('#3c2f27'),
  THEME_LINE_LIGHT: optional('#ddd0bd'),
  THEME_FONT_DISPLAY: optional("'Fraunces', Georgia, serif"),
  THEME_FONT_BODY: optional("'Inter', system-ui, sans-serif"),
  THEME_FONT_MONO: optional("'JetBrains Mono', ui-monospace, monospace"),
  THEME_FONT_IMPORT_URL: optional(
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap'
  ),
  THEME_TYPE_SCALE: optional('1'),
  THEME_SPACE_UNIT: optional('1rem'),
  THEME_SPACE_RATIO: optional('1.5'),
  THEME_RADIUS: optional('2px'),
  THEME_ACCENT_BORDER_WIDTH: optional('3px'),
});

// Nomes de env var descontinuados (renomeados pra separar valores de modo
// claro/escuro). Zod ignora chaves desconhecidas e cai no default — sem essa
// checagem, um .env desatualizado perderia a cor customizada da marca em
// silêncio em vez de falhar o build.
const DEPRECATED_THEME_KEYS: Record<string, string> = {
  THEME_BG: 'THEME_BG_DARK / THEME_BG_LIGHT',
  THEME_SURFACE: 'THEME_SURFACE_DARK / THEME_SURFACE_LIGHT',
  THEME_SURFACE_RAISED: 'THEME_SURFACE_RAISED_DARK / THEME_SURFACE_RAISED_LIGHT',
  THEME_INK: 'THEME_INK_DARK / THEME_INK_LIGHT',
  THEME_INK_MUTED: 'THEME_INK_MUTED_DARK / THEME_INK_MUTED_LIGHT',
  THEME_GOLD: 'THEME_ACCENT_DARK / THEME_ACCENT_LIGHT',
  THEME_GOLD_SOFT: 'THEME_ACCENT_SOFT_DARK / THEME_ACCENT_SOFT_LIGHT',
  THEME_CHERRY: 'THEME_ACCENT_2_DARK / THEME_ACCENT_2_LIGHT',
  THEME_LINE: 'THEME_LINE_DARK / THEME_LINE_LIGHT',
};

function checkDeprecatedKeys(env: Record<string, unknown>) {
  const found = Object.keys(DEPRECATED_THEME_KEYS).filter(
    (key) => env[key] !== undefined && env[key] !== ''
  );
  if (found.length === 0) return;
  const lines = found.map((key) => `  - ${key} → ${DEPRECATED_THEME_KEYS[key]}`).join('\n');
  throw new Error(
    `Configuração de marca inválida. As variáveis de tema abaixo foram renomeadas ` +
      `pra separar valores de modo claro/escuro e não têm mais efeito:\n${lines}\n` +
      `Atualize o .env da instância pra usar os novos nomes (ver .env.example).`
  );
}

function loadConfig() {
  checkDeprecatedKeys(import.meta.env);
  const parsed = schema.safeParse(import.meta.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(
      `Configuração de marca inválida. Confira o .env da instância:\n${issues}`
    );
  }
  return parsed.data;
}

const env = loadConfig();

export const brand = {
  name: env.SITE_NAME,
  url: env.SITE_URL,
  description: env.SITE_DESCRIPTION,
  location: env.SITE_LOCATION,
  locale: env.SITE_LOCALE,
  areaServed: env.SITE_AREA_SERVED,
};

export const theme = {
  defaultMode: env.THEME_DEFAULT_MODE,
  dark: {
    bg: env.THEME_BG_DARK,
    surface: env.THEME_SURFACE_DARK,
    surfaceRaised: env.THEME_SURFACE_RAISED_DARK,
    ink: env.THEME_INK_DARK,
    inkMuted: env.THEME_INK_MUTED_DARK,
    accent: env.THEME_ACCENT_DARK,
    accentSoft: env.THEME_ACCENT_SOFT_DARK,
    accent2: env.THEME_ACCENT_2_DARK,
    line: env.THEME_LINE_DARK,
  },
  light: {
    bg: env.THEME_BG_LIGHT,
    surface: env.THEME_SURFACE_LIGHT,
    surfaceRaised: env.THEME_SURFACE_RAISED_LIGHT,
    ink: env.THEME_INK_LIGHT,
    inkMuted: env.THEME_INK_MUTED_LIGHT,
    accent: env.THEME_ACCENT_LIGHT,
    accentSoft: env.THEME_ACCENT_SOFT_LIGHT,
    accent2: env.THEME_ACCENT_2_LIGHT,
    line: env.THEME_LINE_LIGHT,
  },
  fontDisplay: env.THEME_FONT_DISPLAY,
  fontBody: env.THEME_FONT_BODY,
  fontMono: env.THEME_FONT_MONO,
  fontImportUrl: env.THEME_FONT_IMPORT_URL,
  typeScale: env.THEME_TYPE_SCALE,
  spaceUnit: env.THEME_SPACE_UNIT,
  spaceRatio: env.THEME_SPACE_RATIO,
  radius: env.THEME_RADIUS,
  accentBorderWidth: env.THEME_ACCENT_BORDER_WIDTH,
};

// String de custom properties CSS injetada por BaseLayout.astro. `theme` só
// muda com um novo build (vem de env vars lidas em build time), então isso é
// calculado uma única vez aqui — evita reconstruir a mesma string em toda
// página renderizada.
export const themeVars = `:root{--font-display:${theme.fontDisplay};--font-body:${theme.fontBody};--font-mono:${theme.fontMono};--radius:${theme.radius};--accent-border-width:${theme.accentBorderWidth};--space-unit:${theme.spaceUnit};--space-ratio:${theme.spaceRatio}}html{font-size:calc(100% * ${theme.typeScale})}[data-theme="dark"]{${modeVars(theme.dark)}}[data-theme="light"]{${modeVars(theme.light)}}`;

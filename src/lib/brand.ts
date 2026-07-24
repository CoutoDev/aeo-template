import { z } from 'zod';

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
  THEME_BG: optional('#1c1512'),
  THEME_SURFACE: optional('#251c17'),
  THEME_SURFACE_RAISED: optional('#2f231d'),
  THEME_INK: optional('#ede6dd'),
  THEME_INK_MUTED: optional('#b3a294'),
  THEME_GOLD: optional('#c9a54a'),
  THEME_GOLD_SOFT: optional('#e4c877'),
  THEME_CHERRY: optional('#8b3a2e'),
  THEME_LINE: optional('#3c2f27'),
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

function loadConfig() {
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
  bg: env.THEME_BG,
  surface: env.THEME_SURFACE,
  surfaceRaised: env.THEME_SURFACE_RAISED,
  ink: env.THEME_INK,
  inkMuted: env.THEME_INK_MUTED,
  gold: env.THEME_GOLD,
  goldSoft: env.THEME_GOLD_SOFT,
  cherry: env.THEME_CHERRY,
  line: env.THEME_LINE,
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

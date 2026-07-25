import { z } from 'zod';
import { modeVars, type ThemeModeVars } from './theme-css';
import { SITE_URL_INVALID_MESSAGE } from './site-url';

// Config de identidade/tema da marca, lida de env vars em build time.
// Textos longos (hero, sobre, FAQ, posts) NÃO vivem aqui — ficam como
// Markdown em src/content/{pages,faq,posts}. Ver .env.example.

// Valores hex (#rrggbb) em arquivos .env precisam de aspas — sem aspas,
// "#" inicia um comentário e o parser trunca o valor para "". Como
// zod .default() só entra em ação para `undefined`, não para "", tratamos
// "" como ausente para que o default funcione mesmo se alguém esquecer
// as aspas.
const blankAsMissing = (value: unknown) => (value === '' ? undefined : value);

const optionalText = (fallback: string) =>
  z.preprocess(blankAsMissing, z.string().default(fallback));

const envSchema = z.object({
  // Identidade
  SITE_NAME: z.string().min(1, 'SITE_NAME é obrigatório'),
  SITE_URL: z.url(SITE_URL_INVALID_MESSAGE),
  SITE_DESCRIPTION: z.string().min(1, 'SITE_DESCRIPTION é obrigatório'),
  SITE_LOCATION: optionalText(''),
  SITE_LOCALE: optionalText('pt-BR'),
  SITE_AREA_SERVED: optionalText(''),

  // Tema — modo inicial (o visitante pode trocar; ver ThemeToggle.astro)
  THEME_DEFAULT_MODE: z.preprocess(blankAsMissing, z.enum(['dark', 'light']).default('dark')),

  // Tema — cores, um par DARK/LIGHT por token (ver ThemeModeVars)
  THEME_BG_DARK: optionalText('#1c1512'),
  THEME_BG_LIGHT: optionalText('#faf6f0'),
  THEME_SURFACE_DARK: optionalText('#251c17'),
  THEME_SURFACE_LIGHT: optionalText('#f2ebe1'),
  THEME_SURFACE_RAISED_DARK: optionalText('#2f231d'),
  THEME_SURFACE_RAISED_LIGHT: optionalText('#e9ddcd'),
  THEME_INK_DARK: optionalText('#ede6dd'),
  THEME_INK_LIGHT: optionalText('#2a211b'),
  THEME_INK_MUTED_DARK: optionalText('#b3a294'),
  THEME_INK_MUTED_LIGHT: optionalText('#6b5d4f'),
  THEME_ACCENT_DARK: optionalText('#c9a54a'),
  THEME_ACCENT_LIGHT: optionalText('#806519'),
  THEME_ACCENT_SOFT_DARK: optionalText('#e4c877'),
  THEME_ACCENT_SOFT_LIGHT: optionalText('#886c1b'),
  THEME_ACCENT_2_DARK: optionalText('#cc7366'),
  THEME_ACCENT_2_LIGHT: optionalText('#8b3a2e'),
  THEME_LINE_DARK: optionalText('#3c2f27'),
  THEME_LINE_LIGHT: optionalText('#ddd0bd'),

  // Tema — tipografia
  THEME_FONT_DISPLAY: optionalText("'Fraunces', Georgia, serif"),
  THEME_FONT_BODY: optionalText("'Inter', system-ui, sans-serif"),
  THEME_FONT_MONO: optionalText("'JetBrains Mono', ui-monospace, monospace"),
  THEME_FONT_IMPORT_URL: optionalText(
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap'
  ),
  THEME_TYPE_SCALE: optionalText('1'),

  // Tema — espaçamento e formas
  THEME_SPACE_UNIT: optionalText('1rem'),
  THEME_SPACE_RATIO: optionalText('1.5'),
  THEME_RADIUS: optionalText('2px'),
  THEME_ACCENT_BORDER_WIDTH: optionalText('3px'),
});

type BrandEnv = z.infer<typeof envSchema>;

function loadEnv(): BrandEnv {
  const parsed = envSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuração de marca inválida. Confira o .env da instância:\n${issues}`);
  }
  return parsed.data;
}

const env = loadEnv();

// Monta os tokens de um modo a partir do sufixo das env vars (_DARK/_LIGHT),
// garantindo que os dois modos exponham exatamente o mesmo conjunto.
function colorsFor(mode: 'DARK' | 'LIGHT'): ThemeModeVars {
  return {
    bg: env[`THEME_BG_${mode}`],
    surface: env[`THEME_SURFACE_${mode}`],
    surfaceRaised: env[`THEME_SURFACE_RAISED_${mode}`],
    ink: env[`THEME_INK_${mode}`],
    inkMuted: env[`THEME_INK_MUTED_${mode}`],
    accent: env[`THEME_ACCENT_${mode}`],
    accentSoft: env[`THEME_ACCENT_SOFT_${mode}`],
    accent2: env[`THEME_ACCENT_2_${mode}`],
    line: env[`THEME_LINE_${mode}`],
  };
}

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
  dark: colorsFor('DARK'),
  light: colorsFor('LIGHT'),
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

// Tokens que não dependem do modo claro/escuro.
const rootVars = [
  `--font-display:${theme.fontDisplay}`,
  `--font-body:${theme.fontBody}`,
  `--font-mono:${theme.fontMono}`,
  `--radius:${theme.radius}`,
  `--accent-border-width:${theme.accentBorderWidth}`,
  `--space-unit:${theme.spaceUnit}`,
  `--space-ratio:${theme.spaceRatio}`,
].join(';');

// String de custom properties CSS injetada por BaseLayout.astro. `theme` só
// muda com um novo build (vem de env vars lidas em build time), então isso é
// calculado uma única vez aqui — evita reconstruir a mesma string em toda
// página renderizada.
export const themeVars = [
  `:root{${rootVars}}`,
  `html{font-size:calc(100% * ${theme.typeScale})}`,
  `[data-theme="dark"]{${modeVars(theme.dark)}}`,
  `[data-theme="light"]{${modeVars(theme.light)}}`,
].join('');

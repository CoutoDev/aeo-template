import { z } from 'zod';
import { modeVars, type ThemeModeVars } from './theme-css';
import { SITE_URL_INVALID_MESSAGE } from './site-url';
import { BRAND_PRESETS } from './brand-presets';

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

// Tema padrão do template: o primeiro preset do design system. Uma instância
// sem nenhum THEME_* no .env sai com a cara dele; cada variável definida
// sobrescreve o token correspondente.
const DEFAULT_PRESET = BRAND_PRESETS[0];

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
  THEME_BG_DARK: optionalText(DEFAULT_PRESET.dark.bg),
  THEME_BG_LIGHT: optionalText(DEFAULT_PRESET.light.bg),
  THEME_SURFACE_DARK: optionalText(DEFAULT_PRESET.dark.surface),
  THEME_SURFACE_LIGHT: optionalText(DEFAULT_PRESET.light.surface),
  THEME_SURFACE_RAISED_DARK: optionalText(DEFAULT_PRESET.dark.surfaceRaised),
  THEME_SURFACE_RAISED_LIGHT: optionalText(DEFAULT_PRESET.light.surfaceRaised),
  THEME_INK_DARK: optionalText(DEFAULT_PRESET.dark.ink),
  THEME_INK_LIGHT: optionalText(DEFAULT_PRESET.light.ink),
  THEME_INK_MUTED_DARK: optionalText(DEFAULT_PRESET.dark.inkMuted),
  THEME_INK_MUTED_LIGHT: optionalText(DEFAULT_PRESET.light.inkMuted),
  THEME_ACCENT_DARK: optionalText(DEFAULT_PRESET.dark.accent),
  THEME_ACCENT_LIGHT: optionalText(DEFAULT_PRESET.light.accent),
  THEME_ACCENT_SOFT_DARK: optionalText(DEFAULT_PRESET.dark.accentSoft),
  THEME_ACCENT_SOFT_LIGHT: optionalText(DEFAULT_PRESET.light.accentSoft),
  THEME_ACCENT_2_DARK: optionalText(DEFAULT_PRESET.dark.accent2),
  THEME_ACCENT_2_LIGHT: optionalText(DEFAULT_PRESET.light.accent2),
  THEME_LINE_DARK: optionalText(DEFAULT_PRESET.dark.line),
  THEME_LINE_LIGHT: optionalText(DEFAULT_PRESET.light.line),

  // Tema — tipografia. Corpo e mono são do template (todos os presets usam as
  // mesmas), só a display vem do preset.
  THEME_FONT_DISPLAY: optionalText(DEFAULT_PRESET.fontDisplay),
  THEME_FONT_BODY: optionalText("'Inter', system-ui, sans-serif"),
  THEME_FONT_MONO: optionalText("'JetBrains Mono', ui-monospace, monospace"),
  THEME_FONT_IMPORT_URL: optionalText(DEFAULT_PRESET.fontImportUrl),
  THEME_TYPE_SCALE: optionalText('1'),

  // Tema — espaçamento e formas
  THEME_SPACE_UNIT: optionalText('1rem'),
  THEME_SPACE_RATIO: optionalText(String(DEFAULT_PRESET.spaceRatio)),
  THEME_RADIUS: optionalText(DEFAULT_PRESET.radius),
  THEME_ACCENT_BORDER_WIDTH: optionalText(DEFAULT_PRESET.accentBorderWidth),
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

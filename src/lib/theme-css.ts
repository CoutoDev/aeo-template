// Fonte única do mapeamento token -> custom property CSS. Usado tanto no
// servidor (BaseLayout.astro, com os valores reais da marca) quanto no
// cliente (BrandPresetSwitcher.astro, dev-only, com os presets do design
// system) — evita duplicar essa lista em dois lugares fora de sincronia.
export interface ThemeModeVars {
  bg: string;
  surface: string;
  surfaceRaised: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentSoft: string;
  accent2: string;
  line: string;
}

/** Declarações CSS (sem chaves) dos tokens de um modo claro/escuro. */
export function modeVars(colors: ThemeModeVars): string {
  return [
    `--bg:${colors.bg}`,
    `--surface:${colors.surface}`,
    `--surface-raised:${colors.surfaceRaised}`,
    `--ink:${colors.ink}`,
    `--ink-muted:${colors.inkMuted}`,
    `--accent:${colors.accent}`,
    `--accent-soft:${colors.accentSoft}`,
    `--accent-2:${colors.accent2}`,
    `--line:${colors.line}`,
  ].join(';');
}

// Label do botão de alternância de tema (ThemeToggle.astro), usado tanto no
// aria-label renderizado no servidor (a partir de THEME_DEFAULT_MODE) quanto
// no client script que resincroniza depois da resolução de tema no <head>.
export function themeLabel(currentMode: string): string {
  return currentMode === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro';
}

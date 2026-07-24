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

export function modeVars(m: ThemeModeVars): string {
  return (
    `--bg:${m.bg};--surface:${m.surface};--surface-raised:${m.surfaceRaised};` +
    `--ink:${m.ink};--ink-muted:${m.inkMuted};--accent:${m.accent};` +
    `--accent-soft:${m.accentSoft};--accent-2:${m.accent2};--line:${m.line}`
  );
}

// Label do botão de alternância de tema (ThemeToggle.astro), usado tanto no
// aria-label renderizado no servidor (a partir de THEME_DEFAULT_MODE) quanto
// no client script que resincroniza depois da resolução de tema no <head>.
export function themeLabel(mode: string): string {
  return mode === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro';
}

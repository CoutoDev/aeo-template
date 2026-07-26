// Presets de marca do "Design System (Standalone).html". O primeiro da lista é
// o tema padrão do template: é ele que o site usa quando o .env da instância
// não define nenhum THEME_* (ver src/lib/brand.ts). Os outros existem para
// comparação visual em dev (ver src/components/BrandPresetSwitcher.astro).
// fontBody/fontMono não entram aqui porque todos os presets usam as mesmas
// (Inter / JetBrains Mono) — só a display muda.

import type { ThemeModeVars } from './theme-css';

// Cada preset carrega o import completo das suas famílias (a display + as
// compartilhadas): qualquer um pode ser o padrão da instância, e em dev o
// switcher aplica um preset por cima do import que já veio no <head>.
const SHARED_FONT_FAMILIES = 'family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500';
const FRAUNCES = 'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600';
const SPACE_GROTESK = 'Space+Grotesk:wght@400;500;600';

const googleFontsUrl = (displayFamily: string) =>
  `https://fonts.googleapis.com/css2?family=${displayFamily}&${SHARED_FONT_FAMILIES}&display=swap`;

export interface BrandPreset {
  key: string;
  name: string;
  tagline: string;
  fontDisplay: string;
  fontImportUrl: string;
  radius: string;
  accentBorderWidth: string;
  spaceRatio: number;
  dark: ThemeModeVars;
  light: ThemeModeVars;
}

// Tipo de lista não-vazia: brand.ts depende de BRAND_PRESETS[0] existir.
export const BRAND_PRESETS: [BrandPreset, ...BrandPreset[]] = [
  {
    key: 'nordwell',
    name: 'Nordwell',
    tagline: 'Cool, precise, engineering-grade.',
    fontDisplay: "'Space Grotesk', system-ui, sans-serif",
    fontImportUrl: googleFontsUrl(SPACE_GROTESK),
    radius: '6px',
    accentBorderWidth: '3px',
    spaceRatio: 1.5,
    dark: {
      bg: '#1a2332', surface: '#232e3d', surfaceRaised: '#2c3a47',
      ink: '#f5f7fa', inkMuted: '#a8b3c1', line: '#485563',
      accent: '#5eb3ff', accentSoft: '#d1e7ff', accent2: '#64b5f6',
    },
    light: {
      bg: '#fafbfc', surface: '#f2f5f8', surfaceRaised: '#e9ecf1',
      ink: '#38464f', inkMuted: '#758699', line: '#d9dfe6',
      accent: '#0969da', accentSoft: '#54aeff', accent2: '#0973c3',
    },
  },
  {
    key: 'ember',
    name: 'Ember & Oak',
    tagline: 'Warm, crafted, artisanal.',
    fontDisplay: "'Fraunces', Georgia, serif",
    fontImportUrl: googleFontsUrl(FRAUNCES),
    radius: '2px',
    accentBorderWidth: '4px',
    spaceRatio: 1.5,
    dark: {
      bg: '#2a1810', surface: '#342015', surfaceRaised: '#3e2a1a',
      ink: '#f3f0ed', inkMuted: '#a88a6f', line: '#4a3428',
      accent: '#d4a574', accentSoft: '#e8c9a8', accent2: '#9d5a2f',
    },
    light: {
      bg: '#faf8f6', surface: '#f0ede8', surfaceRaised: '#e7e1da',
      ink: '#3d2817', inkMuted: '#8b6f57', line: '#d9cec2',
      accent: '#b86f2d', accentSoft: '#d99857', accent2: '#934a1c',
    },
  },
  {
    key: 'verdant',
    name: 'Verdant Supply',
    tagline: 'Grounded, sustainable, direct.',
    fontDisplay: "'Fraunces', Georgia, serif",
    fontImportUrl: googleFontsUrl(FRAUNCES),
    radius: '16px',
    accentBorderWidth: '3px',
    spaceRatio: 1.45,
    dark: {
      bg: '#1a2e1f', surface: '#1f3825', surfaceRaised: '#25422a',
      ink: '#f3f7f5', inkMuted: '#7fa88a', line: '#2e4a37',
      accent: '#4eae5e', accentSoft: '#8ed0a1', accent2: '#6cb566',
    },
    light: {
      bg: '#faf9f8', surface: '#f0f3f1', surfaceRaised: '#e8eceb',
      ink: '#1d3a24', inkMuted: '#5f7d68', line: '#d7ddd9',
      accent: '#2d8659', accentSoft: '#5ba876', accent2: '#4a8c5f',
    },
  },
];

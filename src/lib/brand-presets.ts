// Presets de marca do "Design System (Standalone).html" — só pra comparação
// visual em dev (ver src/components/BrandPresetSwitcher.astro). Não é config
// de marca real: a marca desta instância continua vindo só de THEME_* (.env)
// via src/lib/brand.ts. fontBody/fontMono não entram aqui porque os 3
// presets usam os mesmos (Inter / JetBrains Mono, já carregados por padrão).

import type { ThemeModeVars } from './theme-css';

export interface BrandPreset {
  key: string;
  name: string;
  tagline: string;
  fontDisplay: string;
  fontImportUrl?: string;
  radius: string;
  accentBorderWidth: string;
  spaceRatio: number;
  dark: ThemeModeVars;
  light: ThemeModeVars;
}

export const BRAND_PRESETS: BrandPreset[] = [
  {
    key: 'nordwell',
    name: 'Nordwell',
    tagline: 'Cool, precise, engineering-grade.',
    fontDisplay: "'Space Grotesk', system-ui, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap',
    radius: '6px',
    accentBorderWidth: '3px',
    spaceRatio: 1.5,
    dark: {
      bg: 'oklch(0.17 0.014 240)', surface: 'oklch(0.22 0.016 240)', surfaceRaised: 'oklch(0.27 0.018 240)',
      ink: 'oklch(0.96 0.006 240)', inkMuted: 'oklch(0.68 0.02 240)', line: 'oklch(0.34 0.02 240)',
      accent: 'oklch(0.72 0.15 235)', accentSoft: 'oklch(0.82 0.11 235)', accent2: 'oklch(0.75 0.13 190)',
    },
    light: {
      bg: 'oklch(0.985 0.004 240)', surface: 'oklch(0.95 0.008 240)', surfaceRaised: 'oklch(0.91 0.01 240)',
      ink: 'oklch(0.22 0.02 240)', inkMuted: 'oklch(0.46 0.02 240)', line: 'oklch(0.85 0.012 240)',
      accent: 'oklch(0.52 0.16 235)', accentSoft: 'oklch(0.62 0.14 235)', accent2: 'oklch(0.55 0.14 190)',
    },
  },
  {
    key: 'ember',
    name: 'Ember & Oak',
    tagline: 'Warm, crafted, artisanal.',
    fontDisplay: "'Fraunces', Georgia, serif",
    radius: '2px',
    accentBorderWidth: '4px',
    spaceRatio: 1.5,
    dark: {
      bg: 'oklch(0.19 0.018 45)', surface: 'oklch(0.24 0.02 45)', surfaceRaised: 'oklch(0.29 0.022 45)',
      ink: 'oklch(0.95 0.012 60)', inkMuted: 'oklch(0.68 0.03 50)', line: 'oklch(0.35 0.025 45)',
      accent: 'oklch(0.72 0.14 75)', accentSoft: 'oklch(0.82 0.11 80)', accent2: 'oklch(0.55 0.16 30)',
    },
    light: {
      bg: 'oklch(0.98 0.008 60)', surface: 'oklch(0.94 0.014 55)', surfaceRaised: 'oklch(0.9 0.018 55)',
      ink: 'oklch(0.24 0.02 40)', inkMuted: 'oklch(0.48 0.025 45)', line: 'oklch(0.84 0.018 50)',
      accent: 'oklch(0.56 0.15 55)', accentSoft: 'oklch(0.66 0.13 60)', accent2: 'oklch(0.5 0.16 30)',
    },
  },
  {
    key: 'verdant',
    name: 'Verdant Supply',
    tagline: 'Grounded, sustainable, direct.',
    fontDisplay: "'Fraunces', Georgia, serif",
    radius: '16px',
    accentBorderWidth: '3px',
    spaceRatio: 1.45,
    dark: {
      bg: 'oklch(0.18 0.015 140)', surface: 'oklch(0.23 0.018 140)', surfaceRaised: 'oklch(0.28 0.02 140)',
      ink: 'oklch(0.95 0.01 120)', inkMuted: 'oklch(0.67 0.025 130)', line: 'oklch(0.34 0.022 140)',
      accent: 'oklch(0.68 0.14 145)', accentSoft: 'oklch(0.78 0.12 145)', accent2: 'oklch(0.7 0.1 95)',
    },
    light: {
      bg: 'oklch(0.98 0.006 120)', surface: 'oklch(0.94 0.012 120)', surfaceRaised: 'oklch(0.9 0.016 120)',
      ink: 'oklch(0.23 0.018 130)', inkMuted: 'oklch(0.47 0.02 130)', line: 'oklch(0.84 0.014 125)',
      accent: 'oklch(0.5 0.14 145)', accentSoft: 'oklch(0.6 0.13 145)', accent2: 'oklch(0.55 0.11 95)',
    },
  },
];

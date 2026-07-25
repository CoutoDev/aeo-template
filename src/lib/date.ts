import { brand } from './brand';

// Datas visíveis seguem o locale da marca (SITE_LOCALE), não o do servidor
// que roda o build.

/** Ex.: "24 de jul. de 2026" em pt-BR. Usado em listagens e cards. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(brand.locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Ex.: "24 de julho de 2026" em pt-BR. Usado na assinatura do artigo. */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(brand.locale, { day: '2-digit', month: 'long', year: 'numeric' });
}

// SITE_URL é validada em dois momentos: em astro.config.mjs, que precisa dela
// para `site` antes de qualquer módulo do site rodar, e no schema de brand.ts,
// junto com o resto da config da marca. A mensagem mora aqui para as duas
// falharem dizendo a mesma coisa.
export const SITE_URL_INVALID_MESSAGE =
  'SITE_URL precisa ser uma URL válida (ex: https://minhamarca.com.br)';

/** Mesmo parsing de URL que o z.url() de brand.ts aplica. */
export function isValidSiteUrl(value: string): boolean {
  return URL.canParse(value);
}

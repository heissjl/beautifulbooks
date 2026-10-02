/**
 * The language the site speaks (SPEC §2.6, decision E23, ROADMAP 6.82).
 *
 * English is the default and the only language a crawler sees. A reader
 * switches at the top of the page; the choice is a cookie, and `proxy.ts`
 * rewrites a request that carries it to the mirrored tree under `app/de/`,
 * so the address never changes and every page keeps its own cache
 * (prerender, ISR) per language.
 *
 * Pure and client-safe: nothing here reads a request.
 */
export type Locale = 'en' | 'de';

export const LOCALES: readonly Locale[] = ['en', 'de'];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie holding the reader's explicit choice; set only when the switch is used. */
export const LOCALE_COOKIE = 'locale';

/** The name of each language in itself, for the switch. */
export const LOCALE_NAME: Record<Locale, string> = { en: 'English', de: 'Deutsch' };

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'de';
}

export function normalizeLocale(raw: string | null | undefined): Locale | undefined {
  const v = (raw ?? '').trim().toLowerCase();
  return isLocale(v) ? v : undefined;
}

/** The BCP 47 tag `toLocaleString` and `Intl` take for a locale. */
export function intlTag(locale: Locale): string {
  return locale === 'de' ? 'de-DE' : 'en-GB';
}

/**
 * The language the site speaks (SPEC §2.6, decision E23, ROADMAP 6.85).
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

/** A year: the choice is remembered, nothing else about the reader is. */
export const LOCALE_COOKIE_MAX_AGE = 31_536_000;

/**
 * The cookie's attributes, written once for both writers (ROADMAP 6.106): the
 * browser in the hydrated switch and the server in `/api/locale/<locale>`.
 * Two writers with two attribute lists drifted apart elsewhere before.
 */
export function localeCookieOptions(): { path: '/'; maxAge: number; sameSite: 'lax' } {
  return { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax' };
}

/** The same attributes as a `document.cookie` string. */
export function localeCookieString(locale: Locale): string {
  const o = localeCookieOptions();
  return `${LOCALE_COOKIE}=${locale}; path=${o.path}; max-age=${o.maxAge}; samesite=${o.sameSite}`;
}

/**
 * Where `/api/locale/<locale>` sends the reader back (ROADMAP 6.106). The
 * same-origin referer wins, with its query, so a search keeps its words;
 * otherwise a `back` that is one plain path — exactly one leading slash, no
 * `//`, no backslash, no scheme — else the home page. Like `/go/`, the route
 * never redirects to an address the request made up: that is an open redirect.
 */
export function backTarget(referer: string | null | undefined, back: string | null | undefined, origin: string): string {
  if (referer) {
    try {
      const u = new URL(referer);
      if (u.origin === origin && !u.pathname.startsWith('/api/')) return `${u.pathname}${u.search}`;
    } catch {
      // not a URL
    }
  }
  if (back && /^\/(?![/\\])/.test(back) && !back.includes('\\') && !/[\r\n]/.test(back)) return back;
  return '/';
}

/** The BCP 47 tag `toLocaleString` and `Intl` take for a locale. */
export function intlTag(locale: Locale): string {
  return locale === 'de' ? 'de-DE' : 'en-GB';
}

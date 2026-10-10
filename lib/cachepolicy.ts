/**
 * How long the CDN may keep an answer of the cached API routes (ROADMAP 2.18e,
 * red team B3, 2026-10-10). Pure.
 *
 * Until then every answer of `/api/search`, `/api/works` and `/api/isbn` was
 * kept a day, the silent ones too: after one Google 503 an ISBN read "could
 * not be checked" for every reader for 24 hours, and a page 0 built without
 * Google's covers stayed short of them for as long. A failure is not a finding
 * (N12), and a cache must not turn it into one. So:
 *
 * - a **full** answer keeps the day, and adds `stale-if-error`: when the route
 *   fails later, the CDN serves the last good answer instead of the error;
 * - an answer built while a source was **silent** is kept a minute, so the
 *   next reader asks again — the catalogue's own responses sit in Next's data
 *   cache, so asking again costs a function call, not an Open Library request;
 * - an answer that **is** the silence (`unavailable`) is never kept.
 */

/** A day at the CDN, a week of serving it stale while it refreshes, a day of serving it when the route errors. */
export const CACHE_FULL = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=86400';
/** A minute: the answer is real but incomplete, because a source did not answer. */
export const CACHE_DEGRADED = 'public, max-age=0, s-maxage=60';
/** An hour: the stand-in answer of Open Library while Google could not be asked (1.12) — weaker evidence, refreshed sooner. */
export const CACHE_STAND_IN = 'public, max-age=0, s-maxage=3600, stale-if-error=86400';
export const CACHE_NONE = 'no-store';

/** `/api/isbn`: nothing when nobody answered, an hour for the catalogue's stand-in, a day for Google's answer. */
export function isbnCacheControl(answer: { unavailable?: boolean; source?: 'googlebooks' | 'openlibrary' }): string {
  if (answer.unavailable) return CACHE_NONE;
  if (answer.source === 'openlibrary') return CACHE_STAND_IN;
  return CACHE_FULL;
}

/** `/api/works`: a minute when page 0 was built without Google's answer, otherwise the day. */
export function worksCacheControl(page: { googleSilent?: boolean }): string {
  return page.googleSilent ? CACHE_DEGRADED : CACHE_FULL;
}

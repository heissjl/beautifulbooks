/**
 * Which pages the sitemap offers, and with which date (ROADMAP 6.107 step 1;
 * Julian, 2026-10-10: „dann die sammlungen und einige der jahrzehnte seiten,
 * und erstmal keine buchseiten“). Pure.
 *
 * The research of 2026-10-10 (docs/seo-recherche-2026-10-10.md): Google rates
 * a young site as a whole, and many pages that mostly rearrange catalogue data
 * can weigh on it. Until then the sitemap pushed 500 book pages and 322 decade
 * pages beside ~60 collections, all with `lastmod` = now — which Google ignores
 * unless it is "consistently and verifiably" right, and Bing reads as wrong.
 *
 * Now: the collections (the site's own work), and the decade pages of works
 * that stand in a published collection **and** have at least DECADE_MIN_COVERS
 * covers — where a decade page has something to say. No book pages: they stay
 * reachable and linked, and a crawler finds them through the collections; the
 * sitemap just no longer pushes them. `lastmod` is the newest `addedAt` of a
 * collection's picks — the day it last grew — never the build's clock.
 */
export const DECADE_MIN_COVERS = 60;

export interface PickDates { slug: string; addedAt: Array<string | undefined> }
export interface DecadePage { id: string; coverCount: number }

/** The day a collection last grew, `YYYY-MM-DD`, or undefined when no pick carries a date. */
export function lastGrown(addedAt: ReadonlyArray<string | undefined>): string | undefined {
  const days = addedAt.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)).map(d => d.slice(0, 10));
  return days.length ? days.sort().at(-1) : undefined;
}

/** Decade pages worth offering: their work is in a published collection and has enough covers. */
export function decadePagesToOffer(pages: readonly DecadePage[], worksInCollections: ReadonlySet<string>): DecadePage[] {
  return pages.filter(p => worksInCollections.has(p.id) && p.coverCount >= DECADE_MIN_COVERS);
}

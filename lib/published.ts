/**
 * The works this site points at: sitemap entries, and the works whose decade
 * page is measured before a deploy (ROADMAP 5.1, 5.4a).
 *
 * **The index list is the publish list.** `data/index-works.json` already
 * decides which works have cover signatures on disk, and a work without them
 * renders a decade page that folds nothing — the duplicate covers of
 * 2026-09-09. Pointing at a work we have not indexed would therefore publish
 * the worse version of the page, so the two lists are deliberately the same
 * one.
 *
 * Curated works (`lib/curated.ts`) are a subset with a hand-picked cover for
 * the wall; a promoted work has no cover pick and does not need one.
 *
 * Server-side only in practice, but it carries no images and no signatures —
 * 139 works are a few kilobytes of ids and titles, unlike
 * `lib/coverindex.ts`, which must never reach the browser.
 */
import indexWorks from '@/data/index-works.json';

export interface PublishedWork {
  id: string;
  title: string;
  author: string;
}

interface RawWork {
  id: string;
  title: string;
  author: string;
  editionCount?: number;
  source?: string;
}

const WORK_ID = /^OL\d+W$/;

/**
 * Every work we are willing to point at, in the order the list carries them.
 *
 * A malformed id is dropped rather than trusted: this list feeds the sitemap,
 * and an address that cannot exist is worse than a missing one.
 */
export const PUBLISHED_WORKS: PublishedWork[] = (indexWorks as { works: RawWork[] }).works
  .filter(w => WORK_ID.test(w.id))
  .map(w => ({ id: w.id, title: w.title, author: w.author }));

export function isPublished(workId: string): boolean {
  return PUBLISHED_WORKS.some(w => w.id === workId);
}

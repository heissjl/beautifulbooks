/**
 * The order of Walls by readers (ROADMAP 5.13d; Julian, 2026-09-28: „reihenfolge
 * ist ein mix aus neu, klicks und randomness, damit alle eine chance bekommen
 * gesehen zu werden"). Pure; the weights are set, not measured — there are no
 * readers' walls yet to measure them on.
 *
 * score = log2(1 + views) + FRESH × ½^(age / HALF_LIFE) + LUCK × random
 *
 * Views count logarithmically, so a wall with a hundred views is not a
 * hundred times ahead of a new one; a new wall starts with FRESH points that
 * halve every week; and each visit draws its own luck. The luck comes from a
 * seed and the wall's id, so one visit keeps one order while it loads more
 * pages, and the next visit gets another.
 */
import { rng } from '@/lib/loading';

export const FRESH = 4;
export const HALF_LIFE_DAYS = 7;
/**
 * Measured 2026-09-28 over 1,000 visits (40 walls with 0–4 views, one old
 * wall nobody opened, one with 500 views): LUCK 3 put the unopened wall on the
 * first page on 16 % of visits, 4 on 28 %, 5 on 36 %, 6 on 40 %, 8 on 44 %;
 * the 500-view wall stayed in the top five on every visit up to 6 (99.4 % at 8).
 */
export const LUCK = 5;
export const FIRST_PAGE = 26;
export const NEXT_PAGE = 26;

export interface Rankable {
  id: string;
  createdOn: string;
  views: number;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function score(item: Rankable, seed: number, now: number): number {
  const ageDays = Math.max(0, (now - Date.parse(item.createdOn)) / 86_400_000) || 0;
  const luck = rng((seed ^ hashId(item.id)) >>> 0)();
  return Math.log2(1 + Math.max(0, item.views)) + FRESH * 0.5 ** (ageDays / HALF_LIFE_DAYS) + LUCK * luck;
}

export function readerOrder<T extends Rankable>(items: readonly T[], seed: number, now: number): T[] {
  return items
    .map((item) => ({ item, s: score(item, seed, now) }))
    .sort((a, b) => b.s - a.s || a.item.id.localeCompare(b.item.id))
    .map((x) => x.item);
}

/** A page of the order: the first page is larger than the ones that follow a scroll. */
export function pageOf<T>(ordered: readonly T[], offset: number): { items: T[]; next: number | null } {
  const size = offset === 0 ? FIRST_PAGE : NEXT_PAGE;
  const items = ordered.slice(offset, offset + size);
  const end = offset + items.length;
  return { items, next: end < ordered.length ? end : null };
}

/** A seed from the address, or a fresh one. */
export function parseSeed(raw: string | null | undefined): number | null {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 0 && n < 2 ** 32 ? n : null;
}

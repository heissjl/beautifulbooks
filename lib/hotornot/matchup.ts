import { coverIdFromSegment, coverPathSegment } from '../coverurl';

/**
 * A permanent address for one pairing of the cover game (ROADMAP 6.97;
 * Julian, 2026-10-06: „can you make permanent links to specific matchups that
 * i can use for advertising?").
 *
 * `/versus/ol-15154344-vs-ol-10215294` always opens the game on that pair —
 * the picture in a post and the page behind it then show the same two covers.
 * The address carries the two cover ids as the share links do
 * (`coverPathSegment`, colon → dash), and `-vs-` between them, because that is
 * what the pairing is called in the post.
 *
 * Pure: whether those covers are in the pool is the page's question, not this
 * module's.
 */
export const MATCHUP_SEPARATOR = '-vs-';

/** `ol:15154344`, `ol:10215294` → `ol-15154344-vs-ol-10215294`. */
export function matchupSlug(a: string, b: string): string {
  return `${coverPathSegment(a)}${MATCHUP_SEPARATOR}${coverPathSegment(b)}`;
}

/** The address of a pairing, the form to paste into a post. */
export function matchupPath(a: string, b: string): string {
  return `/versus/${matchupSlug(a, b)}`;
}

/**
 * The two cover ids in an address, or null when it is not a pairing — `board`
 * is a page of its own, and anything else a stranger types is simply not one.
 * A cover facing itself is not a pairing either.
 */
export function parseMatchup(slug: string | undefined): { a: string; b: string } | null {
  if (!slug) return null;
  const parts = slug.split(MATCHUP_SEPARATOR);
  if (parts.length !== 2) return null;
  const a = coverIdFromSegment(parts[0]);
  const b = coverIdFromSegment(parts[1]);
  if (!a || !b || a === b) return null;
  return { a, b };
}

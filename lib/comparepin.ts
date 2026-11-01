/**
 * Which three covers a comparison pin shows (ROADMAP 5.5a, the second
 * format; pure). The route and `scripts/pin-list.ts` both run this on the
 * same folded covers, so the list can name the covers it saw in the
 * picture's address and the picture draws those — a cover's place on a page
 * of the catalogue changes, an id does not.
 *
 * Asked for by id: the covers named, in that order, when the work has them
 * (an id folded under another scan counts as that scan). Without ids: the
 * oldest cover with a known year, then the oldest of each further decade,
 * three in all — a book across its decades is the point of the format; a
 * work with fewer than three dated decades gets its oldest dated covers,
 * and one with fewer than three dated covers the first on the wall. A few
 * spares follow in the same order, for a cover host that does not answer.
 */
import type { Cover, Edition } from './model';

export interface CompareCandidate {
  cover: Cover;
  /** The earliest year among the editions that carry this cover. */
  year?: number;
  /** The publisher of that edition, or of the first edition when none is dated. */
  publisher?: string;
}

/** What is known about the printing a cover stands for: the earliest dated edition wins, as on the decade page. */
export function coverFacts(cover: Cover, editionsById: ReadonlyMap<string, Edition>): { year?: number; publisher?: string } {
  let best: Edition | undefined;
  let first: Edition | undefined;
  for (const id of cover.editionIds) {
    const e = editionsById.get(id);
    if (!e) continue;
    first ??= e;
    if (e.year && (!best || !best.year || e.year < best.year)) best = e;
  }
  const picked = best ?? first;
  const publisher = picked?.publisher?.trim();
  return { year: picked?.year, publisher: publisher && !PLACEHOLDER.test(publisher) ? publisher : undefined };
}

/** What a catalogue writes where it has no publisher: "[publisher not identified]", "[s.n.]", "Unknown". */
const PLACEHOLDER = /^\[.*\]$|^(unknown|n\/a|s\.\s?n\.?)$|not identified/i;

/** A cover by its id, or the cover another id was folded into. */
export function findCover(covers: readonly Cover[], id: string): Cover | undefined {
  return covers.find(c => c.id === id) ?? covers.find(c => c.similarIds?.includes(id));
}

export function pickCompareCovers(
  covers: readonly Cover[],
  editions: readonly Edition[],
  requested: readonly string[] = [],
  want = 3,
  spare = 3,
): CompareCandidate[] {
  const byId = new Map(editions.map(e => [e.id, e]));
  const facts = new Map(covers.map(c => [c.id, coverFacts(c, byId)]));
  const ordered: Cover[] = [];
  const take = (c: Cover | undefined) => {
    if (c && !ordered.includes(c)) ordered.push(c);
  };

  for (const id of requested.slice(0, want)) take(findCover(covers, id));

  // Oldest first; a tie keeps the wall's order (sort is stable).
  const dated = covers.filter(c => facts.get(c.id)?.year).sort((a, b) => facts.get(a.id)!.year! - facts.get(b.id)!.year!);
  const decades = new Set<number>();
  for (const c of dated) {
    const decade = Math.floor(facts.get(c.id)!.year! / 10) * 10;
    if (decades.has(decade)) continue;
    decades.add(decade);
    take(c);
  }
  for (const c of dated) take(c);
  for (const c of covers) take(c);

  return ordered.slice(0, want + spare).map(cover => ({ cover, ...facts.get(cover.id) }));
}

/** Left to right: as asked for when ids were given, else by year, the undated last. */
export function compareOrder<T extends { year?: number }>(shown: readonly T[], explicit: boolean): T[] {
  if (explicit) return [...shown];
  return [...shown].sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
}

/** The `?covers=` parameter: up to three cover ids of the forms the site uses, anything else dropped. */
export function parseCoverIds(param: string | null, max = 3): string[] {
  if (!param) return [];
  const out: string[] = [];
  for (const raw of param.split(',')) {
    const id = raw.trim();
    if (/^(ol|gb):[A-Za-z0-9_-]{1,40}$/.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

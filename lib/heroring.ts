/**
 * Which curated works get a ring on the home page, and which seven covers
 * (ROADMAP 1.9; Julian 2026-09-11: „es sollte wechseln zwischen werken aus
 * der kuratierten liste, die mehr als 7 cover über der entsprechenden
 * schwelle haben").
 *
 * **Build time and tests only.** It reads signatures from the cover index,
 * and `lib/coverindex.ts` pulls the whole index in with it. The browser gets
 * `data/hero-rings.json`, written by `scripts/build-hero-rings.ts`, and never
 * imports this module.
 *
 * Every pair on a ring must pass all three rules:
 * - **structure:** more bits apart than the loosest hash threshold the site
 *   uses anywhere (Julian, 2026-09-11), today 20, two covers sharing an ISBN;
 * - **colour:** more than four times the "looks like this" gate apart, and
 *   known — a cover without colour data cannot show that it differs;
 * - **not blank:** no cover that looks like a scanned page.
 *
 * Before picking, the work's lowest quarter in saturation and in contrast
 * drops out, so a ring is not seven grey scans that merely differ. Then
 * greedy farthest-point from the most colourful cover, the way the fan's four
 * were chosen on 2026-09-10. A work the greedy walk cannot fill gets no ring.
 */
import { colourDistance, hamming, HASH_BITS, looksLikeScannedPage, type ImageSignature } from './imagesig';
import { COLOUR_MAX, SAME_DESIGN_BITS, STRUCTURE_MAX } from './coverindex';
import { SAME_COVER_MAX_DISTANCE, SAME_ISBN_MAX_DISTANCE, SAME_PRINTING_MAX_DISTANCE } from './works';

export const RING_SIZE = 7;

/** The loosest hash threshold on the site: the folding tiers and the similarity gate. */
export const RING_MIN_BITS = Math.max(
  SAME_DESIGN_BITS,
  SAME_COVER_MAX_DISTANCE,
  SAME_PRINTING_MAX_DISTANCE,
  SAME_ISBN_MAX_DISTANCE,
  Math.ceil(STRUCTURE_MAX * HASH_BITS),
);

export const RING_MIN_COLOUR = COLOUR_MAX * 4;

export interface RingCandidate {
  id: string;
  sig: ImageSignature;
}

export interface HeroRing {
  workId: string;
  title: string;
  author: string;
  /** Seven cover ids in the index's `ol:<id>` form, in order round the ring. */
  coverIds: string[];
}

/** May these two covers stand on the same ring? */
export function ringPairOk(a: ImageSignature, b: ImageSignature): boolean {
  const colour = colourDistance(a, b);
  return hamming(a.hash, b.hash) > RING_MIN_BITS && colour !== null && colour > RING_MIN_COLOUR;
}

/** How far apart two covers look, for the greedy walk: the nearer of the two measures wins. */
function spread(a: ImageSignature, b: ImageSignature): number {
  return Math.min((colourDistance(a, b) ?? 0) / 0.5, hamming(a.hash, b.hash) / 32);
}

function lowerQuarter(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 4)] ?? 0;
}

/** Seven cover ids for one work's covers, or null if the rules leave fewer. */
export function pickRing(covers: readonly RingCandidate[]): string[] | null {
  const saturationFloor = lowerQuarter(covers.map(c => c.sig.saturation ?? 0));
  const contrastFloor = lowerQuarter(covers.map(c => c.sig.contrast));
  const pool = covers.filter(
    c => !looksLikeScannedPage(c.sig) && (c.sig.saturation ?? 0) >= saturationFloor && c.sig.contrast >= contrastFloor,
  );
  if (pool.length < RING_SIZE) return null;

  const vivid = (c: RingCandidate) => (c.sig.saturation ?? 0) * c.sig.contrast;
  const ring: RingCandidate[] = [pool.reduce((best, c) => (vivid(c) > vivid(best) ? c : best))];
  while (ring.length < RING_SIZE) {
    let next: RingCandidate | undefined;
    let nextSpread = -1;
    for (const c of pool) {
      if (ring.includes(c) || !ring.every(r => ringPairOk(c.sig, r.sig))) continue;
      const d = Math.min(...ring.map(r => spread(c.sig, r.sig)));
      if (d > nextSpread) {
        nextSpread = d;
        next = c;
      }
    }
    if (!next) return null;
    ring.push(next);
  }
  return ring.map(c => c.id);
}

/** The cover index as committed: rows, not objects (see scripts/build-cover-index.ts). */
export interface CoverIndexFile {
  works: [id: string, title: string, author: string][];
  covers: [work: number, cover: string, hash: string, contrast: number, mean: number, saturation: number, hues: string][];
}

/** A ring for every listed work the index can fill, in the order of the list. */
export function ringsFor(
  index: CoverIndexFile,
  works: readonly { id: string; title: string; author: string }[],
): HeroRing[] {
  const byWork = new Map<number, RingCandidate[]>();
  for (const [work, id, hash, contrast, mean, saturation, hues] of index.covers) {
    const list = byWork.get(work) ?? [];
    list.push({ id, sig: { hash, contrast, mean, saturation, hues } });
    byWork.set(work, list);
  }
  const position = new Map(index.works.map(([id], i) => [id, i]));
  const rings: HeroRing[] = [];
  for (const w of works) {
    const at = position.get(w.id);
    if (at === undefined) continue;
    const coverIds = pickRing(byWork.get(at) ?? []);
    if (coverIds) rings.push({ workId: w.id, title: w.title, author: w.author, coverIds });
  }
  return rings;
}

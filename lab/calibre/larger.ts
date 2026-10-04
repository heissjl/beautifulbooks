/**
 * The largest scan of the design a collection chose (lab/calibre, ROADMAP 5.16).
 *
 * A collection names one cover id per work, and the site's fold keeps the
 * scan of a design it met first, not the largest (measured 2026-10-03 with
 * `measure-fold.ts`: for *Rendezvous with Rama* a scan of 287 × 500 stood in
 * front of one of 2002 × 3401). Whoever chooses on the site therefore gets
 * the id of the small one. This looks through the covers of the work for
 * scans of the same design — dHash distance ≤ 8, the fold's unconditional
 * tier, the one at which the site itself calls two images the same cover —
 * and names the largest. Looser tiers are left alone: they need the colour
 * and publisher evidence the fold has, and a wrong design in Calibre is worse
 * than a small one.
 *
 * One click, one work: the covers come through the catalogue (the website,
 * kept on this Mac), the images by cover id from the image host. What cannot
 * be compared is counted, never passed off as "no larger scan" (SPEC N12).
 */
import type { Catalogue } from './catalogue';
import type { CoverSize } from './download';
import { hamming } from './site';

/** SAME_COVER_MAX_DISTANCE in lib/works.ts. */
export const SAME_DESIGN = 8;
/** A scan must have a tenth more pixels to be worth replacing the one Julian chose. */
export const CLEARLY_LARGER = 1.1;
/** Edition pages looked through: 300 records, as the app loads without asking. */
export const LARGER_PAGES = 3;

/** A look that could not be made, in words for the row. */
export class LargerError extends Error {}

export interface Scan {
  coverId: string;
  size: CoverSize;
}

export interface LargerScan {
  /** The scan to use: the collection's own unless a clearly larger one of the same design exists. */
  use: Scan;
  own: Scan;
  larger: boolean;
  /** Other scans of the same design among the covers looked at. */
  same: number;
  /** Covers of the work looked at, the collection's own included. */
  covers: number;
  /** Edition records looked through, of how many the catalogue has. */
  seen: number;
  editions: number;
  /** Covers whose image could not be fetched for comparing or measuring. */
  notCompared: number;
  /** Set when the catalogue did not answer for every page. */
  incomplete?: string;
}

const area = (size: CoverSize): number => size.width * size.height;

/** The ids among `covers` that show the design of `hash`. A cover without a hash is not one of them — and not ruled out either: the caller counts it. */
export function sameDesign(hash: string, covers: readonly { coverId: string; hash: string | null }[]): string[] {
  return covers.filter((c) => c.hash !== null && hamming(c.hash, hash) <= SAME_DESIGN).map((c) => c.coverId);
}

/** The largest of the others when it is clearly larger than the own scan; otherwise the own. */
export function largestOf(own: Scan, others: readonly Scan[]): Scan {
  const best = others.reduce<Scan | null>((b, s) => (!b || area(s.size) > area(b.size) ? s : b), null);
  return best && area(best.size) > area(own.size) * CLEARLY_LARGER ? best : own;
}

export interface LargerDeps {
  catalogue: Catalogue;
  hashes: { get(coverId: string): Promise<string | null> };
  sizes: { get(coverId: string): Promise<CoverSize | null> };
  pages?: number;
}

export async function largerScan(pick: { workId: string; coverId: string }, deps: LargerDeps): Promise<LargerScan> {
  if (!pick.coverId.startsWith('ol:')) throw new LargerError('Only Open Library scans can be compared; this cover comes from Google Books.');
  if (!/^OL\d+W$/.test(pick.workId)) throw new LargerError('This tile names no work in the catalogue.');
  const [hash, size] = await Promise.all([deps.hashes.get(pick.coverId), deps.sizes.get(pick.coverId)]);
  if (!hash || !size) throw new LargerError('The collection’s own scan could not be fetched for comparing. Try again.');
  const own: Scan = { coverId: pick.coverId, size };

  const ids = new Set<string>();
  let seen = 0;
  let editions = 0;
  let incomplete: string | undefined;
  for (let offset: number | null = 0, n = 0; offset !== null && n < (deps.pages ?? LARGER_PAGES); n++) {
    let page;
    try {
      page = await deps.catalogue.page(pick.workId, offset);
    } catch (err) {
      // Without the first page there is nothing to say; without a later one, something — and that it is not everything.
      if (offset === 0) throw err;
      incomplete = 'The catalogue did not answer for every page of editions.';
      break;
    }
    if (!page) {
      if (offset === 0) throw new LargerError('The catalogue does not know this work.');
      break;
    }
    for (const c of page.covers) if (c.coverId.startsWith('ol:') && c.coverId !== pick.coverId) ids.add(c.coverId);
    editions = page.editions;
    seen = Math.min(offset + 100, editions);
    offset = page.next;
  }

  const hashed = await Promise.all([...ids].map(async (coverId) => ({ coverId, hash: await deps.hashes.get(coverId) })));
  const same = sameDesign(hash, hashed);
  const measured = await Promise.all(same.map(async (coverId) => ({ coverId, size: await deps.sizes.get(coverId) })));
  const others = measured.filter((m): m is Scan => m.size !== null);
  const use = largestOf(own, others);
  return {
    use,
    own,
    larger: use.coverId !== own.coverId,
    same: same.length,
    covers: ids.size + 1,
    seen,
    editions,
    notCompared: hashed.filter((h) => h.hash === null).length + (measured.length - others.length),
    ...(incomplete ? { incomplete } : {}),
  };
}

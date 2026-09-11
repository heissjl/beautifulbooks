/**
 * Which covers play (ROADMAP 5.8, Spielart 4). Pure; the caller reads the index.
 *
 * Two kinds of pool:
 *
 *   - **mix** — one cover from each of `size` books: "the ugliest cover", in
 *     the sense Julian asked for, across books. The title stays hidden while
 *     voting, so it is the cover that is judged and not the book.
 *   - **work** — every distinct design of one book: "Gatsby's ugliest cover".
 *     The question only this site can ask, because only it has them side by side.
 *
 * Two things a pool must not hold:
 *
 *   - **The same design twice.** Rescans of one jacket split the votes between
 *     them and look like a glitch to the player. Folded within a work at dHash
 *     distance ≤ 8, the tier the site folds at without any further evidence.
 *   - **A blank scan as a book's only face in a mix**, when the book has
 *     anything else. A blurb page would win "ugliest" without being a cover.
 *     It is not deleted — the site never deletes a cover for looking blank,
 *     because the same numbers describe a plain white first edition — only
 *     passed over when one cover is chosen for the book. In a work pool it
 *     stays, and the player's "not a cover" button decides.
 */
import { hamming, looksLikeScannedPage } from '../../lib/imagesig';
import { rng } from '../../lib/loading';
import { seedNumber, shuffled } from './rating';

/**
 * Mirrors `SAME_DESIGN_BITS` in lib/coverindex.ts, which cannot be imported
 * from here without loading the whole index through the `@/` alias.
 */
export const SAME_DESIGN = 8;

export interface RawIndex {
  builtAt: string;
  works: Array<[id: string, title: string, author: string]>;
  covers: Array<[work: number, cover: string, hash: string, contrast: number, mean: number, saturation: number, hues: string]>;
}

export interface PoolCover {
  id: string;
  workId: string;
  title: string;
  author: string;
}

export type PoolOptions =
  | { mode: 'mix'; size: number; seed: string }
  | { mode: 'work'; workId: string };

/** The pool's name, which is also its votes file: `mix-100-paperwhite`, `work-ol468431w`. */
export function poolName(options: PoolOptions): string {
  const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return options.mode === 'work' ? `work-${safe(options.workId)}` : `mix-${options.size}-${safe(options.seed)}`;
}

export function buildPool(index: RawIndex, options: PoolOptions): PoolCover[] {
  const designs = new Map<number, Array<{ cover: PoolCover; blank: boolean; hash: string }>>();
  for (const [work, id, hash, contrast, mean] of index.covers) {
    // Open Library only: its CDN is what the browser loads the images from.
    if (!id.startsWith('ol:')) continue;
    const meta = index.works[work];
    if (!meta) continue;
    const [workId, title, author] = meta;
    if (options.mode === 'work' && workId !== options.workId) continue;
    const list = designs.get(work) ?? [];
    if (list.some(d => hamming(d.hash, hash) <= SAME_DESIGN)) continue;
    list.push({
      cover: { id, workId, title, author },
      hash,
      blank: looksLikeScannedPage({ hash, contrast, mean }),
    });
    designs.set(work, list);
  }

  if (options.mode === 'work') return [...designs.values()].flat().map(d => d.cover);

  const random = rng(seedNumber(options.seed));
  const works = shuffled([...designs.keys()].sort((x, y) => x - y), random).slice(0, options.size);
  return works.map(work => {
    const list = designs.get(work) ?? [];
    const faces = list.filter(d => !d.blank);
    const from = faces.length > 0 ? faces : list;
    return from[Math.floor(random() * from.length)].cover;
  });
}

/**
 * Which covers play (ROADMAP 5.8, Spielart 4; 5.8a). Pure; the caller reads the index.
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
 *
 * Since 2026-09-11 a mix is stricter than that (Julian, after the first votes
 * on the preview: "nur diejenigen, die so groß angezeigt werden können ohne
 * unscharf zu werden", and more distance to near-white title-only covers):
 *
 *   - **Sharp enough to be shown large** (`sharpEnough`). The game shows a
 *     cover in a box up to 360 × 540 CSS px. Open Library's L image is at most
 *     500 px high; of the hundred covers in the first pool 15 were under 450 px,
 *     most of them 95–330 px, and those are the blurred ones. A spread or a
 *     wraparound (two of the hundred, 1.30 and 1.78 wide to high) shows as a
 *     strip in a portrait box. Pixel sizes are not in the index; the pool
 *     script measures them and passes them in, and a cover without a measured
 *     size is not chosen.
 *   - **Not a title on plain paper** (`looksPlain`). Thresholds set by looking
 *     at contact sheets of the index (docs/history.md, 5.8a). This is a game's
 *     choice of what to put up for a vote, not a verdict on the cover: the site
 *     still shows every one of them, and a work pool keeps them.
 *
 * `exclude` names covers a person has already judged not to be covers — the
 * *Slaughterhouse-Five* reading guide that says "This is not the actual book
 * cover" was the first. An excluded cover is never chosen, but it still folds
 * away its own rescans, and a book that loses its cover to it gets another.
 */
import { hamming, looksLikeScannedPage } from '../imagesig';
import { rng } from '../loading';
import { seedNumber, shuffled } from './rating';

/**
 * Mirrors `SAME_DESIGN_BITS` in lib/coverindex.ts, which cannot be imported
 * from here without loading the whole index along with it.
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

/** Pixel size of a cover's L image: [width, height]. */
export type CoverSize = readonly [width: number, height: number];

export type MixOptions = {
  mode: 'mix';
  size: number;
  seed: string;
  exclude?: readonly string[];
  /** Measured L sizes. Given, only covers that are `sharpEnough` are chosen. */
  sizes?: Readonly<Record<string, CoverSize>>;
  /**
   * Covers of an earlier pool under the same name, taken first wherever they
   * still may play: a pool that grows keeps every cover its votes name, and
   * only the books it adds are drawn fresh.
   */
  keep?: readonly string[];
};

export type PoolOptions =
  | MixOptions
  | { mode: 'work'; workId: string; exclude?: readonly string[] };

/** The pool's name, which is also its votes file: `mix-100-paperwhite`, `work-ol468431w`. */
export function poolName(options: PoolOptions): string {
  const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return options.mode === 'work' ? `work-${safe(options.workId)}` : `mix-${options.size}-${safe(options.seed)}`;
}

/** Below this an L image is blown up visibly in the game's 540 px box. */
export const MIN_HEIGHT = 450;

/** Width over height. The hundred first covers ran 0.54–0.81; the two spreads 1.30 and 1.78. */
export const MIN_ASPECT = 0.5;
export const MAX_ASPECT = 0.85;

export function sharpEnough(size: CoverSize | undefined): boolean {
  if (!size) return false;
  const [width, height] = size;
  if (height < MIN_HEIGHT) return false;
  const aspect = width / height;
  return aspect >= MIN_ASPECT && aspect <= MAX_ASPECT;
}

/**
 * Four regions of the index where, on the contact sheets, nearly every cover
 * was a title page or a title on plain paper. Mean luminance, contrast and
 * saturation all on 0–255.
 *
 *   - mean ≥ 245: title pages and "Planet PDF" placeholders, whatever the contrast.
 *   - mean ≥ 235 and saturation ≤ 10: black-and-white scans of title pages.
 *     The bright covers that are designed — the many *Little Princes* — had 12–18.
 *   - mean ≥ 200 and contrast ≤ 15: a title set on paper or card. Not below 200:
 *     there the low-contrast covers are the yellow Reclam booklets and an orange
 *     *Moby Dick*, title-only but coloured, which is not what was asked for.
 *   - mean ≥ 215 and contrast ≤ 20: sixteen of twenty on the sheet were title
 *     pages, Webster's thesaurus editions or a title on white; the other four
 *     were two *Little Princes*, Liebermann's *Effi Briest* and an insel
 *     *Werther*. Between 200 and 215 the same contrast holds Reclam again.
 *
 * Tried and not taken: saturation ≤ 10 from 215 up. It catches text pages and
 * "No image available", but as many designed covers — Kundera's line drawing,
 * a *Brave New World*, an Esperanto *Little Prince*. The placeholders are
 * small and fail `sharpEnough` anyway.
 */
export const PLAIN_MEAN = 245;
export const PLAIN_SCAN_MEAN = 235;
export const PLAIN_SCAN_SATURATION = 10;
export const PLAIN_PAPER_MEAN = 200;
export const PLAIN_PAPER_CONTRAST = 15;
export const PLAIN_WHITE_MEAN = 215;
export const PLAIN_WHITE_CONTRAST = 20;

export function looksPlain({ mean, contrast, saturation }: { mean: number; contrast: number; saturation: number }): boolean {
  return mean >= PLAIN_MEAN
    || (mean >= PLAIN_SCAN_MEAN && saturation <= PLAIN_SCAN_SATURATION)
    || (mean >= PLAIN_PAPER_MEAN && contrast <= PLAIN_PAPER_CONTRAST)
    || (mean >= PLAIN_WHITE_MEAN && contrast <= PLAIN_WHITE_CONTRAST);
}

interface Design {
  cover: PoolCover;
  hash: string;
  blank: boolean;
  plain: boolean;
  excluded: boolean;
}

function designsOf(index: RawIndex, options: PoolOptions): Map<number, Design[]> {
  const excluded = new Set(options.exclude ?? []);
  const designs = new Map<number, Design[]>();
  for (const [work, id, hash, contrast, mean, saturation] of index.covers) {
    // Open Library only: its CDN is what the images come from.
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
      plain: looksPlain({ mean, contrast, saturation }),
      excluded: excluded.has(id),
    });
    designs.set(work, list);
  }
  return designs;
}

/**
 * The order a mix tries books in and, within each book, its covers — only
 * those that may play. Deterministic in the seed, so the pool script can
 * measure exactly the covers `buildPool` will look at, in the same order.
 *
 * A book's covers are shuffled by the seed and its own work id, not by one
 * stream shared with every other book: a book added to the index then leaves
 * the order of all the others alone, and their measured sizes stay the ones
 * the pool needs.
 */
export function mixCandidates(index: RawIndex, options: MixOptions): PoolCover[][] {
  const designs = designsOf(index, options);
  const playable = (work: number) => (designs.get(work) ?? []).filter(d => !d.excluded && !d.blank && !d.plain);
  const works = [...designs.keys()].sort((x, y) => x - y).filter(work => playable(work).length > 0);
  return shuffled(works, rng(seedNumber(options.seed))).map(work => {
    const own = rng(seedNumber(`${options.seed}|${index.works[work][0]}`));
    return shuffled(playable(work), own).map(d => d.cover);
  });
}

export function buildPool(index: RawIndex, options: PoolOptions): PoolCover[] {
  if (options.mode === 'work') {
    return [...designsOf(index, options).values()].flat().filter(d => !d.excluded).map(d => d.cover);
  }
  const { sizes, keep = [] } = options;
  const allowed = (cover: PoolCover) => !sizes || sharpEnough(sizes[cover.id]);
  const books = mixCandidates(index, options);
  const pool: PoolCover[] = [];
  const taken = new Set<string>();
  const take = (cover: PoolCover) => {
    pool.push(cover);
    taken.add(cover.workId);
  };

  const playable = new Map(books.flat().map(c => [c.id, c]));
  for (const id of keep) {
    const cover = playable.get(id);
    if (cover && pool.length < options.size && !taken.has(cover.workId) && allowed(cover)) take(cover);
  }
  for (const covers of books) {
    if (pool.length >= options.size) break;
    if (covers.length === 0 || taken.has(covers[0].workId)) continue;
    // A book with nothing sharp enough makes room for the next one.
    const pick = covers.find(allowed);
    if (pick) take(pick);
  }
  return pool;
}

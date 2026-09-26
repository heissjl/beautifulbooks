/**
 * Which covers play (ROADMAP 5.8, Spielart 4; 5.8a). Pure; the caller reads the index.
 *
 * Two kinds of pool:
 *
 *   - **mix** — covers from many books: "the ugliest cover", in the sense
 *     Julian asked for, across books. One per book, or up to `perBook` taken
 *     round robin when a pool wants more covers than the index has books (the
 *     1000-cover pool of 2026-09-11 had 239 books to draw from, the
 *     2000-cover pool of 2026-09-26 has 500).
 *   - **work** — every distinct design of one book: "Gatsby's ugliest cover".
 *     The question only this site can ask, because only it has them side by side.
 *
 * Two things a pool must not hold:
 *
 *   - **The same design twice.** Rescans of one jacket split the votes between
 *     them and look like a glitch to the player. Folded within a work at dHash
 *     distance ≤ 8, the tier the site folds at without any further evidence.
 *   - **A blank scan as a book's face in a mix.** It is not deleted — the site
 *     never deletes a cover for looking blank, because the same numbers
 *     describe a plain white first edition — only left out of the game. In a
 *     work pool it stays, and the player's "not a cover" button decides.
 *
 * Since 2026-09-11 a mix is stricter than that (Julian, after the first votes
 * on the preview, and again after playing the 200-book pool):
 *
 *   - **Sharp enough to be shown large** (`sharpEnough`). The game shows a
 *     cover in a box up to 360 × 540 CSS px. Open Library's L image is at most
 *     500 px high; of the hundred covers in the first pool 15 were under 450 px,
 *     most of them 95–330 px, and those are the blurred ones. A spread or a
 *     wraparound (two of the hundred, 1.30 and 1.78 wide to high) shows as a
 *     strip in a portrait box.
 *   - **Not mostly white, not a classic Reclam** (`fitsGame`), measured on the
 *     L image (`lib/hotornot/quality.ts`).
 *   - **Not a title on plain paper** (`looksPlain`), from the index alone.
 *   - **Crisp, if it is new** (`crispEnough`, since 2026-09-26): a cover a
 *     pool adds must not be a soft or blown-up scan. A cover it keeps is not
 *     asked, because votes name it.
 *
 * Thresholds set by looking at contact sheets (docs/history.md, 5.8a). This is
 * a game's choice of what to put up for a vote, not a verdict on the cover:
 * the site still shows every one of them, and a work pool keeps them. The pool
 * script measures, and a cover without a measure is not chosen.
 *
 * `exclude` names covers a person has already judged not to be covers — the
 * *Slaughterhouse-Five* reading guide that says "This is not the actual book
 * cover" was the first. An excluded cover is never chosen, but it still folds
 * away its own rescans, and a book that loses its cover to it gets another.
 */
import { colourDistance, hamming, looksLikeScannedPage } from '../imagesig';
import { rng } from '../loading';
import type { CoverMeasure } from './quality';
import { seedNumber, shuffled } from './rating';

export type { CoverMeasure };

/**
 * Mirrors `SAME_DESIGN_BITS` in lib/coverindex.ts, which cannot be imported
 * from here without loading the whole index along with it.
 */
export const SAME_DESIGN = 8;

/**
 * One jacket scanned twice, which the game must never put up against itself
 * (Julian, 2026-09-12, asking for pairs from one book: "wichtig vorher nochmal
 * zu checken, dass es wirklich nicht zwei verschiedene scans vom gleichen
 * cover sind").
 *
 * Measured over the same-book pairs of the 1000-cover pool and looked at on
 * contact sheets: **structure alone does not tell them apart.** At 13 bits sit
 * both a *Portnoy's Complaint* scanned twice (colour 0.01) and a red *Catcher
 * in the Rye* against a white Japanese one (0.81); at 19 bits both a Proust
 * bound twice the same way (0.13) and *Underworld* against another
 * *Underworld* (0.63).
 *
 * So the colour budget shrinks as the structure drifts: **0.45 at 10 bits
 * falling to 0.20 at 20**, and past 20 bits nothing counts as one jacket any
 * more. Every pair the sheets showed as one jacket falls inside that wedge —
 * a recoloured *Slaughterhouse-Five* (10 bits, 0.36), *Der Vorleser* twice
 * (11, 0.29), *The Garden of Eden* twice (16, 0.24), *Charlotte's Web* (18,
 * 0.21), the Proust (19, 0.13) — and every pair that was two designs falls
 * outside it.
 *
 * It folds a few genuinely different covers that are simply both dark — two
 * *Dune*s, a Spanish *Gone Girl* against the English one — and that is the
 * cheaper mistake: each book brings four or five designs anyway, and a pair
 * showing one cover twice would look broken. The site's cover wall keeps its
 * own tiers (E8); this is the game's rule.
 */
export const SAME_JACKET_BITS = 20;
export const JACKET_COLOUR_NEAR = 0.45;
export const JACKET_COLOUR_FAR = 0.2;

/** How unlike in colour two covers may be and still be one jacket, at `bits` of structure apart. */
export function jacketColourLimit(bits: number): number {
  const drift = Math.min(1, Math.max(0, (bits - 10) / (SAME_JACKET_BITS - 10)));
  return JACKET_COLOUR_NEAR + (JACKET_COLOUR_FAR - JACKET_COLOUR_NEAR) * drift;
}

export interface DesignSignature {
  hash: string;
  saturation?: number;
  hues?: string;
}

export function sameJacket(a: DesignSignature, b: DesignSignature): boolean {
  const bits = hamming(a.hash, b.hash);
  if (bits <= SAME_DESIGN) return true;
  if (bits > SAME_JACKET_BITS) return false;
  const colour = colourDistance({ ...a, contrast: 0 }, { ...b, contrast: 0 });
  return colour !== null && colour <= jacketColourLimit(bits);
}

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

export type MixOptions = {
  mode: 'mix';
  size: number;
  seed: string;
  exclude?: readonly string[];
  /** Measured L images. Given, only covers that `fitsGame` are chosen. */
  measures?: Readonly<Record<string, CoverMeasure>>;
  /**
   * Covers of an earlier pool, taken first wherever they still may play: a
   * pool that grows keeps every cover its votes name, and only what it adds is
   * drawn fresh.
   */
  keep?: readonly string[];
  /** Most covers one book may bring. Every book brings its first before any brings its second. */
  perBook?: number;
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

export function sharpEnough(measure: Pick<CoverMeasure, 'width' | 'height'> | undefined): boolean {
  if (!measure) return false;
  const { width, height } = measure;
  if (height < MIN_HEIGHT) return false;
  const aspect = width / height;
  return aspect >= MIN_ASPECT && aspect <= MAX_ASPECT;
}

/**
 * Paper over three quarters of the cover. On the sheet of the 70 whitest of
 * 949 candidates, above 0.75 lay title pages, pages of text, "No image
 * available" and the Webster's thesaurus editions — and some minimalist
 * designs, *The Book Thief*, Céline's scissors, a Mistry, which go too:
 * Julian asked for fewer white covers, twice.
 */
export const MAX_WHITE = 0.75;

/**
 * The classic Reclam booklet: yellow over half the cover and almost no
 * contrast (the index's 7–19). Yellow alone is not enough — *Pippi*, *Normal
 * People* and *Portnoy's Complaint* are yellow and designed, with contrast 25
 * and more.
 */
export const RECLAM_YELLOW = 0.5;
export const RECLAM_CONTRAST = 20;

/**
 * The softest scan a pool may **add** (`blur` in lib/hotornot/quality.ts),
 * set by looking (2026-09-26, the 2000-cover pool). The height rule cannot
 * see an L image of 475 px that was blown up from a thumbnail. Of the 1000
 * covers the pool added, before this rule, 15 lay above 0.40, and at full
 * size twelve of them were soft or blocky scans (*The Prophet*, *Jaws*,
 * *Brighton Rock*, *Père Goriot*, *The Canterbury Tales*, a *Villette*) and
 * three were sharp prints of a soft photograph (Camus's ink in water, the
 * Oxford *Babbitt*, Amis's clouds), which go too. Between 0.36 and 0.40 the
 * sheet showed mostly designs — the grey *Coraline*, the *Legend of Sleepy
 * Hollow* in branches — and one soft *Strangers on a Train*, so the line is
 * at 0.40. On a third of the 1000-cover pool, 4 of 334 lay above it, all
 * four soft; they stay, because their votes name them.
 */
export const MAX_BLUR = 0.4;

/**
 * Crisp enough to be one of the covers a pool adds. A cover a pool keeps from
 * the one it grew from is not asked: its votes name it, and its measure was
 * taken before this rule. A measure without `blur` predates the rule too and
 * passes; the pool script measures every cover it may add again.
 */
export function crispEnough(measure: Pick<CoverMeasure, 'blur'> | undefined): boolean {
  return !!measure && (measure.blur === undefined || measure.blur <= MAX_BLUR);
}

export function fitsGame(measure: CoverMeasure | undefined, contrast: number): boolean {
  if (!measure || !sharpEnough(measure)) return false;
  if (measure.white >= MAX_WHITE) return false;
  if (measure.yellow >= RECLAM_YELLOW && contrast <= RECLAM_CONTRAST) return false;
  return true;
}

/**
 * Five regions of the index where, on the contact sheets, nearly every cover
 * was a title page or a title on plain paper. Mean luminance, contrast and
 * saturation all on 0–255.
 *
 *   - mean ≥ 245: title pages and "Planet PDF" placeholders, whatever the contrast.
 *   - mean ≥ 235 and saturation ≤ 10: black-and-white scans of title pages.
 *     The bright covers that are designed — the many *Little Princes* — had 12–18.
 *   - mean ≥ 200 and contrast ≤ 15: a title set on paper or card.
 *   - mean ≥ 215 and contrast ≤ 20: sixteen of twenty on the sheet were title
 *     pages, Webster's thesaurus editions or a title on white; the other four
 *     were two *Little Princes*, Liebermann's *Effi Briest* and an insel
 *     *Werther*. Between 200 and 215 the same contrast holds Reclam again.
 *   - mean ≥ 150, contrast ≤ 15 and saturation ≤ 120: scanned pages on aged
 *     paper and plain grey boards, 26 of 30 on the sheet. The saturation limit
 *     spares the yellow Reclam booklets (they go by `fitsGame`) and orange
 *     Penguins (190–230); at 90 it let yellowed title pages through (93–119).
 *     It costs a Suhrkamp *Siddhartha*, an Alianza *Bovary* and an NRF *L'étranger*.
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
export const PLAIN_AGED_MEAN = 150;
export const PLAIN_AGED_CONTRAST = 15;
export const PLAIN_AGED_SATURATION = 120;

export function looksPlain({ mean, contrast, saturation }: { mean: number; contrast: number; saturation: number }): boolean {
  return mean >= PLAIN_MEAN
    || (mean >= PLAIN_SCAN_MEAN && saturation <= PLAIN_SCAN_SATURATION)
    || (mean >= PLAIN_PAPER_MEAN && contrast <= PLAIN_PAPER_CONTRAST)
    || (mean >= PLAIN_WHITE_MEAN && contrast <= PLAIN_WHITE_CONTRAST)
    || (mean >= PLAIN_AGED_MEAN && contrast <= PLAIN_AGED_CONTRAST && saturation <= PLAIN_AGED_SATURATION);
}

interface Design {
  cover: PoolCover;
  signature: DesignSignature;
  blank: boolean;
  plain: boolean;
  excluded: boolean;
}

function designsOf(index: RawIndex, options: PoolOptions): Map<number, Design[]> {
  const excluded = new Set(options.exclude ?? []);
  const designs = new Map<number, Design[]>();
  for (const [work, id, hash, contrast, mean, saturation, hues] of index.covers) {
    // Open Library only: its CDN is what the images come from.
    if (!id.startsWith('ol:')) continue;
    const meta = index.works[work];
    if (!meta) continue;
    const [workId, title, author] = meta;
    if (options.mode === 'work' && workId !== options.workId) continue;
    const list = designs.get(work) ?? [];
    const signature: DesignSignature = { hash, saturation, hues };
    if (list.some(d => sameJacket(d.signature, signature))) continue;
    list.push({
      cover: { id, workId, title, author },
      signature,
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
 * those the index lets play. Deterministic in the seed, so the pool script can
 * measure exactly the covers `buildPool` will look at, in the same order.
 *
 * A book's covers are shuffled by the seed and its own work id, not by one
 * stream shared with every other book: a book added to the index then leaves
 * the order of all the others alone, and their measures stay the ones the
 * pool needs.
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
  const { measures, keep = [], perBook = 1 } = options;
  const contrastOf = new Map(index.covers.map(row => [row[1], row[3]]));
  const allowed = (cover: PoolCover) => !measures || fitsGame(measures[cover.id], contrastOf.get(cover.id) ?? 0);
  const books = mixCandidates(index, options);
  const pool: PoolCover[] = [];
  const taken = new Set<string>();
  const fromBook = new Map<string, number>();
  const count = (cover: PoolCover) => fromBook.get(cover.workId) ?? 0;
  const take = (cover: PoolCover) => {
    pool.push(cover);
    taken.add(cover.id);
    fromBook.set(cover.workId, count(cover) + 1);
  };

  const playable = new Map(books.flat().map(c => [c.id, c]));
  for (const id of keep) {
    const cover = playable.get(id);
    if (cover && pool.length < options.size && !taken.has(id) && count(cover) < perBook && allowed(cover)) take(cover);
  }
  // Round robin: every book its first cover before any book its second. A book
  // with nothing that fits makes room for the next one. What is added must
  // also be crisp; what was kept was not asked.
  const added = (cover: PoolCover) => !measures || crispEnough(measures[cover.id]);
  const queues = books.map(covers => covers.filter(c => allowed(c) && added(c)));
  for (let round = 0; round < perBook && pool.length < options.size; round++) {
    for (const queue of queues) {
      if (pool.length >= options.size) break;
      const next = queue.find(c => !taken.has(c.id));
      if (next && count(next) <= round) take(next);
    }
  }
  return pool;
}

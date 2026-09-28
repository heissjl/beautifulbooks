/**
 * The pure half of the clip experiment (lab/video/README.md, ROADMAP 5.5,
 * PLAN-struktur §4): from a work's editions, covers and signatures to a
 * storyboard — which covers, in which order, for how many frames, with which
 * transition and caption, and where the closing wall puts each tile.
 *
 * No I/O. `render.ts` loads the data and the images, measures the chosen
 * covers, calls `storyboard` again with the measures until the choice is
 * stable, and turns the result into frames.
 *
 * Which covers (two layers of rules):
 *   - **The wall's rules**, so the clip never disagrees with the site about
 *     what one design is: `foldDuplicateCovers`, `looksLikeScannedPage`.
 *   - **The clip's rules**, which are a choice of thirty and not a verdict on
 *     any cover (the site still shows every one): the game's `sameJacket`
 *     (lib/hotornot/pool.ts) folds the same artwork across printings — *Dune*'s
 *     Ace „Supreme Masterpiece" jacket from 1999, 2005 and 2010 — which the
 *     wall deliberately keeps apart; the game's `looksPlain` drops a title on
 *     plain paper or a bare binding; a spread (wider than 0.9 of its height)
 *     is left out; and an image under `minWidth` px is left out while enough
 *     others remain, because a 114 px scan blown up to 780 px looks broken.
 *
 * Rhythm (every change a dissolve in place, never under 0.15 s): title card, covers that start slow and accelerate (the first stays
 * `accel` times as long as the last), a wall of every cover shown filling in
 * tile by tile, and the end card.
 */
import { looksLikeScannedPage, type ImageSignature } from '../../lib/imagesig';
import { looksPlain, sameJacket } from '../../lib/hotornot/pool';
import type { Cover, Edition, Work } from '../../lib/model';
import { foldDuplicateCovers } from '../../lib/works';

export const CLIP_WIDTH = 1080;
export const CLIP_HEIGHT = 1920;
export const SITE_URL_DEFAULT = 'beautifulcovers.vercel.app';

export interface StoryboardOptions {
  /** Most covers to show. Default 30. */
  count?: number;
  /** Length of the whole clip, cards and wall included. Default 20. */
  seconds?: number;
  /** Frames per second. Default 30. */
  fps?: number;
  /** Title card length in seconds. Default 1.6; 0 leaves it out. */
  titleSeconds?: number;
  /** The closing wall of every cover shown. Default 2.6; 0 leaves it out. */
  gridSeconds?: number;
  /** End card length in seconds. Default 1.8; 0 leaves it out. */
  endSeconds?: number;
  /** How many times longer the first cover stays than the last. Default 3; 1 is an even beat. */
  accel?: number;
  /**
   * Shortest time one cover may stay on screen. Default 0.2 s. When `count`
   * covers would get less, fewer are shown.
   */
  minShotSeconds?: number;
  /** Measured images narrower than this are left out while enough others remain. Default 300. */
  minWidth?: number;
  /** Only covers whose edition is in this language (ISO 639-1). */
  language?: string;
  /**
   * Leave out covers without a signature. Default true: a cover without one
   * cannot fold, so it could be a second scan of a jacket already shown.
   */
  requireSignature?: boolean;
  siteName?: string;
  siteUrl?: string;
}

/** What render.ts measured on a cover's L image. */
export interface CoverMeasure {
  width: number;
  height: number;
  /** Mean luminance 0..255. */
  mean: number;
  contrast: number;
  /** Mean colourfulness 0..255. */
  saturation: number;
}

export interface TitleShot {
  kind: 'title';
  frames: number;
  kicker: string;
  title: string;
  author: string;
  span: string;
}

export interface CoverShot {
  kind: 'cover';
  frames: number;
  /** Frames at the start of the shot spent moving in; the previous shot moves out during them. */
  transition: number;
  /** 0-based position among the covers. */
  index: number;
  coverId: string;
  /** The L-size image, which is what a 1080-wide frame needs. */
  url: string;
  year?: number;
  publisher?: string;
  language?: string;
  /** „1965 · Chilton Books", or whichever of the two is known; may be empty. */
  caption: string;
}

export interface GridLayout {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  gap: number;
  left: number;
  top: number;
}

export interface GridShot {
  kind: 'grid';
  frames: number;
  coverIds: string[];
  layout: GridLayout;
  /** Frames between one tile starting to appear and the next. */
  stagger: number;
  /** Frames one tile takes to settle in. */
  tileFrames: number;
}

export interface EndShot {
  kind: 'end';
  frames: number;
  wordmark: string;
  tagline: string;
  url: string;
  credit: string;
}

export type Shot = TitleShot | CoverShot | GridShot | EndShot;

export interface Exclusions {
  /** Folded into another printing of the same artwork (`sameJacket`). */
  sameJacket: number;
  plain: number;
  wide: number;
  small: number;
}

export interface Storyboard {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  shots: Shot[];
  /** First and last year among the covers shown, for the timeline. */
  span?: { from: number; to: number };
  /** Designs eligible after every rule, before the cap. */
  designs: number;
  /** Covers handed in. */
  coversIn: number;
  excluded: Exclusions;
}

export interface StoryboardInput {
  work: Pick<Work, 'title' | 'authors'>;
  editions: readonly Edition[];
  covers: readonly Cover[];
  signatures: ReadonlyMap<string, ImageSignature>;
  measures?: ReadonlyMap<string, CoverMeasure>;
}

export interface Design {
  cover: Cover;
  year?: number;
  publisher?: string;
  language?: string;
}

/**
 * The edition a caption names: the earliest dated one that carries **this
 * image**, so the year and publisher under a cover are the ones printed on
 * it. Only when none of its own editions is dated do the folded scans lend
 * theirs. (The first version dated a design by its earliest scan anywhere,
 * and captioned a 1970s Berkley paperback „1965 · Chilton Books".)
 */
function representative(
  cover: Cover,
  coversById: ReadonlyMap<string, Cover>,
  editionsById: ReadonlyMap<string, Edition>,
): Edition | undefined {
  const earliest = (ids: Iterable<string>) => {
    const editions = [...ids].map(id => editionsById.get(id)).filter((e): e is Edition => !!e);
    const dated = editions.filter(e => e.year !== undefined).sort((a, b) => a.year! - b.year!);
    return { dated: dated[0], any: editions[0] };
  };
  // The folded cover carries its group's editions; the unfolded input says which are its own.
  const own = earliest(coversById.get(cover.id)?.editionIds ?? cover.editionIds);
  if (own.dated) return own.dated;
  const lent = earliest(cover.editionIds.concat((cover.similarIds ?? []).flatMap(id => coversById.get(id)?.editionIds ?? [])));
  return lent.dated ?? own.any ?? lent.any;
}

/**
 * `n` items spread evenly over a sorted list, first and last included, so a
 * cap of 30 on 120 designs still spans the book's whole history instead of
 * stopping in 1985.
 */
export function spread<T>(items: readonly T[], n: number): T[] {
  if (n <= 0) return [];
  if (items.length <= n) return [...items];
  if (n === 1) return [items[0]];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[Math.round((i * (items.length - 1)) / (n - 1))]);
  return out;
}

/** Splits `total` frames into `parts` whole numbers that differ by at most one. */
export function splitFrames(total: number, parts: number): number[] {
  return weightedFrames(total, Array.from({ length: parts }, () => 1), 0);
}

/**
 * Splits `total` frames in proportion to `weights`, each at least `min`, by
 * largest remainder, so the parts always sum to `total` exactly. A part that
 * would fall under `min` is lifted to it and the rest are shared out again in
 * proportion, so the minimum does not flatten the curve of the others. Earlier
 * parts win ties: the eye settles in at the start.
 */
export function weightedFrames(total: number, weights: readonly number[], min: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (total < min * n) throw new Error(`${total} frames cannot give ${n} parts ${min} each`);
  const floored = new Set<number>();
  let exact: number[] = [];
  for (;;) {
    const free = weights.map((w, i) => (floored.has(i) ? 0 : w));
    const sum = free.reduce((a, b) => a + b, 0);
    const budget = total - min * floored.size;
    exact = weights.map((_, i) => (floored.has(i) ? min : (budget * free[i]) / sum));
    const under = exact.findIndex((x, i) => !floored.has(i) && x < min);
    if (under < 0) break;
    exact.forEach((x, i) => { if (!floored.has(i) && x < min) floored.add(i); });
  }
  const out = exact.map(x => Math.floor(x));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ r: x - Math.floor(x), i })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

/** Weights from 1 down to 1/accel, falling geometrically: a steady acceleration. */
export function accelerating(n: number, accel: number): number[] {
  if (n <= 1) return Array.from({ length: n }, () => 1);
  return Array.from({ length: n }, (_, i) => Math.pow(accel, -i / (n - 1)));
}

export function captionOf(year: number | undefined, publisher: string | undefined): string {
  return [year !== undefined ? String(year) : '', publisher?.trim() ?? ''].filter(Boolean).join(' · ');
}

/**
 * Tiles for the closing wall: the column count that gives the largest 2:3
 * tiles fitting the area, centred in it. Between 3 (the phone wall) and 8.
 */
export function gridLayout(
  n: number,
  area: { width: number; top: number; bottom: number; margin?: number; gap?: number } = { width: CLIP_WIDTH, top: 430, bottom: 1640 },
): GridLayout {
  const margin = area.margin ?? 64;
  const gap = area.gap ?? 20;
  const height = area.bottom - area.top;
  let best: GridLayout | null = null;
  for (let cols = 3; cols <= 8; cols++) {
    const rows = Math.max(1, Math.ceil(n / cols));
    let tileWidth = (area.width - 2 * margin - (cols - 1) * gap) / cols;
    let tileHeight = tileWidth * 1.5;
    const fits = (height - (rows - 1) * gap) / rows;
    if (tileHeight > fits) { tileHeight = fits; tileWidth = fits / 1.5; }
    if (!best || tileWidth > best.tileWidth) {
      const w = cols * tileWidth + (cols - 1) * gap;
      const h = rows * tileHeight + (rows - 1) * gap;
      best = {
        cols, rows, gap,
        tileWidth: Math.floor(tileWidth), tileHeight: Math.floor(tileHeight),
        left: Math.round((area.width - w) / 2), top: Math.round(area.top + (height - h) / 2),
      };
    }
  }
  return best!;
}

interface Candidate extends Design {
  signature?: ImageSignature;
  measure?: CoverMeasure;
}

/** The designs of a work after every rule, in year order (undated last), with what was left out. */
export function designsOf(
  input: StoryboardInput,
  options: StoryboardOptions = {},
): { designs: Design[]; excluded: Exclusions } {
  const requireSignature = options.requireSignature ?? true;
  const minWidth = options.minWidth ?? 300;
  const cap = options.count ?? 30;
  const excluded: Exclusions = { sameJacket: 0, plain: 0, wide: 0, small: 0 };
  const usable = input.covers.filter(c => !requireSignature || input.signatures.has(c.id));
  const folded = foldDuplicateCovers(usable, input.signatures, input.editions);
  const coversById = new Map(input.covers.map(c => [c.id, c]));
  const editionsById = new Map(input.editions.map(e => [e.id, e]));

  const candidates: Candidate[] = [];
  for (const cover of folded) {
    const signature = input.signatures.get(cover.id);
    if (looksLikeScannedPage(signature)) continue;
    const edition = representative(cover, coversById, editionsById);
    if (options.language && edition?.language !== options.language) continue;
    const measure = input.measures?.get(cover.id);
    if (measure && looksPlain(measure)) { excluded.plain++; continue; }
    if (measure && measure.width > 0.9 * measure.height) { excluded.wide++; continue; }
    candidates.push({ cover, year: edition?.year, publisher: edition?.publisher, language: edition?.language, signature, measure });
  }
  // Stable: equal years keep the order the catalogue gave them.
  const ordered = candidates
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.year ?? Infinity) - (b.d.year ?? Infinity) || a.i - b.i)
    .map(({ d }) => d);

  // One printing per artwork. Clusters form in year order; each shows its
  // earliest printing whose image is large enough, else its earliest.
  const clusters: Candidate[][] = [];
  for (const d of ordered) {
    const home = d.signature
      ? clusters.find(c => c[0].signature && sameJacket(c[0].signature, d.signature!))
      : undefined;
    if (home) { home.push(d); excluded.sameJacket++; } else clusters.push([d]);
  }
  const heads = clusters.map(c => c.find(d => (d.measure?.width ?? Infinity) >= minWidth) ?? c[0]);
  const reordered = heads
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.year ?? Infinity) - (b.d.year ?? Infinity) || a.i - b.i)
    .map(({ d }) => d);

  const large = reordered.filter(d => (d.measure?.width ?? Infinity) >= minWidth);
  const kept = large.length >= cap ? large : reordered;
  excluded.small = reordered.length - kept.length;
  return {
    designs: kept.map(({ cover, year, publisher, language }) => ({ cover, year, publisher, language })),
    excluded,
  };
}

/** The designs `storyboard` would show, before timing — what render.ts measures. */
export function chooseDesigns(input: StoryboardInput, options: StoryboardOptions = {}): {
  chosen: Design[]; designs: number; excluded: Exclusions; coverFrames: number;
} {
  const fps = options.fps ?? 30;
  const totalFrames = Math.round((options.seconds ?? 20) * fps);
  const titleFrames = Math.round((options.titleSeconds ?? 1.6) * fps);
  const gridFrames = Math.round((options.gridSeconds ?? 2.6) * fps);
  const endFrames = Math.round((options.endSeconds ?? 1.8) * fps);
  // A shot holds its dissolve (≥ 0.15 s) and a moment of standing still.
  const minShot = Math.max(Math.round(0.15 * fps) + 1, Math.round((options.minShotSeconds ?? 0.2) * fps));
  const coverFrames = totalFrames - titleFrames - gridFrames - endFrames;
  if (coverFrames < minShot) {
    throw new Error(`no time left for covers: ${totalFrames} frames, ${totalFrames - coverFrames} for the cards and the wall`);
  }
  const { designs, excluded } = designsOf(input, options);
  const cap = Math.min(options.count ?? 30, Math.floor(coverFrames / minShot));
  // Dated designs are spread over the years first; undated ones only fill up.
  const dated = designs.filter(d => d.year !== undefined);
  const undated = designs.filter(d => d.year === undefined);
  const chosen = dated.length >= cap ? spread(dated, cap) : [...dated, ...undated.slice(0, cap - dated.length)];
  return { chosen, designs: designs.length, excluded, coverFrames };
}

export function storyboard(input: StoryboardInput, options: StoryboardOptions = {}): Storyboard {
  const fps = options.fps ?? 30;
  const titleFrames = Math.round((options.titleSeconds ?? 1.6) * fps);
  const gridFrames = Math.round((options.gridSeconds ?? 2.6) * fps);
  const endFrames = Math.round((options.endSeconds ?? 1.8) * fps);
  const minShot = Math.max(Math.round(0.15 * fps) + 1, Math.round((options.minShotSeconds ?? 0.2) * fps));
  const { chosen, designs, excluded, coverFrames } = chooseDesigns(input, options);
  if (chosen.length === 0) throw new Error('no covers to show');
  const minTransition = Math.max(1, Math.round(0.15 * fps));

  const years = chosen.map(d => d.year).filter((y): y is number => y !== undefined);
  const span = years.length === 0 ? undefined : { from: years[0], to: years[years.length - 1] };
  const spanText = !span ? '' : span.from === span.to ? String(span.from) : `${span.from}–${span.to}`;
  const n = chosen.length;

  const shots: Shot[] = [];
  if (titleFrames > 0) {
    shots.push({
      kind: 'title',
      frames: titleFrames,
      // „30 covers", never „all covers": the catalogues hold a fraction of
      // what was printed (CLAUDE.md, no copy claims completeness).
      kicker: `${n} ${n === 1 ? 'cover' : 'covers'} of`,
      title: input.work.title,
      author: input.work.authors[0] ?? '',
      span: spanText,
    });
  }
  const frames = weightedFrames(coverFrames, accelerating(n, options.accel ?? 3), minShot);
  chosen.forEach((d, i) => {
    // The dissolve takes about 40 % of a shot, never less than 0.15 s (it
    // would flicker) and never the whole shot (the cover must stand still a
    // moment before the next one comes).
    const transition = Math.max(minTransition, Math.min(i === 0 ? 14 : 12, Math.round(frames[i] * 0.4)));
    shots.push({
      kind: 'cover',
      frames: frames[i],
      transition: Math.min(transition, frames[i] - 1),
      index: i,
      coverId: d.cover.id,
      url: d.cover.url,
      year: d.year,
      publisher: d.publisher,
      language: d.language,
      caption: captionOf(d.year, d.publisher),
    });
  });
  if (gridFrames > 0) {
    const tileFrames = Math.min(7, Math.max(1, Math.floor(gridFrames / 4)));
    // Every tile has arrived by just under half the shot; the rest is the wall held still.
    const stagger = Math.max(1, Math.floor((gridFrames * 0.45 - tileFrames) / Math.max(1, n - 1)));
    shots.push({ kind: 'grid', frames: gridFrames, coverIds: chosen.map(d => d.cover.id), layout: gridLayout(n), stagger, tileFrames });
  }
  if (endFrames > 0) {
    shots.push({
      kind: 'end',
      frames: endFrames,
      wordmark: options.siteName ?? 'Beautiful Books',
      tagline: 'Covers, side by side.',
      url: options.siteUrl ?? SITE_URL_DEFAULT,
      credit: 'Covers from Open Library',
    });
  }
  return {
    width: CLIP_WIDTH,
    height: CLIP_HEIGHT,
    fps,
    totalFrames: shots.reduce((sum, s) => sum + s.frames, 0),
    shots,
    span,
    designs,
    coversIn: input.covers.length,
    excluded,
  };
}

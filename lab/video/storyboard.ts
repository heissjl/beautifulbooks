/**
 * The pure half of the clip experiment (lab/video/README.md, ROADMAP 5.5,
 * PLAN-struktur §4): from a work's editions and covers to a storyboard —
 * which covers, in which order, for how many frames, with which caption.
 *
 * No I/O. `render.ts` loads the data and the images, calls `storyboard`, and
 * turns the result into frames and an MP4.
 *
 * The rules are the wall's, so the clip and the site never disagree about
 * what counts as one design:
 *   - one cover per design (`foldDuplicateCovers` from lib/works.ts), so the
 *     same jacket scanned five times is shown once;
 *   - scanned inside pages sorted out (`looksLikeScannedPage`) — here left
 *     out, because a clip has no "end of the group" to sort them to;
 *   - ordered by the year of the earliest edition that carries the design.
 */
import { looksLikeScannedPage, type ImageSignature } from '../../lib/imagesig';
import type { Cover, Edition, Work } from '../../lib/model';
import { foldDuplicateCovers } from '../../lib/works';

export const CLIP_WIDTH = 1080;
export const CLIP_HEIGHT = 1920;

export interface StoryboardOptions {
  /** Most covers to show. Default 30. */
  count?: number;
  /** Length of the whole clip, title and end card included. Default 15. */
  seconds?: number;
  /** Frames per second. Default 30. */
  fps?: number;
  /** Title card length in seconds. Default 1.5; 0 leaves it out. */
  titleSeconds?: number;
  /** End card length in seconds. Default 1.5; 0 leaves it out. */
  endSeconds?: number;
  /**
   * Shortest time one cover may stay on screen. Default 0.25 s. When
   * `count` covers would each get less, fewer covers are shown: a design
   * that flashes for three frames is not seen, only counted.
   */
  minShotSeconds?: number;
  /** Only covers whose earliest edition is in this language (ISO 639-1). */
  language?: string;
  /**
   * Leave out covers without a signature. Default true: a cover without one
   * cannot fold, so it could be a second scan of a jacket already shown.
   */
  requireSignature?: boolean;
  /** Shown small on the end card. */
  siteName?: string;
}

export interface CoverShot {
  kind: 'cover';
  frames: number;
  coverId: string;
  /** The L-size image, which is what a 1080-wide frame needs. */
  url: string;
  year?: number;
  publisher?: string;
  language?: string;
  /** „1965 · Chilton Books", or whichever of the two is known; may be empty. */
  caption: string;
}

export interface CardShot {
  kind: 'title' | 'end';
  frames: number;
  lines: string[];
}

export type Shot = CoverShot | CardShot;

export interface Storyboard {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  shots: Shot[];
  /** Designs that survived folding and filtering, before the cap. */
  designs: number;
  /** Covers handed in. */
  coversIn: number;
}

export interface StoryboardInput {
  work: Pick<Work, 'title' | 'authors'>;
  editions: readonly Edition[];
  covers: readonly Cover[];
  signatures: ReadonlyMap<string, ImageSignature>;
}

interface Design {
  cover: Cover;
  year?: number;
  publisher?: string;
  language?: string;
}

/**
 * The edition that stands for a design: the earliest dated one among every
 * edition that carries it, folded scans included. That is the design's first
 * known appearance, which is what a year under a cover should mean.
 */
function representative(
  cover: Cover,
  coversById: ReadonlyMap<string, Cover>,
  editionsById: ReadonlyMap<string, Edition>,
): Edition | undefined {
  const ids = new Set(cover.editionIds);
  for (const similar of cover.similarIds ?? []) {
    for (const id of coversById.get(similar)?.editionIds ?? []) ids.add(id);
  }
  const editions = [...ids].map(id => editionsById.get(id)).filter((e): e is Edition => !!e);
  const dated = editions.filter(e => e.year !== undefined).sort((a, b) => a.year! - b.year!);
  return dated[0] ?? editions[0];
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
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const extra = total - base * parts;
  // The remainder goes to the first shots: the eye settles in at the start.
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

export function captionOf(year: number | undefined, publisher: string | undefined): string {
  return [year !== undefined ? String(year) : '', publisher?.trim() ?? ''].filter(Boolean).join(' · ');
}

/** The designs of a work, folded, filtered and in year order (undated last). */
export function designsOf(input: StoryboardInput, options: StoryboardOptions = {}): Design[] {
  const requireSignature = options.requireSignature ?? true;
  const usable = input.covers.filter(c => !requireSignature || input.signatures.has(c.id));
  const folded = foldDuplicateCovers(usable, input.signatures, input.editions);
  const coversById = new Map(input.covers.map(c => [c.id, c]));
  const editionsById = new Map(input.editions.map(e => [e.id, e]));
  const designs: Design[] = [];
  for (const cover of folded) {
    if (looksLikeScannedPage(input.signatures.get(cover.id))) continue;
    const edition = representative(cover, coversById, editionsById);
    if (options.language && edition?.language !== options.language) continue;
    designs.push({ cover, year: edition?.year, publisher: edition?.publisher, language: edition?.language });
  }
  // Stable: equal years keep the order the catalogue gave them.
  return designs
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.year ?? Infinity) - (b.d.year ?? Infinity) || a.i - b.i)
    .map(({ d }) => d);
}

export function storyboard(input: StoryboardInput, options: StoryboardOptions = {}): Storyboard {
  const fps = options.fps ?? 30;
  const totalFrames = Math.round((options.seconds ?? 15) * fps);
  const titleFrames = Math.round((options.titleSeconds ?? 1.5) * fps);
  const endFrames = Math.round((options.endSeconds ?? 1.5) * fps);
  const minShot = Math.max(1, Math.round((options.minShotSeconds ?? 0.25) * fps));
  const coverFrames = totalFrames - titleFrames - endFrames;
  if (coverFrames < minShot) throw new Error(`no time left for covers: ${totalFrames} frames, ${titleFrames + endFrames} for the cards`);

  const designs = designsOf(input, options);
  const cap = Math.min(options.count ?? 30, Math.floor(coverFrames / minShot));
  // Dated designs are spread over the years first; undated ones only fill up.
  const dated = designs.filter(d => d.year !== undefined);
  const undated = designs.filter(d => d.year === undefined);
  const chosen = dated.length >= cap
    ? spread(dated, cap)
    : [...dated, ...undated.slice(0, cap - dated.length)];
  if (chosen.length === 0) throw new Error('no covers to show');

  const years = chosen.map(d => d.year).filter((y): y is number => y !== undefined);
  const span = years.length === 0 ? '' : years[0] === years[years.length - 1]
    ? String(years[0])
    : `${years[0]}–${years[years.length - 1]}`;
  const author = input.work.authors[0];

  const shots: Shot[] = [];
  if (titleFrames > 0) {
    shots.push({
      kind: 'title',
      frames: titleFrames,
      // „30 covers", never „all covers": the catalogues hold a fraction of
      // what was printed (CLAUDE.md, no copy claims completeness).
      lines: [`${chosen.length} covers of`, input.work.title, [author, span].filter(Boolean).join(' · ')],
    });
  }
  const frames = splitFrames(coverFrames, chosen.length);
  chosen.forEach((d, i) => {
    shots.push({
      kind: 'cover',
      frames: frames[i],
      coverId: d.cover.id,
      url: d.cover.url,
      year: d.year,
      publisher: d.publisher,
      language: d.language,
      caption: captionOf(d.year, d.publisher),
    });
  });
  if (endFrames > 0) {
    shots.push({ kind: 'end', frames: endFrames, lines: [options.siteName ?? 'Beautiful Books', 'Covers: Open Library'] });
  }
  return {
    width: CLIP_WIDTH,
    height: CLIP_HEIGHT,
    fps,
    totalFrames: shots.reduce((sum, s) => sum + s.frames, 0),
    shots,
    designs: designs.length,
    coversIn: input.covers.length,
  };
}

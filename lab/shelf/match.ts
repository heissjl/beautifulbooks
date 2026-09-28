/**
 * From a recognised {title, author} to a work and a cover (ROADMAP 5.11).
 *
 * The decisions are pure and tested (`pickWork`, `pickCover`, `cropBox`,
 * `signatureOfImage`); `Matcher` is the part that asks Open Library, one
 * request at a time and never Google (lab rule 6): a search per book through
 * `lib/search.ts`, and — only for a book photographed front-on — page 0 of
 * the work's editions through `lib/work.ts` with `googleBooks: false`, whose
 * covers are hashed so the photographed jacket can be compared with them.
 *
 * Every result says how its cover was chosen, because a wall that shows "your
 * edition" must be able to tell a matched jacket from the work's default.
 */
import { colour, dhash, luminance, toGray, type RgbaImage } from '../../lib/imagehash';
import { colourDistance, hamming, type ImageSignature } from '../../lib/imagesig';
import type { WorkSummary } from '../../lib/model';
import { normalizeAuthor, normalizeTitle } from '../../lib/normalize';
import { search } from '../../lib/search';
import { getWorkPage } from '../../lib/work';
import type { RecognizedBook } from './recognize';

/**
 * Photo against scan. **Not measured yet**: the fold's thresholds (≤ 8, ≤ 13
 * across publishers with colour ≤ 0.52) compare two scans; a phone photo adds
 * perspective, glare and a shelf edge, so the bound is set looser and must be
 * checked on Julian's five photos before anything trusts it.
 */
export const PHOTO_MAX_HAMMING = 14;
export const PHOTO_MAX_COLOUR = 0.52;

export type WorkReason = 'author+title' | 'author' | 'title-only' | 'first-result';
export type CoverReason = 'matched-edition' | 'default' | 'no-photo' | 'no-close-cover' | 'no-cover' | 'chosen';

export interface CoverChoice {
  coverId: number;
  reason: CoverReason;
  /** Hamming distance of the nearest cover when a photo crop was compared. */
  distance?: number;
  colour?: number;
  /** How many of the work's covers had a signature to compare with. */
  compared?: number;
}

export interface MatchResult {
  recognized: RecognizedBook;
  /** Absent when Open Library found nothing, or did not answer (`error`). */
  work?: { id: string; title: string; author: string; firstPublished?: number };
  workReason?: WorkReason;
  cover?: CoverChoice;
  error?: string;
}

/* ---------- pure ---------- */

function authorWords(name: string): string[] {
  // normalizeAuthor turns "Orwell, George" into "george orwell".
  return normalizeAuthor(name).split(' ').filter(Boolean);
}

/**
 * Same person, as far as a spine can tell: the surnames agree. A spine often
 * prints only "ORWELL", and the model then gives just that, so the first name
 * is compared only when both sides have one.
 */
export function sameAuthor(a: string, b: string): boolean {
  const wa = authorWords(a);
  const wb = authorWords(b);
  if (wa.length === 0 || wb.length === 0) return false;
  const lastA = wa[wa.length - 1];
  const lastB = wb[wb.length - 1];
  if (lastA !== lastB) return false;
  // Both with a first word: the initials must agree, or one first word must be
  // inside the other name ("García Márquez" against "Gabriel García Márquez").
  if (wa.length > 1 && wb.length > 1) return wa[0][0] === wb[0][0] || wa.includes(wb[0]) || wb.includes(wa[0]);
  return true;
}

/** 2 = same title, 1 = one contains the other (a subtitle, a series prefix), 0 = neither. */
export function titleScore(recognized: string, work: string): number {
  const a = normalizeTitle(recognized);
  const b = normalizeTitle(work);
  if (!a || !b) return 0;
  if (a === b) return 2;
  if (` ${b} `.includes(` ${a} `) || ` ${a} `.includes(` ${b} `)) return 1;
  return 0;
}

/**
 * The work a recognised book most probably is. The search's own order is
 * already ranked (`rankWorks` with its `rankContext`: Open Library's position,
 * popularity relative to the rest, derivatives pushed down), so it breaks
 * every tie; a matching primary author weighs more than a matching title,
 * because a study guide shares the title and never the author.
 */
export function pickWork(
  works: readonly Pick<WorkSummary, 'id' | 'title' | 'authors'>[],
  book: Pick<RecognizedBook, 'title' | 'author'>,
): { index: number; reason: WorkReason } | null {
  if (works.length === 0) return null;
  let best = -1;
  let bestScore = -1;
  let bestReason: WorkReason = 'first-result';
  works.forEach((w, i) => {
    const author = !!book.author && sameAuthor(book.author, w.authors[0] ?? '');
    const title = titleScore(book.title, w.title);
    const score = (author ? 4 : 0) + title * 2;
    if (score > bestScore) {
      best = i;
      bestScore = score;
      bestReason = author && title > 0 ? 'author+title' : author ? 'author' : title > 0 ? 'title-only' : 'first-result';
    }
  });
  return { index: best, reason: bestReason };
}

/** Open Library cover id from a cover URL (`…/b/id/123-M.jpg`). */
export function coverIdFromUrl(url: string | undefined): number | undefined {
  const m = url ? /\/b\/id\/(\d+)-[SML]\.jpg/.exec(url) : null;
  return m ? Number(m[1]) : undefined;
}

/** The box of a photo, as its own image. Null when the box is under 8 px a side. */
export function cropBox(img: RgbaImage, box: [number, number, number, number]): RgbaImage | null {
  const x0 = Math.max(0, Math.round(box[0] * img.width));
  const y0 = Math.max(0, Math.round(box[1] * img.height));
  const x1 = Math.min(img.width, Math.round((box[0] + box[2]) * img.width));
  const y1 = Math.min(img.height, Math.round((box[1] + box[3]) * img.height));
  const width = x1 - x0;
  const height = y1 - y0;
  if (width < 8 || height < 8) return null;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const from = ((y0 + y) * img.width + x0) * 4;
    rgba.set(img.rgba.subarray(from, from + width * 4), y * width * 4);
  }
  return { width, height, rgba };
}

/** The same signature `signature()` in lib/imagehash.ts makes from bytes, from pixels. */
export function signatureOfImage(img: RgbaImage): ImageSignature {
  const gray = toGray(img);
  const { mean, contrast } = luminance(gray);
  return { hash: dhash(gray), contrast, mean, ...colour(img) };
}

/**
 * The work's cover nearest to the photographed one, if it is near enough.
 * Nearest by structure (dHash); colour vetoes a candidate only when both
 * sides carry it, as in the fold's fourth tier.
 */
export function pickCover(
  crop: ImageSignature,
  candidates: ReadonlyArray<{ coverId: number; signature: ImageSignature }>,
): { coverId: number; distance: number; colour?: number } | null {
  let best: { coverId: number; distance: number; colour?: number } | null = null;
  for (const c of candidates) {
    const distance = hamming(crop.hash, c.signature.hash);
    if (distance > PHOTO_MAX_HAMMING) continue;
    const col = colourDistance(crop, c.signature);
    if (col !== null && col > PHOTO_MAX_COLOUR) continue;
    if (!best || distance < best.distance) best = { coverId: c.coverId, distance, ...(col !== null ? { colour: col } : {}) };
  }
  return best;
}

/** Nearest distance regardless of the bounds, for the report when nothing passed. */
export function nearestDistance(crop: ImageSignature, candidates: ReadonlyArray<{ signature: ImageSignature }>): number | undefined {
  let d: number | undefined;
  for (const c of candidates) d = Math.min(d ?? Infinity, hamming(crop.hash, c.signature.hash));
  return d;
}

/* ---------- with Open Library ---------- */

export interface CoverOption { coverId: number; signature?: ImageSignature }

/**
 * Asks Open Library for one run, one request at a time, and remembers every
 * answer in memory until the server stops. Nothing is written to disk.
 */
export class Matcher {
  private searches = new Map<string, WorkSummary[]>();
  private covers = new Map<string, CoverOption[]>();
  private queue: Promise<unknown> = Promise.resolve();

  /** One Open Library request at a time, across all callers. */
  private serial<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async searchWorks(query: string): Promise<WorkSummary[]> {
    const key = query.toLowerCase().trim();
    const hit = this.searches.get(key);
    if (hit) return hit;
    const { works } = await this.serial(() => search(query));
    this.searches.set(key, works);
    return works;
  }

  /** Page 0 of a work's editions, hashed. Google is never asked. */
  async workCovers(workId: string, withSignatures = true): Promise<CoverOption[]> {
    const hit = this.covers.get(workId);
    if (hit && (!withSignatures || hit.some(c => c.signature))) return hit;
    const page = await this.serial(() => getWorkPage(workId, {
      googleBooks: false, siblings: false, workDescription: 'never', signatures: withSignatures,
    }));
    const options: CoverOption[] = (page?.covers ?? [])
      .filter(c => c.id.startsWith('ol:'))
      .map(c => ({ coverId: Number(c.id.slice(3)), signature: page?.signatures?.[c.id] }));
    this.covers.set(workId, options);
    return options;
  }

  async match(book: RecognizedBook, photo: RgbaImage | null): Promise<MatchResult> {
    try {
      const query = book.author ? `${book.title} ${book.author}` : book.title;
      let works = await this.searchWorks(query);
      let picked = pickWork(works, book);
      // A misread author can empty the search; the title alone is the second try.
      if ((!picked || picked.reason === 'first-result' || picked.reason === 'title-only') && book.author) {
        const byTitle = await this.searchWorks(book.title);
        const second = pickWork(byTitle, book);
        if (second && (!picked || rank(second.reason) > rank(picked.reason))) { works = byTitle; picked = second; }
      }
      if (!picked) return { recognized: book };
      const w = works[picked.index];
      const result: MatchResult = {
        recognized: book,
        work: { id: w.id, title: w.title, author: w.authors[0] ?? '', ...(w.firstPublishYear ? { firstPublished: w.firstPublishYear } : {}) },
        workReason: picked.reason,
      };
      const fallback = coverIdFromUrl(w.coverUrls[0]);

      if (book.kind === 'cover' && book.box && photo) {
        const crop = cropBox(photo, book.box);
        const options = crop ? await this.workCovers(w.id) : [];
        const withSig = options.filter((o): o is { coverId: number; signature: ImageSignature } => !!o.signature);
        if (crop && withSig.length > 0) {
          const sig = signatureOfImage(crop);
          const found = pickCover(sig, withSig);
          if (found) {
            result.cover = { coverId: found.coverId, reason: 'matched-edition', distance: found.distance, compared: withSig.length, ...(found.colour !== undefined ? { colour: found.colour } : {}) };
            return result;
          }
          result.cover = fallback
            ? { coverId: fallback, reason: 'no-close-cover', distance: nearestDistance(sig, withSig), compared: withSig.length }
            : { coverId: 0, reason: 'no-cover' };
          return result;
        }
      }
      result.cover = fallback
        ? { coverId: fallback, reason: book.kind === 'cover' && !photo ? 'no-photo' : 'default' }
        : { coverId: 0, reason: 'no-cover' };
      return result;
    } catch (err) {
      // A source that does not answer is not "not found" (CLAUDE.md).
      return { recognized: book, error: `Open Library: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

function rank(reason: WorkReason): number {
  return { 'author+title': 3, author: 2, 'title-only': 1, 'first-result': 0 }[reason];
}

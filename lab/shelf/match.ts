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
import { colour, decode, dhash, luminance, toGray, type RgbaImage } from '../../lib/imagehash';
import { fetchBytes } from '../../lib/sources/http';
import { spineColor } from '../colorsort/color';
import { refineSpineBox, toLabImage, type LabImage } from '../colorsort/spines';
import { pickBySpine, samePublisher, type CoverColours, type EditionCandidate, type RankedCover } from './edition';
import { colourDistance, hamming, type ImageSignature } from '../../lib/imagesig';
import type { WorkSummary } from '../../lib/model';
import { search } from '../../lib/search';
import { getWorkPage } from '../../lib/work';
import type { RecognizedBook } from './recognize';
import { coverIdFromUrl, pickWork, type WorkReason } from '../../lib/bookmatch';

export { coverIdFromUrl, pickWork, sameAuthor, titleScore, type WorkReason } from '../../lib/bookmatch';

/**
 * Photo against scan. **Not measured yet**: the fold's thresholds (≤ 8, ≤ 13
 * across publishers with colour ≤ 0.52) compare two scans; a phone photo adds
 * perspective, glare and a shelf edge, so the bound is set looser and must be
 * checked on Julian's five photos before anything trusts it.
 */
export const PHOTO_MAX_HAMMING = 14;
export const PHOTO_MAX_COLOUR = 0.52;

export type CoverReason = 'matched-edition' | 'spine-edition' | 'spine-no-match' | 'default' | 'no-photo' | 'no-close-cover' | 'no-cover' | 'chosen';

/** How many of a work's covers are fetched to compare with one spine. */
export const SPINE_MAX_CANDIDATES = 16;

export interface CoverChoice {
  coverId: number;
  reason: CoverReason;
  /** Hamming distance of the nearest cover when a photo crop was compared. */
  distance?: number;
  colour?: number;
  /** How many of the work's covers had a signature to compare with. */
  compared?: number;
  /** Spine matches: the publisher read off the spine, and whether the edition carries it. */
  publisher?: string;
  publisherMatch?: boolean;
  /** Spine matches: OKLab distance from the spine's colour to the cover's nearest main colour. */
  gap?: number;
  editionPublisher?: string;
  year?: number;
}

export interface MatchResult {
  recognized: RecognizedBook;
  /** Absent when Open Library found nothing, or did not answer (`error`). */
  work?: { id: string; title: string; author: string; firstPublished?: number };
  workReason?: WorkReason;
  cover?: CoverChoice;
  error?: string;
}

/** The second pass for a spine: its edition, and the covers in order of likeness. */
export interface SpineEditionResult {
  cover: CoverChoice;
  ranked: RankedCover[];
  /** The spine's colour as the server read it, and the box after refinement. */
  spine: { hex: string; box: [number, number, number, number] };
}

/* ---------- pure ---------- */


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
  private editions = new Map<string, EditionCandidate[]>();
  private coverColours = new Map<number, Promise<CoverColours[] | null>>();
  private labs = new WeakMap<RgbaImage, LabImage>();
  private imageSlots = 4;
  private imageWaiting: Array<() => void> = [];
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

  /** Page 0 of a work as candidates for a spine: each cover with its edition's publisher and year. */
  async workEditions(workId: string): Promise<EditionCandidate[]> {
    const hit = this.editions.get(workId);
    if (hit) return hit;
    const page = await this.serial(() => getWorkPage(workId, {
      googleBooks: false, siblings: false, workDescription: 'never', signatures: false,
    }));
    const byId = new Map((page?.editions ?? []).map(e => [e.id, e]));
    const out: EditionCandidate[] = (page?.covers ?? [])
      .filter(c => c.id.startsWith('ol:'))
      .map(c => {
        const edition = c.editionIds.map(id => byId.get(id)).find(e => e?.publisher) ?? byId.get(c.editionIds[0]);
        return {
          coverId: Number(c.id.slice(3)),
          ...(edition?.publisher ? { publisher: edition.publisher } : {}),
          ...(edition?.year ? { year: edition.year } : {}),
        };
      });
    this.editions.set(workId, out);
    return out;
  }

  /** A cover's main colours, from its small image; four images at a time, remembered. */
  private coloursOf(coverId: number): Promise<CoverColours[] | null> {
    let hit = this.coverColours.get(coverId);
    if (!hit) {
      hit = this.withImageSlot(async () => {
        try {
          const bytes = await fetchBytes(`https://covers.openlibrary.org/b/id/${coverId}-S.jpg`, { timeoutMs: 8000, revalidate: 30 * 24 * 3600 });
          const img = decode(bytes);
          if (!img || img.width < 8 || img.height < 8) return null;
          return spineColor(img.rgba, img.width, { x0: 0, y0: 0, x1: img.width, y1: img.height })
            .clusters.map(c => ({ lab: c.lab, share: c.share }));
        } catch {
          // A cover that did not load is not a cover without colours: forget it, so the next spine asks again.
          this.coverColours.delete(coverId);
          return null;
        }
      });
      this.coverColours.set(coverId, hit);
    }
    return hit;
  }

  private async withImageSlot<T>(job: () => Promise<T>): Promise<T> {
    if (this.imageSlots === 0) await new Promise<void>(resolve => this.imageWaiting.push(resolve));
    else this.imageSlots--;
    try {
      return await job();
    } finally {
      const next = this.imageWaiting.shift();
      if (next) next(); else this.imageSlots++;
    }
  }

  /**
   * The edition a photographed spine belongs to (ROADMAP 5.16): the model's
   * box moved onto the spine's edges, its colour read, the work's covers of
   * the same publisher (or, without one, the newest few) compared by colour.
   * Null when the book is not a spine with a box.
   */
  async spineEdition(book: RecognizedBook, workId: string, photo: RgbaImage, fallback: number): Promise<SpineEditionResult | null> {
    if (book.kind !== 'spine' || !book.box) return null;
    let lab = this.labs.get(photo);
    if (!lab) { lab = toLabImage(photo.rgba, photo.width, photo.height); this.labs.set(photo, lab); }
    const [fx, fy, fw, fh] = book.box;
    const raw = { x0: Math.round(fx * photo.width), y0: Math.round(fy * photo.height), x1: Math.round((fx + fw) * photo.width), y1: Math.round((fy + fh) * photo.height) };
    if (raw.x1 - raw.x0 < 3 || raw.y1 - raw.y0 < 10) return null;
    const box = refineSpineBox(lab, raw);
    const colour = spineColor(photo.rgba, photo.width, box);
    const spine = { hex: colour.hex, box: [box.x0 / photo.width, box.y0 / photo.height, (box.x1 - box.x0) / photo.width, (box.y1 - box.y0) / photo.height] as [number, number, number, number] };

    const all = await this.workEditions(workId);
    const byPublisher = book.publisher ? all.filter(c => samePublisher(book.publisher!, c.publisher)) : [];
    const chosen = (byPublisher.length ? byPublisher : all).slice(0, SPINE_MAX_CANDIDATES);
    const withColours = await Promise.all(chosen.map(async c => ({ ...c, colours: (await this.coloursOf(c.coverId)) ?? undefined })));
    const rest: EditionCandidate[] = all.filter(c => !chosen.includes(c));
    const { pick, ranked } = pickBySpine(colour, book.publisher, [...withColours, ...rest]);
    const compared = withColours.filter(c => c.colours).length;
    const evidence = {
      compared,
      ...(book.publisher ? { publisher: book.publisher } : {}),
    };
    const cover: CoverChoice = pick
      ? {
          coverId: pick.coverId, reason: 'spine-edition', ...evidence, publisherMatch: pick.publisherMatch,
          ...(pick.gap !== undefined ? { gap: Math.round(pick.gap * 1000) / 1000 } : {}),
          ...(pick.publisher ? { editionPublisher: pick.publisher } : {}), ...(pick.year ? { year: pick.year } : {}),
        }
      : {
          coverId: fallback, reason: fallback ? 'spine-no-match' : 'no-cover', ...evidence,
          ...(ranked[0]?.gap !== undefined ? { gap: Math.round(ranked[0].gap * 1000) / 1000 } : {}),
          publisherMatch: byPublisher.length > 0,
        };
    return { cover, ranked, spine };
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

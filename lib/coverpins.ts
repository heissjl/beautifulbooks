/**
 * Which covers of a work become pins of their own (ROADMAP 5.5, the test
 * line of 2026-11-04; docs/pinterest-formate-recherche-2026-11-03.md §5.2):
 * one cover alone as the picture, no wordmark, a link to exactly this cover.
 * Pure; `scripts/pin-covers.ts` runs it on the folded covers of a work and
 * then measures the pictures.
 *
 * What qualifies is what Pinterest does not already hold a thousand times:
 * a printing dated `maxYear` or earlier (an old scan), or a printing in a
 * language other than English. A cover that looks like a scanned inner page
 * is left out — here that is a choice for a pin, not a judgement on the
 * cover (`looksLikeScannedPage` never deletes anything on the site).
 *
 * The printing a cover stands for is the earliest dated edition that carries
 * it, as on the decade page and the comparison pin — **unless that record
 * contradicts itself**: an ISBN on a record dated before 1970, or a year
 * before the book's first publication, says the record describes a later
 * printing or holds a reprint's photo (the comparison pins of 2026-10-31
 * had seven such cases in ten). Then the earliest sound record is taken, and
 * what stays doubtful is said in `doubts`, so the note can say it and the
 * picker can put such covers last. Every picture is still looked at before
 * a pin is said yes to (umgang §8).
 */
import { PLACEHOLDER } from './comparepin';
import { looksLikeScannedPage, type ImageSignature } from './imagesig';
import type { Cover, Edition } from './model';

/** The first year an ISBN could stand on a book (SBNs from 1967 were converted later; a few such records will be doubted wrongly, which is a flag, not a verdict). */
export const ISBN_SINCE = 1970;

export type Doubt = 'isbn before 1970' | 'before first publication' | 'carriers disagree';

export interface CoverPrinting {
  /** The edition the pin's facts come from, when the work has one on record. */
  edition?: Edition;
  year?: number;
  publisher?: string;
  /** ISO 639-1 of that edition. */
  language?: string;
  /** How many editions carry this image. */
  carriers: number;
  /** What speaks against the facts; empty when nothing was found. */
  doubts: Doubt[];
}

/** The doubts one edition's record raises on its own. */
export function recordDoubts(e: Pick<Edition, 'year' | 'isbn10' | 'isbn13'>, firstYear?: number): Doubt[] {
  const out: Doubt[] = [];
  if (e.year && (e.isbn10 || e.isbn13) && e.year < ISBN_SINCE) out.push('isbn before 1970');
  if (e.year && firstYear && e.year < firstYear) out.push('before first publication');
  return out;
}

/** The earliest sound dated edition carrying the cover, else the earliest dated, else the first; and what is doubtful about it. */
export function coverPrinting(cover: Cover, editionsById: ReadonlyMap<string, Edition>, firstYear?: number): CoverPrinting {
  const carriers = cover.editionIds.map(id => editionsById.get(id)).filter((e): e is Edition => !!e);
  const dated = carriers.filter(e => e.year).sort((a, b) => a.year! - b.year!);
  const sound = dated.filter(e => recordDoubts(e, firstYear).length === 0);
  const edition = sound[0] ?? dated[0] ?? carriers[0];
  const doubts: Doubt[] = edition ? recordDoubts(edition, firstYear) : [];
  // Records of one image more than a decade apart: the earliest may be right (a design kept in print) or hold a reprint's photo.
  if (dated.length > 1 && dated[dated.length - 1].year! - dated[0].year! > 10) doubts.push('carriers disagree');
  const publisher = edition?.publisher?.trim();
  return {
    edition,
    year: edition?.year,
    publisher: publisher && !PLACEHOLDER.test(publisher) ? publisher : undefined,
    language: edition?.language,
    carriers: carriers.length,
    doubts,
  };
}

/**
 * A picture that is this much one colour is a binding without its jacket —
 * the red and black library cloth with a barcode that archive.org scanned
 * for the 1965 *Dune* and the 1932 *Brave New World* (2026-11-04) — not a
 * cover anyone would pin. `looksLikeScannedPage` only knows white pages.
 */
export const PLAIN_SHARE = 0.85;

/** How much of a picture is one colour: the share of cells within `tolerance` (RGB distance) of the median cell. `rgb` is a small raster, three bytes a cell. */
export function plainShare(rgb: Uint8Array, tolerance = 48): number {
  const n = Math.floor(rgb.length / 3);
  if (n === 0) return 0;
  const median = (k: number) => {
    const values: number[] = [];
    for (let i = 0; i < n; i++) values.push(rgb[i * 3 + k]);
    values.sort((a, b) => a - b);
    return values[Math.floor(n / 2)];
  };
  const m = [median(0), median(1), median(2)];
  let close = 0;
  for (let i = 0; i < n; i++) {
    if (Math.hypot(rgb[i * 3] - m[0], rgb[i * 3 + 1] - m[1], rgb[i * 3 + 2] - m[2]) <= tolerance) close++;
  }
  return close / n;
}

export type CoverPinReason = 'old' | 'foreign';

export interface CoverPinCandidate extends CoverPrinting {
  cover: Cover;
  reasons: CoverPinReason[];
}

export interface CoverPinRules {
  /** A printing dated this year or earlier counts as old. Default 1990. */
  maxYear?: number;
  /** Whether a printing in a language other than English qualifies on its own. Default true. */
  foreign?: boolean;
  /** How many the caller wants per work, and how many spares follow for pictures that fail the measurement. Defaults 2 and 4. */
  perWork?: number;
  spare?: number;
  /** Cover ids that are already pins (an id folded under another scan counts as that scan). */
  exclude?: ReadonlySet<string>;
  /** The book's first publication year, for the doubts. */
  firstYear?: number;
}

/**
 * The candidates in the order to try them: first the old ones, oldest first
 * and no two of one decade among the first `perWork`, then the foreign
 * printings, one per language among the first picks; the spares follow in
 * the same order. In each group a cover with doubts comes after those
 * without. A cover named in `exclude` is skipped, and so is one whose
 * signature says it is a scanned page.
 */
export function pickCoverPins(
  covers: readonly Cover[],
  editions: readonly Edition[],
  signatures: ReadonlyMap<string, ImageSignature>,
  rules: CoverPinRules = {},
): CoverPinCandidate[] {
  const maxYear = rules.maxYear ?? 1990;
  const foreign = rules.foreign ?? true;
  const perWork = rules.perWork ?? 2;
  const spare = rules.spare ?? 4;
  const exclude = rules.exclude ?? new Set<string>();
  const byId = new Map(editions.map(e => [e.id, e]));

  const all: CoverPinCandidate[] = [];
  for (const cover of covers) {
    if (exclude.has(cover.id) || cover.similarIds?.some(id => exclude.has(id))) continue;
    if (looksLikeScannedPage(signatures.get(cover.id))) continue;
    const printing = coverPrinting(cover, byId, rules.firstYear);
    const reasons: CoverPinReason[] = [];
    if (printing.year && printing.year <= maxYear) reasons.push('old');
    if (foreign && printing.language && printing.language !== 'en') reasons.push('foreign');
    if (reasons.length === 0) continue;
    all.push({ cover, ...printing, reasons });
  }

  const year = (c: CoverPinCandidate) => c.year ?? Infinity;
  const order = (a: CoverPinCandidate, b: CoverPinCandidate) => Math.sign(a.doubts.length) - Math.sign(b.doubts.length) || year(a) - year(b);
  const old = all.filter(c => c.reasons.includes('old')).sort(order);
  const rest = all.filter(c => !c.reasons.includes('old')).sort(order);

  const picked: CoverPinCandidate[] = [];
  const decades = new Set<number>();
  for (const c of old) {
    if (picked.length >= perWork) break;
    const decade = Math.floor(c.year! / 10) * 10;
    if (decades.has(decade)) continue;
    decades.add(decade);
    picked.push(c);
  }
  const languages = new Set<string>();
  for (const c of rest) {
    if (picked.length >= perWork) break;
    if (languages.has(c.language!)) continue;
    languages.add(c.language!);
    picked.push(c);
  }
  for (const c of [...old, ...rest]) {
    if (picked.length >= perWork + spare) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

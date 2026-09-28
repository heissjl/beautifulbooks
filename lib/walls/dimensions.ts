/**
 * The real size of each book in a collection, and what the piece made of them
 * measures (ROADMAP 5.13i; research: docs/plans/research-book-dimensions.md).
 * Pure; the lookups that feed it are in `booksize.ts`.
 *
 * Every size says where it came from, and the piece is given as a range while
 * any book is only estimated (SPEC N12: never claim more than was checked).
 */

export type SizeSource =
  /** Open Library's `physical_dimensions` for this printing. */
  | 'openlibrary'
  /** Height from a national library (DNB, BnF, LoC), width from the cover scan's proportions. */
  | 'library'
  /** A typical size for the printing's format (paperback, hardcover, …). */
  | 'format'
  /** Nothing known: a trade paperback is assumed. */
  | 'assumed';

export interface BookSize {
  /** Centimetres, one decimal. */
  h: number;
  w: number;
  t?: number;
  source: SizeSource;
}

/**
 * Typical formats in centimetres. **From memory, not measured** (the research
 * marks them so): mass-market paperback, trade paperback, hardcover.
 */
export const FORMAT_CM = {
  massMarket: { w: 10.8, h: 17.5 },
  trade: { w: 13, h: 20 },
  hardcover: { w: 16, h: 24 },
} as const;

/** The spread an unknown book may take: from a mass-market paperback to a hardcover. */
export const UNKNOWN_RANGE = { min: FORMAT_CM.massMarket, max: FORMAT_CM.hardcover } as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Open Library's `physical_dimensions`, e.g. "20 x 13 x 2 centimeters",
 * "8.2 x 5.5 x 1 inches". Axis order varies between records, so the largest
 * value is the height, the next the width, the smallest the thickness. A
 * "centimeters" value over 60 is taken as millimetres (measured: Bloomsbury's
 * "198 x 129 x centimeters"). Anything implausible for a book is refused.
 */
export function parseOlDimensions(raw: string | undefined): Omit<BookSize, 'source'> | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  const values = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((v) => Number(v.replace(',', '.'))).filter((v) => v > 0);
  if (values.length < 2) return null;
  let factor: number;
  if (/inch|in\b|"/.test(text)) factor = 2.54;
  else if (/mm|millimet/.test(text)) factor = 0.1;
  else if (/cm|centimet/.test(text)) factor = Math.max(...values) > 60 ? 0.1 : 1;
  else return null;
  const [h, w, t] = [...values].sort((a, b) => b - a).map((v) => round1(v * factor));
  if (h < 8 || h > 50 || w < 5 || w > 40 || h < w) return null;
  return { h, w, ...(t !== undefined && t > 0 && t < 15 ? { t } : {}) };
}

/** MARC 300 $c / UNIMARC 215 $d: "18 cm", "21 x 14 cm", "24 cm." — the height, and a width when given. */
export function parseLibraryHeight(raw: string | undefined): { h: number; w?: number } | null {
  if (!raw) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*(?:x\s*(\d+(?:[.,]\d+)?)\s*)?cm/i.exec(raw);
  if (!m) return null;
  const h = Number(m[1].replace(',', '.'));
  const w = m[2] ? Number(m[2].replace(',', '.')) : undefined;
  if (h < 8 || h > 50) return null;
  return { h, ...(w && w >= 5 && w < h ? { w } : {}) };
}

/**
 * Width from the height and the cover scan's proportions. A scan outside 1.25–1.9
 * (height/width) is not a single cover — a spread, a crop — and gives nothing
 * (4.5 % of 7,616 scans, measured).
 */
export function widthFromScan(h: number, scanW: number | undefined, scanH: number | undefined): number | null {
  if (!scanW || !scanH) return null;
  const ratio = scanH / scanW;
  if (ratio < 1.25 || ratio > 1.9) return null;
  return round1(h / ratio);
}

/** A typical size for Open Library's `physical_format`, or null. */
export function sizeFromFormat(format: string | undefined): Omit<BookSize, 'source'> | null {
  const f = (format ?? '').toLowerCase();
  if (/mass\s*market/.test(f)) return { ...FORMAT_CM.massMarket };
  if (/hard|cloth|gebunden|relié/.test(f)) return { ...FORMAT_CM.hardcover };
  if (/paper|soft|taschenbuch|broché|poche/.test(f)) return { ...FORMAT_CM.trade };
  return null;
}

export const isEstimate = (s: BookSize | undefined) => !s || s.source === 'format' || s.source === 'assumed';

/** Spacing of the piece in centimetres: margin inside the frame, gap between books, gap between rows, depth. */
export const PIECE_CM = { margin: 8, gap: 5, rowGap: 7, depth: 7 } as const;

export interface PlacedBook {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lays the books out: rows of `columns`, books side by side with a gap, all
 * books of a row on one bottom line, the row as tall as its tallest book (the
 * interim rule until Julian decides, ROADMAP 5.13i). Returns the outer size
 * and each book's place, in centimetres.
 */
export function layoutPiece(sizes: ReadonlyArray<{ w: number; h: number }>, columns: number): { widthCm: number; heightCm: number; columns: number; rows: number; books: PlacedBook[] } {
  const c = PIECE_CM;
  const cols = Math.max(1, Math.min(columns, sizes.length || 1));
  const rows: Array<Array<{ w: number; h: number }>> = [];
  sizes.forEach((s, i) => (rows[Math.floor(i / cols)] ??= []).push(s));
  const books: PlacedBook[] = [];
  let y = c.margin;
  let inner = 0;
  for (const row of rows) {
    const rowH = Math.max(...row.map((b) => b.h));
    let x = c.margin;
    for (const b of row) {
      books.push({ x: round1(x), y: round1(y + rowH - b.h), w: b.w, h: b.h });
      x += b.w + c.gap;
    }
    inner = Math.max(inner, x - c.gap - c.margin);
    y += rowH + c.rowGap;
  }
  const heightCm = round1(y - c.rowGap + c.margin);
  return { widthCm: round1(inner + 2 * c.margin), heightCm, columns: cols, rows: rows.length, books };
}

/**
 * The piece's size as a range: known sizes as they are, estimated ones from a
 * mass-market paperback to a hardcover. Equal ends mean nothing is estimated.
 */
export function pieceRange(sizes: ReadonlyArray<BookSize | undefined>, columns: number): { min: { w: number; h: number }; max: { w: number; h: number }; estimated: number } {
  const pick = (end: 'min' | 'max') =>
    sizes.map((s) => (s && !isEstimate(s) ? s : UNKNOWN_RANGE[end]));
  const lo = layoutPiece(pick('min'), columns);
  const hi = layoutPiece(pick('max'), columns);
  return { min: { w: lo.widthCm, h: lo.heightCm }, max: { w: hi.widthCm, h: hi.heightCm }, estimated: sizes.filter(isEstimate).length };
}

export type Units = 'metric' | 'imperial';

/** A length for the page: whole centimetres, or inches to the quarter with ¼ ½ ¾. */
export function formatLength(cm: number, units: Units): string {
  if (units === 'metric') return String(Math.round(cm));
  const q = Math.round((cm / 2.54) * 4) / 4;
  const whole = Math.floor(q);
  const frac = ['', '¼', '½', '¾'][Math.round((q - whole) * 4)];
  return `${whole || (frac ? '' : '0')}${frac}`;
}

export const unitLabel = (units: Units) => (units === 'metric' ? 'cm' : 'in');

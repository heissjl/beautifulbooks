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

/**
 * Spacing of the piece in centimetres: margin inside the frame, gap between
 * columns and rows, depth, the moulding's face width (drawn and counted in
 * the outer size), and the height of the clear acrylic ledge each row stands
 * on — one L-profile per row instead of a wedge per book (Julian, 2026-09-29:
 * „bau die Acrylleiste je Reihe … in den Plan“, after research-book-wall-artists.md:
 * conservators support a closed book across its whole thickness).
 */
export const PIECE_CM = { margin: 8, gap: 5, rowGap: 7, depth: 7, moulding: 3, ledge: 3 } as const;

/** The thickness assumed for a book whose thickness is not known. */
export const ASSUMED_THICKNESS_CM = 2.5;

export interface PlacedBook {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lays the books out on the back panel (Julian, 2026-09-29): rows of
 * `columns`; all books of a row on one bottom line, the row as tall as its
 * tallest book („gemeinsame unterkante je reihe passt so“); every column as
 * wide as its widest book, and each book centred in its column („sie müssen
 * jeweils pro column zentriert sein“). Returns the back panel's size, the
 * frame's outer size (moulding included), and each book's place on the panel,
 * in centimetres.
 */
export function layoutPiece(
  sizes: ReadonlyArray<{ w: number; h: number }>,
  columns: number,
): { widthCm: number; heightCm: number; outerWidthCm: number; outerHeightCm: number; columns: number; rows: number; books: PlacedBook[] } {
  const c = PIECE_CM;
  const cols = Math.max(1, Math.min(columns, sizes.length || 1));
  const rows: Array<Array<{ w: number; h: number }>> = [];
  sizes.forEach((s, i) => (rows[Math.floor(i / cols)] ??= []).push(s));
  const colW = Array.from({ length: cols }, (_, j) => Math.max(0, ...rows.map((r) => r[j]?.w ?? 0)));
  const colX: number[] = [];
  colW.reduce((x, w, j) => ((colX[j] = x), x + w + c.gap), c.margin);
  const books: PlacedBook[] = [];
  let y = c.margin;
  for (const row of rows) {
    const rowH = Math.max(...row.map((b) => b.h));
    row.forEach((b, j) => books.push({ x: round1(colX[j] + (colW[j] - b.w) / 2), y: round1(y + rowH - b.h), w: b.w, h: b.h }));
    y += rowH + c.rowGap;
  }
  const widthCm = round1(colW.reduce((a, w) => a + w, 0) + (cols - 1) * c.gap + 2 * c.margin);
  const heightCm = round1(y - c.rowGap + c.margin);
  return {
    widthCm,
    heightCm,
    outerWidthCm: round1(widthCm + 2 * c.moulding),
    outerHeightCm: round1(heightCm + 2 * c.moulding),
    columns: cols,
    rows: rows.length,
    books,
  };
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
  // The size a reader hangs: the frame's outside.
  return { min: { w: lo.outerWidthCm, h: lo.outerHeightCm }, max: { w: hi.outerWidthCm, h: hi.outerHeightCm }, estimated: sizes.filter(isEstimate).length };
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

/** One dimension line on the preview, in centimetres from the frame's outer top left. */
export interface Measure {
  kind: 'moulding' | 'margin' | 'gap' | 'rowPitch';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cm: number;
}

/**
 * The distances a reader asked to see on the sketch (Julian, 2026-09-29:
 * „abstand zw den reihen, abstand zum rand etc“): the moulding, the margin on
 * all four sides, the gap between neighbouring books in the first row, and the
 * distance from the first row's bottom edge to the second's. Each line measures what is really there — a
 * narrow book centred in a wide column stands further from its neighbour than
 * `PIECE_CM.gap` — so the lines are taken from the placed books, not the rules.
 */
export function measurements(plan: ReturnType<typeof layoutPiece>): Measure[] {
  const m = PIECE_CM.moulding;
  const { books, columns, widthCm, heightCm, outerWidthCm, outerHeightCm } = plan;
  if (books.length === 0) return [];
  const out: Measure[] = [];
  const line = (kind: Measure['kind'], x1: number, y1: number, x2: number, y2: number) =>
    out.push({ kind, x1: round1(x1), y1: round1(y1), x2: round1(x2), y2: round1(y2), cm: round1(Math.abs(x2 - x1) + Math.abs(y2 - y1)) });
  const row0 = books.slice(0, columns);
  const bottom0 = Math.max(...row0.map((b) => b.y + b.h));
  const tallest = (row: PlacedBook[]) => row.reduce((a, b) => (b.h > a.h ? b : a));

  line('moulding', outerWidthCm / 2, 0, outerWidthCm / 2, m);
  const first = row0[0];
  const last = row0[row0.length - 1];
  line('margin', m, m + first.y + first.h / 2, m + first.x, m + first.y + first.h / 2);
  line('margin', m + last.x + last.w, m + last.y + last.h / 2, m + widthCm, m + last.y + last.h / 2);
  const top = tallest(row0);
  line('margin', m + top.x + top.w / 2, m, m + top.x + top.w / 2, m + top.y);
  const lastRow = books.slice(Math.floor((books.length - 1) / columns) * columns);
  const low = lastRow[0];
  line('margin', m + low.x + low.w / 2, m + low.y + low.h, m + low.x + low.w / 2, m + heightCm);
  for (let j = 1; j < row0.length; j++) {
    const a = row0[j - 1];
    const b = row0[j];
    const y = m + bottom0 - Math.min(a.h, b.h) / 2;
    line('gap', m + a.x + a.w, y, m + b.x, y);
  }
  // Rows share a bottom edge, so the rows are measured ledge to ledge (Julian,
  // 2026-09-29: „abstand von dem oberen oder unteren wedge zu dem der mitte“),
  // drawn in the gap between the first two columns, where no book covers it.
  const row1 = books.slice(columns, 2 * columns);
  if (row1.length > 0) {
    const bottom1 = Math.max(...row1.map((b) => b.y + b.h));
    const x = row1.length > 1 ? (row1[0].x + row1[0].w + row1[1].x) / 2 : row1[0].x / 2;
    line('rowPitch', m + x, m + bottom0, m + x, m + bottom1);
  }
  return out.filter((d) => d.cm > 0 && outerHeightCm > 0);
}

/** One acrylic ledge: a row's books stand on it, its top on the row's bottom line. Centimetres on the back panel. */
export interface Ledge {
  x: number;
  /** The top of the ledge, where the books stand. */
  y: number;
  length: number;
  /** How far it reaches out from the panel: the row's thickest book, at least the profile's height. */
  depth: number;
}

/**
 * The ledges of a piece: one per row, from margin to margin, so every ledge
 * has the same length and a framer cuts one size. Deep enough to carry the
 * row's thickest book across its whole thickness, rounded up to half a
 * centimetre.
 */
export function ledges(
  plan: ReturnType<typeof layoutPiece>,
  sizes: ReadonlyArray<{ w: number; h: number; t?: number }>,
): Ledge[] {
  const out: Ledge[] = [];
  for (let r = 0; r < plan.rows; r++) {
    const row = plan.books.slice(r * plan.columns, (r + 1) * plan.columns);
    const thick = sizes.slice(r * plan.columns, (r + 1) * plan.columns).map((s) => s.t ?? ASSUMED_THICKNESS_CM);
    out.push({
      x: PIECE_CM.margin,
      y: round1(Math.max(...row.map((b) => b.y + b.h))),
      length: round1(plan.widthCm - 2 * PIECE_CM.margin),
      depth: Math.max(PIECE_CM.ledge, Math.ceil(Math.max(...thick) * 2) / 2),
    });
  }
  return out;
}


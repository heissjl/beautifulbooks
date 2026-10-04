/**
 * A closer second look at a dense photo (ROADMAP 5.11a; Julian, 2026-10-03:
 * „mach variante 3“). Pure and client-safe.
 *
 * The first read of a photo is its own density signal and costs nothing
 * extra: at DENSE_AT books the photo is a wall rather than a shelf, and on a
 * wall the model reads about half of what is there (33–39 of Julian's
 * gallery wall, 2026-10-03). Read again shelf by shelf, in pieces cut from
 * the full-size photo, it reads about twice as many and finds authors it had
 * not seen.
 */
import type { RecognizedBook } from '@/lib/recognize';

/**
 * From this many books in the first read on, the photo is read again in
 * pieces. 40, not the 30 it began with (Julian, 2026-10-04: „die grenze für
 * die dichte hochsetzen, damit wir nicht aus versehen viel ausgeben“): on the
 * test set one look reads 35–55 books of a dense shelf and at most 21 of
 * anything else, so 40 still catches five of the six dense photos and leaves
 * out the one a second look added nothing to.
 */
export const DENSE_AT = 40;

/** [x0, y0, x1, y1] as fractions of the picture. */
export type Piece = [number, number, number, number];

/** A little more than the shelf, so the ends of the spines are in the piece. */
const PAD = 0.012;

/**
 * The pieces a dense photo is read again in: every shelf on its own, cut at
 * the boards (`shelves`, from lib/shelfrows.ts), and each shelf in two or
 * three overlapping parts side by side. Cuts along the boards and between
 * spines go through no title; a cut across a shelf does — the model read
 * "Edo to Performance" where "Body to Performance" stands — and with thirty
 * spines in one piece it counted its way to "150 per cent" across, so the
 * points were worthless (both measured 2026-10-03). Without shelves (a pile,
 * one long shelf) the whole height is one row.
 */
export function piecesOf(width: number, height: number, shelves: readonly (readonly [number, number])[] = []): Piece[] {
  const rows: readonly (readonly [number, number])[] = shelves.length ? shelves : [[0, 1]];
  return rows.flatMap(([top, bottom]) => {
    const y0 = Math.max(0, top - PAD);
    const y1 = Math.min(1, bottom + PAD);
    // A shelf more than four times as wide as it is high gets three parts, so a part stays near a dozen spines.
    const wide = width / ((y1 - y0) * height) > 4;
    const parts: [number, number][] = wide ? [[0, 0.4], [0.3, 0.7], [0.6, 1]] : [[0, 0.6], [0.4, 1]];
    return parts.map(([x0, x1]): Piece => [x0, y0, x1, y1]);
  });
}

/** A book read in a piece, with its point in the whole picture. */
export function inWhole(book: RecognizedBook, [x0, y0, x1, y1]: Piece): RecognizedBook {
  return {
    ...book,
    ...(book.x !== undefined ? { x: x0 + book.x * (x1 - x0) } : {}),
    ...(book.y !== undefined ? { y: y0 + book.y * (y1 - y0) } : {}),
  };
}

export const wordsOf = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/** The share of a title's letters two readings of one spine may differ in. Two of "Nicolas Party Rocine", none of "Dune". */
const MISREAD = 0.15;

/** Edit distance between two strings (insert, delete, replace). */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/**
 * Whether two readings are the same book: the same title give or take a
 * misread letter, or one's title
 * — two words at least — wholly inside the other's title and
 * author ("Giuseppe Penone" and "Matrice" by Giuseppe Penone). One word
 * inside a longer title is not enough: "Picasso" stands beside "Picasso and
 * Françoise Gilot" on the same shelf. Where the readings lie is not asked:
 * the same spine read in two pieces came back up to half a picture apart,
 * so two copies of one book count as one — which a collection does anyway.
 */
export function sameBook(a: RecognizedBook, b: RecognizedBook): boolean {
  const ta = wordsOf(a.title);
  const tb = wordsOf(b.title);
  if (ta.length === 0 || tb.length === 0) return false;
  // The same letters, give or take a misreading: "Maki Na Kamura" and "Makina Kamura", "Rocine" and "Rottine".
  const ja = ta.join('');
  const jb = tb.join('');
  if (ja === jb) return true;
  if (Math.min(ja.length, jb.length) >= 5 && distance(ja, jb) <= Math.floor(Math.max(ja.length, jb.length) * MISREAD)) return true;
  // Either title, two words at least, wholly inside the other reading's title and author.
  const inside = (one: string[], other: RecognizedBook) => {
    if (one.length < 2) return false;
    const all = new Set(wordsOf(`${other.title} ${other.author}`));
    return one.every((w) => all.has(w));
  };
  return inside(ta, b) || inside(tb, a);
}

/** Of two readings of one book, the one that says more: a title read clearly over one read in part, an author over none, then the longer title. */
function better(a: RecognizedBook, b: RecognizedBook): RecognizedBook {
  if (!!a.unsure !== !!b.unsure) return a.unsure ? b : a;
  if (!!a.author !== !!b.author) return a.author ? a : b;
  return b.title.length > a.title.length ? b : a;
}

/**
 * The books of a photo from its first read and its pieces: the pieces'
 * readings in their order, each book once (overlapping pieces read the same
 * shelf twice), then what only the first read saw.
 */
export function mergeReads(first: readonly RecognizedBook[], pieces: readonly RecognizedBook[]): RecognizedBook[] {
  const out: RecognizedBook[] = [];
  for (const book of pieces) {
    const i = out.findIndex((o) => sameBook(o, book));
    if (i < 0) out.push(book);
    else out[i] = better(out[i], book);
  }
  for (const book of first) {
    const i = out.findIndex((o) => sameBook(o, book));
    if (i < 0) {
      out.push(book);
      continue;
    }
    // The fuller reading keeps its words; the piece keeps its point. A piece is one shelf, so its point cannot
    // be a shelf out, which the first read's often was (the top shelf's books at 0.42 of the height, not 0.23).
    const kept = better(out[i], book);
    out[i] = { ...kept, ...(out[i].x !== undefined && out[i].y !== undefined ? { x: out[i].x, y: out[i].y } : {}) };
  }
  return out;
}

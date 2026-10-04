/**
 * The order of the books by colour, and where each one goes (ROADMAP 5.16).
 * Pure.
 *
 * A rainbow shelf, as people build them by hand: the whites first, then the
 * colours around the hue circle starting at red, then greys and blacks from
 * light to dark. A hue sort alone jumps between a pale and a dark book of
 * the same hue with every step, so the circle is cut into buckets and each
 * bucket runs from light to dark. Every number here was chosen, not
 * measured: the README says what to look at to set them.
 */
import type { Oklch } from './color';

export interface Book {
  id: number;
  /** Row in the photo, top first, and position in it, left first. */
  row: number;
  pos: number;
  /** Width in pixels of the photo — what a book takes up on the board. */
  width: number;
  lch: Oklch;
}

export type Mode = 'rainbow' | 'light-dark';

export interface SortOptions {
  mode: Mode;
  /** Below this OKLCh chroma a book counts as white, grey or black. */
  neutralChroma: number;
  /** Where the circle starts, in degrees; OKLCh red is about 25, pink about 350. */
  startHue: number;
  /** Width of a hue bucket in degrees; 0 sorts by hue alone. */
  bucket: number;
}

export const DEFAULTS: SortOptions = { mode: 'rainbow', neutralChroma: 0.04, startHue: 10, bucket: 30 };

export type Group = 'white' | 'colour' | 'dark';

export function groupOf(lch: Oklch, o: SortOptions = DEFAULTS): Group {
  if (lch.C >= o.neutralChroma) return 'colour';
  return lch.L >= 0.7 ? 'white' : 'dark';
}

/** The books in their new order. Ties keep the order of the photo. */
export function sortBooks(books: Book[], o: SortOptions = DEFAULTS): Book[] {
  const byPhoto = (p: Book, q: Book) => p.row - q.row || p.pos - q.pos;
  if (o.mode === 'light-dark') return [...books].sort((p, q) => q.lch.L - p.lch.L || byPhoto(p, q));
  const turn = (h: number) => (h - o.startHue + 360) % 360;
  const rank: Record<Group, number> = { white: 0, colour: 1, dark: 2 };
  return [...books].sort((p, q) => {
    const gp = groupOf(p.lch, o), gq = groupOf(q.lch, o);
    if (gp !== gq) return rank[gp] - rank[gq];
    if (gp === 'colour') {
      const hp = turn(p.lch.h), hq = turn(q.lch.h);
      if (o.bucket > 0) {
        const bp = Math.floor(hp / o.bucket), bq = Math.floor(hq / o.bucket);
        if (bp !== bq) return bp - bq;
        return q.lch.L - p.lch.L || byPhoto(p, q);
      }
      return hp - hq || byPhoto(p, q);
    }
    return q.lch.L - p.lch.L || byPhoto(p, q);
  });
}

export interface Placement { book: Book; row: number; pos: number }

/**
 * Fills the rows again in the new order, each up to the width its books took
 * in the photo, so no board gets more than it held. Whatever is left when
 * the last row is full goes on the last row as well; the photo cannot say
 * how much room there really is.
 */
export function layout(sorted: Book[], rowCapacity: number[]): Placement[] {
  const out: Placement[] = [];
  let row = 0, used = 0, pos = 0;
  for (const book of sorted) {
    const last = row >= rowCapacity.length - 1;
    if (!last && pos > 0 && used + book.width > rowCapacity[row] * 1.02) {
      row++; used = 0; pos = 0;
    }
    out.push({ book, row, pos });
    used += book.width;
    pos++;
  }
  return out;
}

/** How many books already stand where the new order wants them. */
export function unmoved(placements: Placement[]): number {
  return placements.filter(p => p.book.row === p.row && p.book.pos === p.pos).length;
}

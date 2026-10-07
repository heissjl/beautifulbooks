/**
 * Three books on an empty board, as examples (ROADMAP 5.18b; Julian,
 * 2026-10-06: „prefill 3 random spots (but never directly next to each
 * other) with a cover from the curated list, the collections or the cache,
 * so people get the idea what to do with the shelfportrait and have some
 * incentive to interact").
 *
 * Pure: the caller hands in the books and a random source. The page draws
 * them on the server, from the curated list and the published collections —
 * the site's cache cannot be listed, and a cover outside it would be a new
 * request. The editor marks a starter as an example until it is replaced.
 */
import type { Slot } from './board';

export interface StarterBook {
  id: string;
  title: string;
  author: string;
  /** `ol:<number>` */
  coverId: string;
}

export interface Starter {
  index: number;
  book: StarterBook;
}

/** How many places an empty board starts with. */
export const STARTERS = 3;

const COLS = 3;

/** Left, right, above or below on a board of three columns; a diagonal is not "next to". */
export function adjacent(a: number, b: number): boolean {
  const [ra, ca, rb, cb] = [Math.floor(a / COLS), a % COLS, Math.floor(b / COLS), b % COLS];
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

/** Every set of `n` places on a board of `size` where no two stand next to each other, in order. */
export function apartSets(size: number, n: number): number[][] {
  const out: number[][] = [];
  const grow = (from: number, chosen: number[]) => {
    if (chosen.length === n) { out.push(chosen); return; }
    for (let i = from; i < size; i++) if (chosen.every(c => !adjacent(c, i))) grow(i + 1, [...chosen, i]);
  };
  grow(0, []);
  return out;
}

/** Three places apart and three different books, drawn with `random` (0 ≤ x < 1). Fewer when the pool is short. */
export function drawStarters(pool: readonly StarterBook[], random: () => number, size = 9, n = STARTERS): Starter[] {
  const sets = apartSets(size, n);
  if (sets.length === 0) return [];
  const places = sets[Math.floor(random() * sets.length)];
  const books: StarterBook[] = [];
  const left = [...pool];
  while (books.length < places.length && left.length > 0) {
    const [book] = left.splice(Math.floor(random() * left.length), 1);
    if (!books.some(b => b.id === book.id)) books.push(book);
  }
  return books.map((book, i) => ({ index: places[i], book }));
}

/** Whether a slot still holds the example it started with. */
export function isStarter(slot: Slot | null, starter: Starter | undefined): boolean {
  return !!slot && !!starter && slot.workId === starter.book.id && slot.coverId === starter.book.coverId;
}

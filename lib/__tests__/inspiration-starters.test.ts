import { describe, expect, it } from 'vitest';
import { adjacent, apartSets, drawStarters, isStarter, type StarterBook } from '../inspiration/starters';

const book = (n: number): StarterBook => ({ id: `OL${n}W`, title: `Book ${n}`, author: 'A', coverId: `ol:${n}` });
const pool = Array.from({ length: 20 }, (_, i) => book(i + 1));

/** A random source that walks through fixed values, so a draw can be repeated. */
function sequence(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('starters on an empty board', () => {
  it('knows which places stand next to each other on three columns', () => {
    expect(adjacent(0, 1)).toBe(true);
    expect(adjacent(0, 3)).toBe(true);
    expect(adjacent(2, 3)).toBe(false); // end of one row, start of the next
    expect(adjacent(0, 4)).toBe(false); // diagonal
  });

  it('never puts two of the three next to each other, however it is drawn', () => {
    const sets = apartSets(9, 3);
    expect(sets.length).toBeGreaterThan(10);
    for (const set of sets) for (const a of set) for (const b of set) if (a !== b) expect(adjacent(a, b)).toBe(false);
    for (let k = 0; k < 200; k++) {
      const drawn = drawStarters(pool, Math.random);
      expect(drawn).toHaveLength(3);
      for (const a of drawn) for (const b of drawn) if (a !== b) expect(adjacent(a.index, b.index)).toBe(false);
      expect(new Set(drawn.map(s => s.book.id)).size).toBe(3);
    }
  });

  it('draws three different books even when the pool repeats one', () => {
    const drawn = drawStarters([book(1), book(1), book(1), book(2), book(3)], sequence([0, 0, 0, 0.99, 0.5]));
    expect(new Set(drawn.map(s => s.book.id)).size).toBe(drawn.length);
  });

  it('draws fewer when the pool is short, and none from an empty pool', () => {
    expect(drawStarters([book(1)], Math.random)).toHaveLength(1);
    expect(drawStarters([], Math.random)).toEqual([]);
  });

  it('marks a slot as an example only while it holds the starter book and cover', () => {
    const s = { index: 0, book: book(7) };
    expect(isStarter({ workId: 'OL7W', coverId: 'ol:7' }, s)).toBe(true);
    expect(isStarter({ workId: 'OL7W', coverId: 'ol:8' }, s)).toBe(false);
    expect(isStarter(null, s)).toBe(false);
  });
});

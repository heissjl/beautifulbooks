import { describe, expect, it } from 'vitest';
import {
  buildPool, fitsGame, looksPlain, mixCandidates, poolName, sharpEnough, type CoverMeasure, type RawIndex,
} from '../hotornot/pool';

const index: RawIndex = {
  builtAt: '2026-09-09',
  works: [['OL1W', 'One', 'Ann'], ['OL2W', 'Two', 'Ben'], ['OL3W', 'Three', 'Cy']],
  covers: [
    [0, 'ol:1', 'ffff0000ffff0000', 60, 120, 40, ''],
    [0, 'ol:2', 'ffff0000ffff0001', 60, 120, 40, ''], // one bit from ol:1: a rescan of the same jacket
    [0, 'ol:3', '0f0f0f0f0f0f0f0f', 60, 120, 40, ''], // a different design of the same book
    [1, 'ol:4', '0000000000000000', 5, 250, 0, ''], // looks like a blank scan
    [1, 'ol:5', 'aaaa5555aaaa5555', 50, 110, 30, ''],
    [2, 'gb:x', '5555aaaa5555aaaa', 60, 120, 40, ''], // not Open Library
    [2, 'ol:6', 'ffff0000ffff0000', 60, 120, 40, ''], // the same hash as ol:1, but another book
  ],
};

const ids = (pool: Array<{ id: string }>) => pool.map(c => c.id);

/** A measured cover: sharp and coloured unless told otherwise. */
const m = (width: number, height: number, rest: Partial<CoverMeasure> = {}): CoverMeasure => ({ width, height, white: 0.1, yellow: 0, ...rest });

describe('a work pool', () => {
  it('holds every distinct design of the book, and each only once', () => {
    expect(ids(buildPool(index, { mode: 'work', workId: 'OL1W' }))).toEqual(['ol:1', 'ol:3']);
  });

  it('never folds across books, and plays only Open Library covers', () => {
    expect(ids(buildPool(index, { mode: 'work', workId: 'OL3W' }))).toEqual(['ol:6']);
  });

  it('keeps a blank-looking cover, for the players to judge', () => {
    expect(ids(buildPool(index, { mode: 'work', workId: 'OL2W' }))).toEqual(['ol:4', 'ol:5']);
  });

  it('is empty for a book the index does not know', () => {
    expect(buildPool(index, { mode: 'work', workId: 'OL9W' })).toEqual([]);
  });
});

describe('a mix pool', () => {
  it('takes one cover from each book, up to the size', () => {
    const pool = buildPool(index, { mode: 'mix', size: 3, seed: 'a' });
    expect(pool).toHaveLength(3);
    expect(new Set(pool.map(c => c.workId)).size).toBe(3);
    expect(buildPool(index, { mode: 'mix', size: 2, seed: 'a' })).toHaveLength(2);
  });

  it('is the same pool for the same seed', () => {
    expect(buildPool(index, { mode: 'mix', size: 3, seed: 'paperwhite' }))
      .toEqual(buildPool(index, { mode: 'mix', size: 3, seed: 'paperwhite' }));
  });

  it('passes over a blank scan', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const two = buildPool(index, { mode: 'mix', size: 3, seed }).find(c => c.workId === 'OL2W');
      expect(two?.id).toBe('ol:5');
    }
  });

  it('carries title and author for the board, which the vote does not show', () => {
    const one = buildPool(index, { mode: 'work', workId: 'OL1W' })[0];
    expect(one).toEqual({ id: 'ol:1', workId: 'OL1W', title: 'One', author: 'Ann' });
  });
});

// ROADMAP 5.8a: the Slaughterhouse-Five reading guide ("This is not the actual
// book cover") sat in the default pool and was taken out by hand.
describe('excluded covers', () => {
  it('are never chosen, and their rescans stay out with them', () => {
    // ol:2 is a one-bit rescan of ol:1; excluding ol:1 must not let ol:2 in.
    expect(ids(buildPool(index, { mode: 'work', workId: 'OL1W', exclude: ['ol:1'] }))).toEqual(['ol:3']);
  });

  it('give the book another of its covers', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const one = buildPool(index, { mode: 'mix', size: 3, seed, exclude: ['ol:1'] }).find(c => c.workId === 'OL1W');
      expect(one?.id).toBe('ol:3');
    }
  });

  it('leave no hole when a book has nothing else to show', () => {
    const pool = buildPool(index, { mode: 'mix', size: 2, seed: 'a', exclude: ['ol:6'] });
    expect(pool).toHaveLength(2);
    expect(pool.map(c => c.workId)).not.toContain('OL3W');
  });
});

// 2026-09-11, after the first votes on the preview and again after the 200-book
// pool: blurred covers, titles on white, page scans and Reclam out of the mix.
// Every number below is a cover from the contact sheets.
describe('what a mix leaves out', () => {
  it('knows a title on plain paper from a bright cover that is designed', () => {
    expect(looksPlain({ mean: 247, contrast: 25, saturation: 6 })).toBe(true); // "Planet PDF" placeholder
    expect(looksPlain({ mean: 239, contrast: 23, saturation: 3 })).toBe(true); // black-and-white title page
    expect(looksPlain({ mean: 223, contrast: 8, saturation: 71 })).toBe(true); // Odyssey, title on cream
    expect(looksPlain({ mean: 239, contrast: 18, saturation: 38 })).toBe(true); // Webster's thesaurus edition
    expect(looksPlain({ mean: 177, contrast: 11, saturation: 56 })).toBe(true); // Moby-Dick title page, aged paper
    expect(looksPlain({ mean: 164, contrast: 9, saturation: 101 })).toBe(true); // A Room with a View, yellowed
    expect(looksPlain({ mean: 244, contrast: 21, saturation: 15 })).toBe(false); // Little Prince, illustrated
    expect(looksPlain({ mean: 187, contrast: 11, saturation: 120 + 1 })).toBe(false); // Moby Dick, orange
    expect(looksPlain({ mean: 150, contrast: 13, saturation: 228 })).toBe(false); // Penguin, orange
    expect(looksPlain({ mean: 234, contrast: 28, saturation: 3 })).toBe(false); // Kundera, line drawing
  });

  it('takes only covers tall enough for the box and shaped like a cover', () => {
    expect(sharpEnough(m(327, 500))).toBe(true);
    expect(sharpEnough(m(300, 475))).toBe(true);
    expect(sharpEnough(m(213, 352))).toBe(false); // blown up 1.5 times in a 540 px box
    expect(sharpEnough(m(500, 281))).toBe(false); // a spread
    expect(sharpEnough(undefined)).toBe(false); // never measured
  });

  it('leaves out a cover that is mostly paper, and a classic Reclam, but not a yellow one that is designed', () => {
    expect(fitsGame(m(320, 500), 40)).toBe(true);
    expect(fitsGame(m(320, 500, { white: 0.93 }), 16)).toBe(false); // The Time Machine, title on cream
    expect(fitsGame(m(320, 500, { yellow: 0.977 }), 7)).toBe(false); // Reclam, Das Fräulein von Scuderi
    expect(fitsGame(m(320, 500, { yellow: 0.868 }), 27)).toBe(true); // Pippi, yellow and illustrated
    expect(fitsGame(undefined, 40)).toBe(false);
  });

  const bright: RawIndex = {
    builtAt: '2026-09-11',
    works: [['OL1W', 'One', 'Ann'], ['OL2W', 'Two', 'Ben'], ['OL3W', 'Three', 'Cy']],
    covers: [
      [0, 'ol:1', 'ffff0000ffff0000', 20, 239, 38, ''], // title on white
      [0, 'ol:2', '0f0f0f0f0f0f0f0f', 60, 120, 40, ''],
      [1, 'ol:3', 'aaaa5555aaaa5555', 50, 110, 30, ''],
      [1, 'ol:4', '5555aaaa5555aaaa', 50, 110, 30, ''],
      [2, 'ol:5', '3333cccc3333cccc', 60, 120, 40, ''],
    ],
  };

  it('never puts a title on white up for a vote, even as a book\'s only choice', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(ids(buildPool(bright, { mode: 'mix', size: 3, seed }))).not.toContain('ol:1');
    }
    const onlyWhite = { ...bright, covers: bright.covers.filter(c => c[1] !== 'ol:2') };
    expect(buildPool(onlyWhite, { mode: 'mix', size: 3, seed: 'a' }).map(c => c.workId)).not.toContain('OL1W');
  });

  it('takes a cover that fits over one that does not, and a book with none makes room for the next', () => {
    const measures = { 'ol:2': m(327, 500), 'ol:3': m(128, 192), 'ol:4': m(318, 500), 'ol:5': m(300, 475, { white: 0.9 }) };
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const pool = buildPool(bright, { mode: 'mix', size: 3, seed, measures });
      expect(ids(pool).sort()).toEqual(['ol:2', 'ol:4']);
    }
    expect(buildPool(bright, { mode: 'mix', size: 1, seed: 'a', measures })).toHaveLength(1);
  });

  it('tries covers in the order it tells the script to measure them', () => {
    const measures = { 'ol:2': m(327, 500), 'ol:3': m(318, 500), 'ol:4': m(318, 500), 'ol:5': m(300, 475) };
    const options = { mode: 'mix', size: 3, seed: 'paperwhite', measures } as const;
    const firsts = mixCandidates(bright, options).map(covers => covers[0].id);
    expect(ids(buildPool(bright, options))).toEqual(firsts);
  });

  // The first 200-book pool went online with 139 books while the index was still growing.
  it('grows without reshuffling: every cover of the earlier pool stays, the new books are drawn', () => {
    const small = { ...bright, works: bright.works.slice(0, 2), covers: bright.covers.filter(c => c[0] < 2) };
    const before = buildPool(small, { mode: 'mix', size: 3, seed: 'x' });
    for (const seed of ['x', 'y', 'z']) {
      const after = buildPool(bright, { mode: 'mix', size: 3, seed, keep: ids(before) });
      expect(ids(after).slice(0, before.length)).toEqual(ids(before));
      expect(after).toHaveLength(3);
    }
  });

  it('drops a kept cover that may no longer play, and gives its book another', () => {
    const after = buildPool(bright, { mode: 'mix', size: 3, seed: 'x', keep: ['ol:1', 'ol:3'] });
    expect(ids(after)).not.toContain('ol:1'); // a title on white, whatever the earlier pool held
    expect(ids(after)).toContain('ol:2');
    expect(ids(after)[0]).toBe('ol:3');
  });

  it('leaves a work pool as it was: every design, for the players to judge', () => {
    expect(ids(buildPool(bright, { mode: 'work', workId: 'OL1W' }))).toEqual(['ol:1', 'ol:2']);
  });
});

// Julian, 2026-09-11: "mach dann eine version mit 1000 covers" — more covers than the index has books.
describe('more covers than books', () => {
  const many: RawIndex = {
    builtAt: '2026-09-11',
    works: [['OL1W', 'One', 'Ann'], ['OL2W', 'Two', 'Ben']],
    covers: [
      [0, 'ol:1', '0000000000000000', 60, 120, 40, ''],
      [0, 'ol:2', 'ffffffffffffffff', 60, 120, 40, ''],
      [0, 'ol:3', '00000000ffffffff', 60, 120, 40, ''],
      [1, 'ol:4', 'ffffffff00000000', 60, 120, 40, ''],
    ],
  };

  it('lets a book bring several, every book its first before any its second', () => {
    const pool = buildPool(many, { mode: 'mix', size: 4, seed: 'a', perBook: 3 });
    expect(pool).toHaveLength(4);
    expect(new Set(pool.slice(0, 2).map(c => c.workId)).size).toBe(2);
    expect(pool.filter(c => c.workId === 'OL1W')).toHaveLength(3);
  });

  it('stops at the size and at the limit per book', () => {
    expect(buildPool(many, { mode: 'mix', size: 3, seed: 'a', perBook: 3 })).toHaveLength(3);
    expect(buildPool(many, { mode: 'mix', size: 9, seed: 'a', perBook: 2 })).toHaveLength(3);
  });
});

describe('pool names', () => {
  it('are safe file names that say what the pool is', () => {
    expect(poolName({ mode: 'mix', size: 100, seed: 'Paper White!' })).toBe('mix-100-paper-white');
    expect(poolName({ mode: 'work', workId: 'OL468431W' })).toBe('work-ol468431w');
  });
});

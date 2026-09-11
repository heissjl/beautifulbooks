import { describe, expect, it } from 'vitest';
import { buildPool, poolName, type RawIndex } from '../pool';

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

  it('passes over a blank scan when the book has a real face', () => {
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

describe('pool names', () => {
  it('are safe file names that say what the pool is', () => {
    expect(poolName({ mode: 'mix', size: 100, seed: 'Paper White!' })).toBe('mix-100-paper-white');
    expect(poolName({ mode: 'work', workId: 'OL468431W' })).toBe('work-ol468431w');
  });
});

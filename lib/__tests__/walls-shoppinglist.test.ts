import { describe, expect, it } from 'vitest';
import { agentList, shoppingText } from '../walls/shoppinglist';
import type { PublicWall } from '../walls/model';

const wall: PublicWall = {
  id: 'aaaaaaaaaa',
  title: 'Hallway',
  columns: 3,
  createdOn: 'd',
  updatedAt: 't',
  tiles: [
    { workId: 'OL1W', coverId: '8261367', title: 'Beloved', author: 'Toni Morrison', printings: [{ isbn13: '9780394535975', publisher: 'Knopf', year: 1987 }] },
    { workId: 'OL2W', coverId: '11', title: 'Untraced', printings: [] },
  ],
};
const URL = 'https://beautifulcovers.vercel.app/c/aaaaaaaaaa';

describe('shopping list (5.14 stage 1)', () => {
  it('writes one entry per book with ISBNs, the cover to match, and what is still to get', () => {
    const text = shoppingText(wall, new Set(['8261367']), URL);
    expect(text.split('\n')[0]).toBe('Hallway — 2 books, 1 still to get');
    expect(text).toContain('[x] 1. Beloved — Toni Morrison');
    expect(text).toContain('ISBN 9780394535975');
    expect(text).toContain('cover: https://covers.openlibrary.org/b/id/8261367-L.jpg');
    expect(text).toContain('[ ] 2. Untraced');
    expect(text).toContain('no ISBN on record');
  });

  it('gives an agent the books, the cover to judge by, and nothing about the reader', () => {
    const list = agentList(wall, new Set(), URL);
    expect(list.books[0]).toMatchObject({ position: 1, isbns: ['9780394535975'], printing: { publisher: 'Knopf', year: 1987 }, alreadyBought: false });
    expect(list.books[1].isbns).toEqual([]);
    expect(list.instructions.join(' ')).toMatch(/confirms the basket/);
    expect(JSON.stringify(list)).not.toMatch(/address|card|password|ownerHash/i);
  });
});

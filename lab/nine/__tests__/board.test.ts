import { describe, expect, it } from 'vitest';
import {
  boardQuery, cleanName, emptyBoard, filledCount, firstEmpty, NAME_MAX, parseBoard, place, remove, setCover, SLOTS, swap,
} from '../board';

const gatsby = { workId: 'OL468431W', coverId: 'ol:12547191' };
const dune = { workId: 'OL893415W', coverId: 'gb:abc_D-1' };

describe('board in the address', () => {
  it('round-trips through the query string', () => {
    let b = place(emptyBoard(), 0, gatsby);
    b = place(b, 4, dune);
    b = { ...b, by: 'Julian' };
    const q = boardQuery(b);
    expect(q).toBe('w=OL468431W,,,,OL893415W,,,,&c=ol-12547191,,,,gb-abc_D-1,,,,&by=Julian');
    expect(parseBoard(new URLSearchParams(q))).toEqual(b);
  });

  it('is empty for an empty board', () => {
    expect(boardQuery(emptyBoard())).toBe('');
    expect(parseBoard(new URLSearchParams(''))).toEqual(emptyBoard());
  });

  it('stays short enough to paste: nine Google ids and a long name under 500 characters', () => {
    let b = emptyBoard();
    for (let i = 0; i < SLOTS; i++) b = place(b, i, { workId: `OL${1234567890 + i}W`, coverId: 'gb:AbCdEfGhIjKl' });
    b = { ...b, by: 'x'.repeat(NAME_MAX) };
    expect(boardQuery(b).length).toBeLessThan(500);
  });

  it('drops what does not parse, slot by slot', () => {
    const b = parseBoard(new URLSearchParams('w=OL1W,nope,OL3W,OL4W&c=ol-1,ol-2,http://x,ol-4'));
    expect(b.slots.map(s => s?.workId ?? null)).toEqual(['OL1W', null, null, 'OL4W', null, null, null, null, null]);
    expect(b.slots).toHaveLength(SLOTS);
  });

  it('ignores slots past nine', () => {
    const many = Array.from({ length: 12 }, (_, i) => `OL${i + 1}W`).join(',');
    const covers = Array.from({ length: 12 }, (_, i) => `ol-${i + 1}`).join(',');
    expect(filledCount(parseBoard(new URLSearchParams(`w=${many}&c=${covers}`)))).toBe(9);
  });
});

describe('cleanName', () => {
  it('makes one printable line of at most NAME_MAX characters', () => {
    expect(cleanName('  Ju\nlian\u0007  ')).toBe('Ju lian');
    expect([...cleanName('é'.repeat(60))]).toHaveLength(NAME_MAX);
  });
});

describe('editing', () => {
  it('moves a work that is placed twice instead of showing it twice', () => {
    let b = place(emptyBoard(), 0, gatsby);
    b = place(b, 5, { ...gatsby, coverId: 'ol:999' });
    expect(b.slots[0]).toBeNull();
    expect(b.slots[5]).toEqual({ workId: gatsby.workId, coverId: 'ol:999' });
  });

  it('fills, removes, swaps and changes the edition', () => {
    let b = place(emptyBoard(), 0, gatsby);
    expect(firstEmpty(b)).toBe(1);
    b = swap(b, 0, 8);
    expect(b.slots[8]).toEqual(gatsby);
    b = setCover(b, 8, 'ol:42');
    expect(b.slots[8]?.coverId).toBe('ol:42');
    expect(setCover(b, 3, 'ol:1')).toBe(b);
    b = remove(b, 8);
    expect(filledCount(b)).toBe(0);
    expect(firstEmpty(place(b, 0, gatsby))).toBe(1);
  });
});

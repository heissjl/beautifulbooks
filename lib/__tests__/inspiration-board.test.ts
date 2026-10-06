import { describe, expect, it } from 'vitest';
import {
  boardQuery, cleanName, decodeSlot, emptyBoard, encodeSlot, filledCount, firstEmpty, NAME_MAX, parseBoard, place, remove, resize, setCover,
  SIZE_WORD, sizeOf, SLOTS, swap,
} from '../inspiration/board';

const gatsby = { workId: 'OL468431W', coverId: 'ol:12547191' };
const dune = { workId: 'OL893415W', coverId: 'gb:abc_D-1' };

describe('board in the address', () => {
  it('encodes a slot in base 36 and reads it back', () => {
    expect(encodeSlot(gatsby)).toBe('a1fz.7gxh3');
    expect(decodeSlot('a1fz.7gxh3')).toEqual(gatsby);
    expect(encodeSlot(dune)).toBe('j5d3.gabc_D-1');
    expect(decodeSlot('j5d3.gabc_D-1')).toEqual(dune);
  });

  it('round-trips through the query string', () => {
    let b = place(emptyBoard(), 0, gatsby);
    b = place(b, 4, dune);
    b = { ...b, by: 'Julian' };
    const q = boardQuery(b);
    expect(q).toBe('b=a1fz.7gxh3~~~~j5d3.gabc_D-1~~~~&by=Julian');
    expect(parseBoard(new URLSearchParams(q))).toEqual(b);
  });

  it('is empty for an empty board', () => {
    expect(boardQuery(emptyBoard())).toBe('');
    expect(parseBoard(new URLSearchParams(''))).toEqual(emptyBoard());
  });

  it('is short: nine real books and a name in under 150 characters', () => {
    const works = ['OL468431W', 'OL1168083W', 'OL893415W', 'OL45804W', 'OL27258W', 'OL15358691W', 'OL82563W', 'OL20600W', 'OL3140822W'];
    let b = emptyBoard();
    works.forEach((w, i) => { b = place(b, i, { workId: w, coverId: `ol:${12547191 + i * 1000}` }); });
    b = { ...b, by: 'Julian' };
    expect(`https://buyitscovers.com/shelfportrait?${boardQuery(b)}`.length).toBeLessThan(150);
    // Nine Google ids and the longest name still paste.
    let g = emptyBoard();
    for (let i = 0; i < SLOTS; i++) g = place(g, i, { workId: `OL${1234567890 + i}W`, coverId: 'gb:AbCdEfGhIjKl' });
    g = { ...g, by: 'x'.repeat(NAME_MAX) };
    expect(boardQuery(g).length).toBeLessThan(300);
  });

  it('drops what does not parse, slot by slot', () => {
    const b = parseBoard(new URLSearchParams('b=1.1~nope~3.http://x~4.4'));
    expect(b.slots.map(s => s?.workId ?? null)).toEqual(['OL1W', null, null, 'OL4W', null, null, null, null, null]);
    expect(b.slots).toHaveLength(SLOTS);
  });

  it('ignores slots past nine and refuses ids that are not ids', () => {
    const codes = Array.from({ length: 12 }, (_, i) => `${(i + 1).toString(36)}.${(i + 1).toString(36)}`).join('~');
    expect(filledCount(parseBoard(new URLSearchParams(`b=${codes}`)))).toBe(9);
    expect(place(emptyBoard(), 0, { workId: 'nope', coverId: 'ol:1' })).toEqual(emptyBoard());
    expect(place(emptyBoard(), 0, { workId: 'OL1W', coverId: 'https://x' })).toEqual(emptyBoard());
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

describe('the board of six', () => {
  const six = () => place(place(emptyBoard(6), 0, gatsby), 5, dune);

  it('says its size in the address, and nine stays unsaid', () => {
    expect(boardQuery(six())).toBe('b=a1fz.7gxh3~~~~~j5d3.gabc_D-1&n=6');
    expect(boardQuery(place(emptyBoard(), 0, gatsby))).not.toContain('n=');
    expect(boardQuery(emptyBoard(6))).toBe('n=6');
  });

  it('reads back with six places', () => {
    const b = parseBoard(new URLSearchParams(boardQuery({ ...six(), by: 'Julian' })));
    expect(b.slots).toHaveLength(6);
    expect(sizeOf(b)).toBe(6);
    expect(b.slots[5]).toEqual(dune);
    expect(b.by).toBe('Julian');
  });

  it('takes any other n for nine, and ignores places past the sixth', () => {
    expect(parseBoard(new URLSearchParams('b=a1fz.7gxh3&n=7')).slots).toHaveLength(9);
    const crowded = parseBoard(new URLSearchParams('b=a1fz.7gxh3~~~~~~~~j5d3.gabc_D-1&n=6'));
    expect(crowded.slots).toHaveLength(6);
    expect(filledCount(crowded)).toBe(1);
  });

  it('keeps its bounds when a book is placed or moved', () => {
    expect(place(six(), 6, dune)).toEqual(six());
    expect(swap(six(), 0, 8)).toEqual(six());
    expect(swap(six(), 0, 5).slots[0]).toEqual(dune);
  });

  const book = (n: number) => ({ workId: `OL${n}W`, coverId: `ol:${n}` });

  it('keeps the places when the books fit the smaller board', () => {
    let nine = emptyBoard();
    [0, 3, 5].forEach((i, n) => { nine = place(nine, i, book(n + 1)); });
    const small = resize(nine, 6);
    expect(small.board.slots).toEqual([book(1), null, null, book(2), null, book(3)]);
    expect(small.spare).toEqual([]);
    expect(SIZE_WORD[sizeOf(small.board)]).toBe('Six');
  });

  it('sets books aside instead of dropping them, and brings them back', () => {
    let nine = emptyBoard();
    for (let i = 0; i < 9; i++) nine = place(nine, i, book(i + 1));
    const three = resize(nine, 3);
    expect(three.board.slots).toEqual([book(1), book(2), book(3)]);
    expect(three.spare).toHaveLength(6);
    const back = resize(three.board, 9, three.spare);
    expect(back.board).toEqual(nine);
    expect(back.spare).toEqual([]);
  });

  it('closes the gaps when a book sits beyond the smaller board', () => {
    let nine = emptyBoard();
    [0, 7].forEach((i, n) => { nine = place(nine, i, book(n + 1)); });
    const three = resize(nine, 3);
    expect(three.board.slots).toEqual([book(1), book(2), null]);
    expect(three.spare).toEqual([]);
  });

  it('does not bring back a book that was added again meanwhile', () => {
    let nine = emptyBoard();
    for (let i = 0; i < 4; i++) nine = place(nine, i, book(i + 1));
    const three = resize(nine, 3);
    const swapped = place(remove(three.board, 0), 0, book(4));
    const six = resize(swapped, 6, three.spare);
    expect(six.board.slots.filter(Boolean)).toEqual([book(4), book(2), book(3)]);
    expect(six.spare).toEqual([]);
  });
});

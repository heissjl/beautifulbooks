import { describe, expect, it } from 'vitest';
import { placeBooks, scanPartial, type RecognizedBook } from '../recognize';

const spine = (x: number, row = 0, extra: Partial<RecognizedBook> = {}): RecognizedBook => ({ title: `T${x}`, author: '', kind: 'spine', row, x, ...extra });

describe('placeBooks (5.11a): strips in a row instead of boxes', () => {
  it('puts the boundary between neighbours halfway between their centres', () => {
    const [a, b, c] = placeBooks([spine(0.1), spine(0.2), spine(0.4)], [[0.3, 0.7]]);
    expect(a.box).toEqual([expect.closeTo(0.05), 0.3, expect.closeTo(0.1), expect.closeTo(0.4)]);
    expect(b.box).toEqual([expect.closeTo(0.15), 0.3, expect.closeTo(0.1), expect.closeTo(0.4)]);
    // The last one takes the same half-width to its right as to its left.
    expect(c.box).toEqual([expect.closeTo(0.3), 0.3, expect.closeTo(0.2), expect.closeTo(0.4)]);
  });

  it('finds neighbours by centre, not by the order the model listed them in', () => {
    const [a, b, c] = placeBooks([spine(0.5), spine(0.2), spine(0.6)], [[0, 0.5]]);
    // 0.2 | 0.5 | 0.6: the one listed first sits between the other two.
    expect(a.box).toEqual([expect.closeTo(0.45), 0, expect.closeTo(0.1), 0.5]);
    expect(b.box).toEqual([expect.closeTo(0.05), 0, expect.closeTo(0.3), 0.5]);
    expect(c.box).toEqual([expect.closeTo(0.55), 0, expect.closeTo(0.1), 0.5]);
  });

  it('shares a row out evenly in reading order when a centre is missing', () => {
    const placed = placeBooks([spine(0.5), spine(0.2, 0, { x: undefined }), spine(0.9), spine(0.6)], [[0, 0.5]]);
    expect(placed.map((b) => b.box?.[0])).toEqual([0, 0.25, 0.5, 0.75]);
    expect(placed.every((b) => b.box?.[2] === 0.25 && b.box?.[3] === 0.5)).toBe(true);
  });

  it('keeps rows apart, widens a cover, and gives a book without a listed row no box', () => {
    const placed = placeBooks(
      [spine(0.5, 0), spine(0.5, 1, { kind: 'cover' }), spine(0.5, 2), spine(0.5, 0, { row: undefined })],
      [[0.1, 0.4], [0.5, 0.9]],
    );
    // Alone in its row: the smallest strip either side of the centre.
    expect(placed[0].box).toEqual([expect.closeTo(0.48), 0.1, expect.closeTo(0.04), expect.closeTo(0.3)]);
    expect(placed[1].box).toEqual([expect.closeTo(0.45), 0.5, expect.closeTo(0.1), expect.closeTo(0.4)]);
    expect(placed[2].box).toBeUndefined();
    expect(placed[3].box).toBeUndefined();
  });

  it('treats the whole picture as one row when the model listed none', () => {
    const [a] = placeBooks([spine(0.5)], []);
    expect(a.box).toEqual([expect.closeTo(0.48), 0, expect.closeTo(0.04), 1]);
  });

  it('clamps a strip to the picture', () => {
    const [a] = placeBooks([spine(0.005), spine(0.5)], [[0, 1]]);
    expect(a.box?.[0]).toBe(0);
  });
});

describe('scanPartial (5.11a): books from an answer still arriving', () => {
  const answer = '{"rows": [[10, 40], [50, 90]], "books": [{"t": "Dune", "a": "Frank Herbert", "k": "spine", "r": 1, "x": 10}, {"t": "Beloved {with} \\"braces\\"", "a": "Toni Morrison", "k": "cover", "r": 2, "x": 70}]}';

  it('finds nothing before the list of books has begun', () => {
    expect(scanPartial('{"rows": [[10, 40]], "bo')).toEqual({ rows: [], books: [] });
  });

  it('hands out each book the moment its object has closed, with the rows', () => {
    const upToFirst = answer.indexOf('}') + 1;
    const one = scanPartial(answer.slice(0, upToFirst));
    expect(one.rows).toEqual([[0.1, 0.4], [0.5, 0.9]]);
    expect(one.books).toEqual([{ title: 'Dune', author: 'Frank Herbert', kind: 'spine', row: 0, x: 0.1 }]);
    // Half of the second object: still one book.
    expect(scanPartial(answer.slice(0, upToFirst + 30)).books).toHaveLength(1);
  });

  it('is not fooled by braces or quotes inside a title', () => {
    const all = scanPartial(answer);
    expect(all.books.map((b) => b.title)).toEqual(['Dune', 'Beloved {with} "braces"']);
    expect(all.books[1]).toMatchObject({ kind: 'cover', row: 1, x: 0.7 });
  });

  it('stops at the end of the list', () => {
    expect(scanPartial(answer + '{"t": "After the list"}').books).toHaveLength(2);
  });
});

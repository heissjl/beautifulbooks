import { describe, expect, it } from 'vitest';
import type { RecognizedBook } from '../recognize';
import { inWhole, mergeReads, piecesOf, sameBook } from '../walls/dense';

const book = (title: string, author = '', x?: number, y?: number): RecognizedBook => ({ title, author, kind: 'spine', ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) });

describe('a closer second look at a dense photo (5.11a)', () => {
  it('cuts every shelf on its own, in overlapping parts side by side', () => {
    const pieces = piecesOf(1500, 2000, [[0, 0.44], [0.44, 0.69], [0.69, 1]]);
    expect(pieces).toHaveLength(6);
    expect(pieces[0]).toEqual([0, 0, 0.6, expect.closeTo(0.452)]);
    expect(pieces[3]).toEqual([0.4, expect.closeTo(0.428), 1, expect.closeTo(0.702)]);
  });

  it('gives a shelf that is very wide for its height three parts, and a photo without shelves one row', () => {
    expect(piecesOf(2000, 1500, [[0.1, 0.4], [0.4, 0.9]]).filter((p) => p[1] < 0.3).map((p) => [p[0], p[2]])).toEqual([[0, 0.4], [0.3, 0.7], [0.6, 1]]);
    expect(piecesOf(1500, 2000)).toEqual([[0, 0, 0.6, 1], [0.4, 0, 1, 1]]);
  });

  it('puts a point read in a piece where it lies in the whole picture', () => {
    expect(inWhole(book('Dune', '', 0.5, 0.5), [0.4, 0.25, 1, 0.75])).toMatchObject({ x: 0.7, y: 0.5 });
    expect(inWhole(book('Dune', '', 0.4, 0.2), [0, 0.5, 1, 1])).toMatchObject({ x: 0.4, y: 0.6 });
    expect(inWhole(book('Dune'), [0, 0.5, 1, 1])).toEqual(book('Dune'));
  });

  it('knows one book read twice, and keeps neighbours apart', () => {
    expect(sameBook(book('Crossing Over', 'John Stezaker'), book('JOHN STEZAKER: Crossing over'))).toBe(true);
    expect(sameBook(book('Giuseppe Penone'), book('Matrice', 'Giuseppe Penone'))).toBe(true);
    // A letter misread, a space lost.
    expect(sameBook(book('Maki Na Kamura'), book('Makina Kamura'))).toBe(true);
    expect(sameBook(book('Nicolas Party: Rocine'), book('Nicolas Party: Rottine'))).toBe(true);
    expect(sameBook(book('Tal R'), book('TALR'))).toBe(true); // the same letters, a space lost
    expect(sameBook(book('Tal R'), book('Tal B'))).toBe(false); // four letters: too short to call a misreading
    expect(sameBook(book('Jazz'), book('Jaws'))).toBe(false);
    // One word inside a longer title: two books side by side on Julian's wall.
    expect(sameBook(book('Picasso'), book('Picasso and Françoise Gilot'))).toBe(false);
    // Where they lie is not asked: one spine read in two pieces came back half a picture apart.
    expect(sameBook(book('Ruscha', '', 0.1, 0.2), book('Ruscha', '', 0.8, 0.9))).toBe(true);
  });

  it('merges: each book once, the fuller reading kept, what only the first read saw at the end', () => {
    const first = [book('Ron Mueck', '', 0.2, 0.3), book('Paula Rego', '', 0.7, 0.6), book('Sites Unseen', 'Trevor Paglen', 0.5, 0.3)];
    const pieces = [book('Sites Unseen', '', 0.52, 0.28), book('The Art of Story', 'Paula Rego', 0.72, 0.58), book('The Art of Story', 'Paula Rego', 0.71, 0.6), book('Pearl Lines', 'Walter Price', 0.4, 0.6)];
    const out = mergeReads(first, pieces);
    expect(out.map((b) => `${b.title} — ${b.author}`)).toEqual([
      'Sites Unseen — Trevor Paglen',
      'The Art of Story — Paula Rego',
      'Pearl Lines — Walter Price',
      'Ron Mueck — ',
    ]);
    // The first read knew the author, the piece knew where: both are kept.
    expect(out[0]).toMatchObject({ x: 0.52, y: 0.28 });
    expect(out[1]).toMatchObject({ x: 0.72, y: 0.58 });
  });
});

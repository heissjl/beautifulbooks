import { describe, expect, it } from 'vitest';
import {
  formatLength,
  layoutPiece,
  parseLibraryHeight,
  parseOlDimensions,
  pieceRange,
  sizeFromFormat,
  widthFromScan,
} from '../walls/dimensions';

describe('book sizes (5.13i)', () => {
  it('reads Open Library dimensions in any axis order and unit', () => {
    expect(parseOlDimensions('20 x 13 x 2 centimeters')).toEqual({ h: 20, w: 13, t: 2 });
    expect(parseOlDimensions('8.2 x 5.5 x 1 inches')).toEqual({ h: 20.8, w: 14, t: 2.5 });
    expect(parseOlDimensions('21 x 3 x 14 centimeters')).toEqual({ h: 21, w: 14, t: 3 });
    // Bloomsbury's millimetres labelled as centimetres (measured in the research).
    expect(parseOlDimensions('198 x 129 x centimeters')).toEqual({ h: 19.8, w: 12.9 });
    expect(parseOlDimensions('big')).toBeNull();
    expect(parseOlDimensions('200 x 150 x 3 inches')).toBeNull();
  });

  it('reads the height a library gives, with a width when there is one', () => {
    expect(parseLibraryHeight('18 cm')).toEqual({ h: 18 });
    expect(parseLibraryHeight('21 x 14 cm')).toEqual({ h: 21, w: 14 });
    expect(parseLibraryHeight('ill. ; 24 cm.')).toEqual({ h: 24 });
    expect(parseLibraryHeight('couv. ill.')).toBeNull();
  });

  it('takes the width from a single cover scan and refuses spreads and crops', () => {
    expect(widthFromScan(18, 422, 630)).toBe(12.1);
    expect(widthFromScan(18, 1000, 1000)).toBeNull();
    expect(widthFromScan(18, undefined, 600)).toBeNull();
  });

  it('knows the typical formats', () => {
    expect(sizeFromFormat('Mass Market Paperback')).toEqual({ w: 10.8, h: 17.5 });
    expect(sizeFromFormat('Hardcover')).toEqual({ w: 16, h: 24 });
    expect(sizeFromFormat('Paperback')).toEqual({ w: 13, h: 20 });
    expect(sizeFromFormat(undefined)).toBeNull();
  });
});

describe('the piece (5.13i)', () => {
  it('puts the books of a row on one bottom line, the row as tall as its tallest book', () => {
    const p = layoutPiece([{ w: 13, h: 20 }, { w: 16, h: 24 }, { w: 11, h: 18 }], 3);
    // 8 + 13 + 5 + 16 + 5 + 11 + 8 = 66 wide; 8 + 24 + 8 = 40 high.
    expect([p.widthCm, p.heightCm]).toEqual([66, 40]);
    expect(p.books.map((b) => b.y + b.h)).toEqual([32, 32, 32]);
  });

  it('gives six trade paperbacks in three columns the size the fixed plan had', () => {
    const six = Array.from({ length: 6 }, () => ({ w: 13, h: 20 }));
    expect(layoutPiece(six, 3)).toMatchObject({ widthCm: 65, heightCm: 63, rows: 2 });
  });

  it('is a range while any book is estimated, and exact when none is', () => {
    const known = { w: 13, h: 20, source: 'library' as const };
    expect(pieceRange([known, known], 2)).toEqual({ min: { w: 47, h: 36 }, max: { w: 47, h: 36 }, estimated: 0 });
    const r = pieceRange([known, { w: 13, h: 20, source: 'assumed' }], 2);
    expect(r.estimated).toBe(1);
    expect(r.min.w).toBeLessThan(r.max.w);
  });

  it('writes lengths in centimetres or in quarter inches', () => {
    expect(formatLength(65.4, 'metric')).toBe('65');
    expect(formatLength(65, 'imperial')).toBe('25½');
    expect(formatLength(7, 'imperial')).toBe('2¾');
    expect(formatLength(0.3, 'imperial')).toBe('0');
  });
});

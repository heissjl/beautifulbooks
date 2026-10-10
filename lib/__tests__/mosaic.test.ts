import { describe, expect, it } from 'vitest';
import { coverShaped, coversFirst, looksLikeNonCover, type MosaicMeasure } from '../mosaic';

// A cover with a design: dark, busy, book-shaped.
const cover: MosaicMeasure = { width: 300, height: 450, signature: { hash: 'a5a5a5a5a5a5a5a5', contrast: 60, mean: 120 } };
// A spine: tall and thin.
const spine: MosaicMeasure = { width: 60, height: 450, signature: { hash: 'a5a5a5a5a5a5a5a5', contrast: 60, mean: 120 } };
// A blank endpaper: book-shaped but white and flat.
const blank: MosaicMeasure = { width: 300, height: 450, signature: { hash: '0000000000000000', contrast: 5, mean: 250 } };
// An open spread: wider than tall.
const spread: MosaicMeasure = { width: 900, height: 450, signature: { hash: 'a5a5a5a5a5a5a5a5', contrast: 60, mean: 120 } };

describe('coverShaped (6.70)', () => {
  it('takes the game’s shape, 0.5 to 0.85 wide over high', () => {
    expect(coverShaped(300, 450)).toBe(true);
    expect(coverShaped(60, 450)).toBe(false);
    expect(coverShaped(900, 450)).toBe(false);
    expect(coverShaped(0, 450)).toBe(false);
  });
});

describe('looksLikeNonCover', () => {
  it('flags a spine, a spread and a blank page, not a cover', () => {
    expect(looksLikeNonCover(cover)).toBe(false);
    expect(looksLikeNonCover(spine)).toBe(true);
    expect(looksLikeNonCover(spread)).toBe(true);
    expect(looksLikeNonCover(blank)).toBe(true);
  });

  it('lets an unmeasured image pass: nothing shows it is not a cover', () => {
    expect(looksLikeNonCover(null)).toBe(false);
    expect(looksLikeNonCover(undefined)).toBe(false);
  });
});

describe('coversFirst', () => {
  it('sorts what looks like a non-cover to the end and drops nothing', () => {
    const items = [
      { url: 'spine', m: spine },
      { url: 'a', m: cover },
      { url: 'blank', m: blank },
      { url: 'b', m: cover },
      { url: 'unknown', m: null },
    ];
    expect(coversFirst(items, i => i.m).map(i => i.url)).toEqual(['a', 'b', 'unknown', 'spine', 'blank']);
  });
});

import { describe, expect, it } from 'vitest';
import { pickDistinct } from '../dhash';
import { fitsMosaicTile, MOSAIC_MAX_ASPECT, MOSAIC_MIN_ASPECT } from '../imagesig';

const COVER = { hash: 'a5c3e1f0b4d29687', contrast: 55, mean: 120 };
// A blurb scan: pale, flat, little structure (the wall's own rule, looksLikeScannedPage).
const PAGE = { hash: '0000000000000f00', contrast: 9, mean: 250 };

describe('fitsMosaicTile (ROADMAP 6.70)', () => {
  it('keeps an ordinary upright cover', () => {
    expect(fitsMosaicTile(333, 500, COVER)).toBe(true);
    // Near-square covers were real covers on the contact sheet; they stay.
    expect(fitsMosaicTile(450, 500, COVER)).toBe(true);
  });

  it('puts a spine and a landscape image last', () => {
    expect(fitsMosaicTile(55, 500, COVER)).toBe(false);
    expect(fitsMosaicTile(750, 500, COVER)).toBe(false);
    expect(fitsMosaicTile(Math.round(500 * MOSAIC_MAX_ASPECT) + 2, 500, COVER)).toBe(false);
    expect(fitsMosaicTile(Math.round(500 * MOSAIC_MIN_ASPECT) - 2, 500, COVER)).toBe(false);
  });

  it('puts a pale blank page last', () => {
    expect(fitsMosaicTile(333, 500, PAGE)).toBe(false);
  });

  it('keeps an image it could not measure', () => {
    expect(fitsMosaicTile(0, 0, undefined)).toBe(true);
  });
});

describe('the mosaic order with misfits last', () => {
  it('uses a misfit only when nothing else is left', () => {
    const items = [
      { url: 'spine', hash: null, fits: false },
      { url: 'a', hash: null, fits: true },
      { url: 'b', hash: null, fits: true },
    ];
    const order = [...items.filter(i => i.fits), ...items.filter(i => !i.fits)];
    expect(pickDistinct(order, 2, 8)).toEqual(['a', 'b']);
    expect(pickDistinct(order, 4, 8)).toEqual(['a', 'b', 'spine']);
  });
});

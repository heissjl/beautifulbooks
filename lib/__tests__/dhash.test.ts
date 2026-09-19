/**
 * The browser-safe hash and the repeat filter of a card (ROADMAP 6.34).
 */
import { describe, expect, it } from 'vitest';
import { dhashFromRgba, pickDistinct } from '../dhash';
import { dhash, toGray } from '../imagehash';

/** A width x height RGBA image whose brightness runs left to right. */
function gradient(width: number, height: number, rising: boolean): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = Math.round(((rising ? x : width - 1 - x) / (width - 1)) * 255);
    rgba.set([v, v, v, 255], (y * width + x) * 4);
  }
  return rgba;
}

describe('dhashFromRgba', () => {
  it('reads a brightening row as no left pixel brighter, and a darkening one as every bit set', () => {
    expect(dhashFromRgba(90, 80, gradient(90, 80, true))).toBe('0000000000000000');
    expect(dhashFromRgba(90, 80, gradient(90, 80, false))).toBe('ffffffffffffffff');
  });

  it('is the server hash, bit for bit', () => {
    const rgba = gradient(120, 180, false);
    expect(dhashFromRgba(120, 180, rgba)).toBe(dhash(toGray({ width: 120, height: 180, rgba })));
  });
});

describe('pickDistinct', () => {
  const A = '0000000000000000';
  const A_NEAR = '0000000000000003'; // 2 bits from A
  const B = 'ffffffffffffffff';

  it('skips a repeat of a cover already kept and takes the next one', () => {
    expect(pickDistinct([{ url: 'a', hash: A }, { url: 'a2', hash: A_NEAR }, { url: 'b', hash: B }], 4, 8)).toEqual(['a', 'b']);
  });

  it('keeps a cover whose image could not be read', () => {
    expect(pickDistinct([{ url: 'a', hash: A }, { url: 'x', hash: null }, { url: 'y', hash: null }], 4, 8)).toEqual(['a', 'x', 'y']);
  });

  it('stops at the limit', () => {
    expect(pickDistinct([{ url: 'a', hash: A }, { url: 'b', hash: B }, { url: 'c', hash: null }], 2, 8)).toEqual(['a', 'b']);
  });
});

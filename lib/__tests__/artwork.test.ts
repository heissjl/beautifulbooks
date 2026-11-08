import { describe, expect, it } from 'vitest';
import { ARTWORK_HEIGHT as H, ARTWORK_WIDTH as W, artworkScore, distinctArtwork, SAME_ARTWORK } from '../artwork';

// A repeatable picture: smooth shapes that differ with the seed.
function picture(seed: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    out.push(127 + 120 * Math.sin((x + seed) * (0.3 + seed * 0.11)) * Math.cos(y * (0.2 + seed * 0.07)));
    out.push(127 + 120 * Math.cos((x * y) / (9 + seed)));
    out.push(127 + 120 * Math.sin(y * (0.5 + seed * 0.05) + seed));
  }
  return out;
}
const plain = (v: number) => new Array(W * H * 3).fill(v);

describe('artworkScore (Julian, 2026-11-08)', () => {
  it('finds one picture under another title band', () => {
    const translated = picture(1);
    for (let i = 0; i < W * 9 * 3; i++) translated[i] = i % 7 === 0 ? 250 : 12;
    expect(artworkScore(picture(1), translated)).toBeGreaterThanOrEqual(SAME_ARTWORK);
  });
  it('finds one picture moved by a scan’s margin', () => {
    const a = picture(2);
    const moved = new Array(a.length).fill(255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) for (let k = 0; k < 3; k++) moved[(y * W + x + 1) * 3 + k] = a[(y * W + x) * 3 + k];
    expect(artworkScore(a, moved)).toBeGreaterThanOrEqual(SAME_ARTWORK);
  });
  it('tells different pictures apart, and a plain binding matches nothing', () => {
    expect(artworkScore(picture(1), picture(5))).toBeLessThan(SAME_ARTWORK);
    expect(artworkScore(plain(40), plain(200))).toBeLessThan(SAME_ARTWORK);
    expect(artworkScore(plain(40), picture(1))).toBeLessThan(SAME_ARTWORK);
  });
});

describe('distinctArtwork', () => {
  it('keeps the first of a picture, the order, and what has no raster', () => {
    const items = [{ n: 'a', r: picture(1) }, { n: 'x' }, { n: 'b', r: picture(5) }, { n: 'a again', r: picture(1) }, { n: 'y' }];
    expect(distinctArtwork<{ n: string; r?: number[] }>(items, i => i.r).map(i => i.n)).toEqual(['a', 'x', 'b', 'y']);
  });
});

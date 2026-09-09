import { describe, expect, it } from 'vitest';
import { quantiseLuminance, revealOrder, rng, shuffledSources, toBase64 } from '../orders';

/** A 4x3 grid: dark on the left, bright on the right, mid in between. */
const lum = new Uint8Array([
  10, 120, 130, 250,
  20, 118, 132, 240,
  30, 122, 128, 230,
]);

describe('revealOrder', () => {
  it('fills the cells furthest from the average first', () => {
    const order = revealOrder('extreme', lum, 4, 3);
    const first = [...order.slice(0, 6)].map(i => lum[i]);
    // The six extremes are the dark column and the bright one, in some order.
    expect(first.every(v => v < 40 || v > 220)).toBe(true);
    const last = [...order.slice(-6)].map(i => lum[i]);
    expect(last.every(v => v > 100 && v < 140)).toBe(true);
  });

  it('fills darkest first when asked to', () => {
    const order = revealOrder('dark', lum, 4, 3);
    const values = [...order].map(i => lum[i]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('is a permutation, whatever the kind', () => {
    for (const kind of ['extreme', 'dark', 'raster', 'wave', 'random'] as const) {
      const order = revealOrder(kind, lum, 4, 3);
      expect([...order].sort((a, b) => a - b)).toEqual([...Array(12).keys()]);
    }
  });

  it('sweeps diagonally, so a wave never runs backwards', () => {
    const order = revealOrder('wave', lum, 4, 3);
    const diagonal = [...order].map(i => (i % 4) + Math.floor(i / 4));
    expect(diagonal).toEqual([...diagonal].sort((a, b) => a - b));
  });

  it('repeats exactly with the same seed and differs with another', () => {
    expect([...revealOrder('random', lum, 4, 3, 7)]).toEqual([...revealOrder('random', lum, 4, 3, 7)]);
    expect([...revealOrder('random', lum, 4, 3, 7)]).not.toEqual([...revealOrder('random', lum, 4, 3, 8)]);
  });

  it('refuses a grid it was not measured for', () => {
    expect(() => revealOrder('extreme', lum, 5, 3)).toThrow(/12 cells/);
  });
});

describe('shuffledSources', () => {
  it('gives every cell exactly one source, so no cell stays empty', () => {
    const sources = shuffledSources(500, 3);
    expect(new Set(sources).size).toBe(500);
  });

  it('moves nearly everything: a wall that barely changes shows nothing', () => {
    const sources = shuffledSources(500, 3);
    const fixed = [...sources].filter((s, i) => s === i).length;
    expect(fixed).toBeLessThan(5);
  });
});

describe('packing', () => {
  it('quantises luminance into a byte and clamps what does not fit', () => {
    expect([...quantiseLuminance([-4, 0.4, 127.6, 255, 300])]).toEqual([0, 0, 128, 255, 255]);
  });

  it('round-trips through base64', () => {
    const data = revealOrder('extreme', lum, 4, 3);
    const bytes = Uint8Array.from(atob(toBase64(data)), c => c.charCodeAt(0));
    expect([...new Uint16Array(bytes.buffer)]).toEqual([...data]);
  });
});

describe('rng', () => {
  it('stays inside [0, 1)', () => {
    const random = rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

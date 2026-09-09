import { describe, expect, it } from 'vitest';
import { frameHeight, pickImage, pickTemplate, revealOrder, rng, shuffledSources, unpackBytes } from '../loading';

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

describe('unpackBytes', () => {
  it('reads back what a manifest carries', () => {
    expect([...unpackBytes(btoa('\u0000\u0001\u00ff'))]).toEqual([0, 1, 255]);
  });
});

describe('pickImage', () => {
  const images = [480, 640].map(width => ({
    file: `x-${width}.jpg`, width, height: width, cellWidth: 12, cellHeight: 18, bytes: width * 200,
  }));

  it('takes the small file for a phone frame, even at two device pixels', () => {
    // 260 x 2 x 0.8 = 416, and 480 covers that. Without the tolerance this
    // would ask for 520 and pay 60 % more for pixels nobody can point at.
    expect(pickImage(images, 260, 2).width).toBe(480);
  });

  it('takes the large file for a desktop frame', () => {
    expect(pickImage(images, 420, 2).width).toBe(640);
  });

  it('never asks for more than two device pixels', () => {
    expect(pickImage(images, 260, 3).width).toBe(480);
  });

  it('falls back to the largest when nothing is big enough', () => {
    expect(pickImage(images, 900, 2).width).toBe(640);
  });
});

describe('frameHeight', () => {
  it('gets the shape from the grid alone, before any picture is loaded', () => {
    // 40 cells across, 36 down, each 2:3 -> 4:3 tall.
    expect(frameHeight(40, 36, 260)).toBe(351);
  });
});

describe('pickTemplate', () => {
  const rotation = [{ id: 'a', author: 'A' }, { id: 'b', author: 'B' }, { id: 'c', author: 'C' }];

  it('picks by the number it is given', () => {
    expect(pickTemplate(rotation, () => 0)?.id).toBe('a');
    expect(pickTemplate(rotation, () => 0.99)?.id).toBe('c');
  });

  it('has nothing to pick from an empty rotation', () => {
    expect(pickTemplate([], () => 0)).toBeUndefined();
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

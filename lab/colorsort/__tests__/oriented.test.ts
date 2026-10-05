import { describe, expect, it } from 'vitest';
import { fromAxis, orientedColor, refineOriented, tilt, type OrientedBox } from '../oriented';
import { rgbToOklab, distance } from '../color';
import { toLabImage } from '../spines';
import { orientedScene } from '../synthetic';

/** Where the painted book's centre line is, measured across the guess's direction. */
function error(truth: OrientedBox, got: OrientedBox) {
  const nx = -Math.sin(truth.angle), ny = Math.cos(truth.angle);
  return { across: Math.abs((got.cx - truth.cx) * nx + (got.cy - truth.cy) * ny), thickness: Math.abs(got.thickness - truth.thickness) };
}

describe('books standing, leaning and lying', () => {
  for (const seed of [3, 11, 29]) {
    const scene = orientedScene(seed);
    const img = toLabImage(scene.rgba, scene.width, scene.height);

    it(`moves a model-like guess back onto the book (scene ${seed})`, () => {
      let good = 0;
      scene.books.forEach((b, i) => {
        // As a model guesses: a quarter of the thickness to one side, 2.5° off, 20 % too thick or thin.
        const side = i % 2 ? 1 : -1;
        const nx = -Math.sin(b.angle), ny = Math.cos(b.angle);
        const guess: OrientedBox = {
          cx: b.cx + nx * side * b.thickness * 0.25, cy: b.cy + ny * side * b.thickness * 0.25,
          angle: b.angle + side * (2.5 * Math.PI) / 180, length: b.length, thickness: b.thickness * (i % 3 === 0 ? 1.2 : 0.8),
        };
        const e = error(b, refineOriented(img, guess).box);
        if (e.across <= 2 && e.thickness <= 3) good++;
      });
      expect(good / scene.books.length).toBeGreaterThanOrEqual(0.85);
    });

    it(`reads each book's own colour, not its neighbour's (scene ${seed})`, () => {
      scene.books.forEach(b => {
        const c = orientedColor(scene.rgba, scene.width, scene.height, b);
        expect(distance(c.lab, rgbToOklab(...b.color))).toBeLessThan(0.05);
      });
    });
  }

  it('says how far a book is from upright', () => {
    expect(tilt(fromAxis(10, 100, 10, 0, 20))).toBeCloseTo(0);
    expect(tilt(fromAxis(0, 50, 100, 50, 20))).toBeCloseTo(90);
    expect(tilt(fromAxis(0, 100, 20, 0, 20))).toBeCloseTo(11.3, 1);
  });
});

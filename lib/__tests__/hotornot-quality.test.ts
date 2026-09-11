import { describe, expect, it } from 'vitest';
import { measureCover } from '../hotornot/quality';

type Rgb = [number, number, number];

function image(width: number, height: number, colour: (x: number, y: number) => Rgb) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colour(x, y);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { width, height, rgba };
}

const PAPER: Rgb = [245, 243, 238];
const RECLAM: Rgb = [250, 215, 0];
const BLUE: Rgb = [30, 60, 160];
const INK: Rgb = [20, 20, 20];

describe('measuring a cover on its large image', () => {
  it('reads a blank page as paper through and through, and keeps its size', () => {
    const m = measureCover(image(320, 500, () => PAPER));
    expect(m).toEqual({ width: 320, height: 500, white: 1, yellow: 0 });
  });

  it('counts a title set small on paper as paper still', () => {
    // Two lines of type across the middle: a title page.
    const m = measureCover(image(320, 500, (x, y) => ((y > 200 && y < 215) || (y > 240 && y < 250)) && x > 60 && x < 260 ? INK : PAPER));
    expect(m.white).toBeGreaterThan(0.9);
  });

  it('reads Reclam yellow as yellow, and a cover half yellow as half', () => {
    expect(measureCover(image(320, 500, () => RECLAM)).yellow).toBe(1);
    const half = measureCover(image(320, 500, (_, y) => (y < 250 ? RECLAM : BLUE)));
    expect(half.yellow).toBeGreaterThan(0.45);
    expect(half.yellow).toBeLessThan(0.55);
    expect(half.white).toBe(0);
  });

  it('does not take a pale cream or a dark mustard for Reclam', () => {
    expect(measureCover(image(100, 150, () => [240, 225, 180])).yellow).toBe(0); // cream: too little colour
    expect(measureCover(image(100, 150, () => [120, 100, 10])).yellow).toBe(0); // mustard: too dark
  });
});

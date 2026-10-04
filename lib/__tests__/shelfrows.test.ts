import { describe, expect, it } from 'vitest';
import { shelvesOf } from '../shelfrows';

/** A picture of `bands`: 'books' rows alternate dark and light every few pixels, 'board' rows are one tone. */
function picture(width: number, bands: ['books' | 'board', number][]) {
  const height = bands.reduce((n, [, h]) => n + h, 0);
  const rgba = new Uint8Array(width * height * 4);
  let y = 0;
  for (const [kind, h] of bands) {
    for (let r = 0; r < h; r++, y++) {
      for (let x = 0; x < width; x++) {
        const v = kind === 'board' ? 170 : Math.floor(x / 6) % 2 ? 230 : 30;
        const i = (y * width + x) * 4;
        rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; rgba[i + 3] = 255;
      }
    }
  }
  return { width, height, rgba };
}

describe('shelvesOf (5.11a): the boards of a bookcase, found in the picture', () => {
  it('cuts in the middle of each board and covers the whole height', () => {
    const shelves = shelvesOf(picture(600, [['books', 280], ['board', 40], ['books', 280], ['board', 40], ['books', 160]]));
    expect(shelves).toHaveLength(3);
    expect(shelves[0][0]).toBe(0);
    expect(shelves[0][1]).toBeCloseTo(300 / 800, 1);
    expect(shelves[1][1]).toBeCloseTo(620 / 800, 1);
    expect(shelves[2][1]).toBe(1);
  });

  it('gives a strip too low to be a shelf to its neighbour', () => {
    const shelves = shelvesOf(picture(600, [['books', 30], ['board', 30], ['books', 340], ['board', 30], ['books', 340], ['board', 30]]));
    expect(shelves).toHaveLength(2);
    expect(shelves[0][0]).toBe(0);
    expect(shelves[1][1]).toBe(1);
  });

  it('finds no shelves where no board divides the picture', () => {
    expect(shelvesOf(picture(600, [['books', 800]]))).toEqual([]);
  });
});

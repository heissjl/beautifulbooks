/**
 * How sharp a photo is, without a model (ROADMAP 5.11a). Pure; works on a
 * decoded image.
 *
 * A sharp edge changes brightness within a pixel or two; a blurred one
 * spreads the same change over several. So the strongest changes between
 * direct neighbours are compared with the strongest changes four pixels
 * apart: sharp, the two are close (a ratio of 0.5 and more); blurred, the
 * neighbour changes are a fraction of the wider ones (towards 0.25).
 * Strongest, not mean — the mean is the same for both, a ramp merely has
 * more pixels that change a little.
 *
 * Measured tile by tile, and the photo is as sharp as its sharpest tiles
 * (the 90th percentile): a cover held in the hand in front of an unsharp
 * shop is a sharp photo, and over the whole picture it scored lower than the
 * shaken shelf (0.28 against 0.31, test set 2026-10-04). A shaken photo is
 * the one where even the best tiles are soft.
 */
import type { RgbaImage } from './imagehash';

/**
 * Below this a photo counts as blurred. On the test set the one shaken photo
 * scores 0.33 and the other thirteen 0.44–0.74; 0.38 lies between. One
 * blurred example is thin evidence, so this may warn a reader and must not
 * turn a photo away.
 */
export const BLURRED_BELOW = 0.38;

const GRID = 12;
/** A tile needs a real edge in it to say anything: the strongest wide change at least this (of 255). */
const MIN_CONTRAST = 40;

/** The 99th percentile of 0..255 values, from a histogram. */
function top(hist: Uint32Array, count: number): number {
  let left = Math.ceil(count * 0.01);
  for (let v = 255; v >= 0; v--) {
    left -= hist[v];
    if (left <= 0) return v;
  }
  return 0;
}

/** Between about 0.25 (blurred) and 1 (sharp); 1 for a picture with no edge to judge by. */
export function sharpness(img: RgbaImage): number {
  const { width, height, rgba } = img;
  const lum = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) lum[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000;
  const bw = Math.floor(width / GRID);
  const bh = Math.floor(height / GRID);
  if (bw < 8 || bh < 8) return 1;
  const tiles: number[] = [];
  const near = new Uint32Array(256);
  const far = new Uint32Array(256);
  for (let by = 0; by < GRID; by++) {
    for (let bx = 0; bx < GRID; bx++) {
      let worst = Infinity;
      // Across and down: a shaken hand blurs along one direction, and the weaker one counts.
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        near.fill(0);
        far.fill(0);
        let count = 0;
        for (let y = by * bh; y < (by + 1) * bh - 4 * dy; y++) {
          for (let x = bx * bw; x < (bx + 1) * bw - 4 * dx; x++) {
            const i = y * width + x;
            near[Math.abs(lum[i + dy * width + dx] - lum[i])]++;
            far[Math.abs(lum[i + 4 * (dy * width + dx)] - lum[i])]++;
            count++;
          }
        }
        const wide = top(far, count);
        if (wide >= MIN_CONTRAST) worst = Math.min(worst, top(near, count) / wide);
      }
      if (worst !== Infinity) tiles.push(worst);
    }
  }
  if (tiles.length === 0) return 1;
  tiles.sort((a, b) => a - b);
  return tiles[Math.min(tiles.length - 1, Math.floor(tiles.length * 0.9))];
}

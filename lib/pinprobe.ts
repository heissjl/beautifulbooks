/**
 * What the pin measurement looks for in a picture's pixels (ROADMAP 5.5a,
 * pure; `scripts/measure-pins.ts` runs it on the JPEG the route answers).
 *
 * **Ink is brightness, not distance from the ground.** Since the pins stand
 * on the mosaic (d46aa2a) the ground is no one colour, and a distance from
 * #131110 reported the mosaic itself as type: every pin failed with "runs
 * into covers" and "overflows right". The type is light and the mosaic is
 * dimmed to at most 45 % (`GROUND_BASE` in `app/pin.tsx`), so a pixel's
 * r + g + b tells them apart. Measured on eight mosaic pins (2026-11-03): the
 * ground reaches 270 at most (345 in theory), the faintest type, the address
 * in `ink2`, 544 at least; 400 lies between. A row counts from where the
 * stroke is bright, so the edges of the ink are a pixel or so tighter than
 * with the old test.
 */
import type { Rect } from './pinlayout';

export const INK_MIN = 400;
/** The colour of a tile with no cover. */
const EMPTY_TILE = [0x26, 0x22, 0x1f];
const TILE_DISTANCE = 60;

export function isInk(px: Uint8Array, at: number): boolean {
  return px[at] + px[at + 1] + px[at + 2] > INK_MIN;
}

/** The first and last row with ink in a box of an RGB buffer, -1 when there is none. */
export function inkRows(px: Uint8Array, width: number, x0: number, x1: number, y0: number, y1: number): { from: number; to: number } {
  let from = -1;
  let to = -1;
  for (let y = y0; y < y1; y++) {
    let ink = false;
    for (let x = x0; x < x1 && !ink; x++) ink = isInk(px, (y * width + x) * 3);
    if (ink) {
      if (from < 0) from = y;
      to = y;
    }
  }
  return { from, to };
}

/**
 * Whether a tile holds a picture: its samples are far from the empty colour,
 * or they spread. A dark jacket (Gollancz's black *Dune*, 1974) sits near the
 * empty colour; an empty tile is one flat colour.
 */
export function tileFilled(px: Uint8Array, width: number, r: Rect): boolean {
  let different = 0;
  let lo = 255 * 3;
  let hi = 0;
  const samples = 64;
  for (let i = 0; i < samples; i++) {
    const x = r.x + Math.round(((i % 8) + 0.5) * (r.width / 8));
    const y = r.y + Math.round((Math.floor(i / 8) + 0.5) * (r.height / 8));
    const at = (y * width + x) * 3;
    if (Math.abs(px[at] - EMPTY_TILE[0]) + Math.abs(px[at + 1] - EMPTY_TILE[1]) + Math.abs(px[at + 2] - EMPTY_TILE[2]) > TILE_DISTANCE) different++;
    const sum = px[at] + px[at + 1] + px[at + 2];
    lo = Math.min(lo, sum);
    hi = Math.max(hi, sum);
  }
  return different > samples / 4 || hi - lo > 3 * TILE_DISTANCE;
}

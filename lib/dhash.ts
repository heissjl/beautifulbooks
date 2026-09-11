/**
 * The structure hash, split out of `lib/imagehash.ts` so the browser can run
 * the very same arithmetic (ROADMAP 6.34).
 *
 * `imagehash.ts` imports the JPEG and PNG decoders and must never reach a
 * client bundle; these functions need neither — a browser hands them the
 * pixels of an image it has already decoded, through a canvas. Keeping one
 * copy means a card and the wall measure distance on the same scale, so the
 * wall's fold threshold (`SAME_COVER_MAX_DISTANCE`) means the same on both.
 */
import { hamming } from './imagesig';

export interface GrayImage {
  width: number;
  height: number;
  /** Row-major luminance 0..255. */
  data: Uint8Array;
}

/** Luminance of every pixel, the input to the structure hash. */
export function toGray({ width, height, rgba }: { width: number; height: number; rgba: ArrayLike<number> }): GrayImage {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
  }
  return { width, height, data };
}

/** Area-averaging downscale to w x h. */
export function resizeGray(img: GrayImage, w: number, h: number): GrayImage {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * img.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * img.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / w));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { sum += img.data[yy * img.width + xx]; n++; }
      out[y * w + x] = sum / n;
    }
  }
  return { width: w, height: h, data: out };
}

/** dHash as 16 hex characters: each bit = left pixel brighter than its right neighbour on a 9x8 thumbnail. */
export function dhash(img: GrayImage): string {
  const t = resizeGray(img, 9, 8);
  let hex = '';
  let nibble = 0;
  let count = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const bit = t.data[y * 9 + x] > t.data[y * 9 + x + 1] ? 1 : 0;
      nibble = (nibble << 1) | bit;
      if (++count === 4) { hex += nibble.toString(16); nibble = 0; count = 0; }
    }
  }
  return hex;
}

/** The hash of RGBA pixels as a canvas returns them (`ImageData.data`). */
export function dhashFromRgba(width: number, height: number, rgba: ArrayLike<number>): string {
  return dhash(toGray({ width, height, rgba }));
}

/**
 * The first `limit` candidates that are not a repeat of one already taken
 * (ROADMAP 6.34): a candidate within `maxDistance` of a kept one is skipped.
 * A candidate without a hash — its image did not load, or could not be read —
 * is kept: nothing shows it is a repeat, and an empty place is worse.
 */
export function pickDistinct(
  items: ReadonlyArray<{ url: string; hash: string | null }>,
  limit: number,
  maxDistance: number,
): string[] {
  const kept: Array<{ url: string; hash: string | null }> = [];
  for (const item of items) {
    if (kept.length >= limit) break;
    const repeat = item.hash !== null && kept.some(k => k.hash !== null && hamming(k.hash, item.hash as string) <= maxDistance);
    if (!repeat) kept.push(item);
  }
  return kept.map(k => k.url);
}

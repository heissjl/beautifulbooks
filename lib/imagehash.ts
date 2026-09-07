/**
 * Perceptual image hashing (SPEC §2.3 phase 2, §8.5): a 64-bit difference
 * hash (dHash) over a 9x8 grayscale thumbnail. Two scans of the same cover
 * differ by a few bits; different covers differ by ~half. Pure functions,
 * no I/O; decoding uses jpeg-js and pngjs so no native module is needed.
 *
 * Server-side only: the decoders make this module unusable in the browser.
 * The signature type and its comparison live in `imagesig.ts` and are
 * re-exported here, so client code can fold covers without the decoders
 * (SPEC §9.3 step 11).
 */
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { BLANK_CONTRAST, HASH_BITS, hamming, type ImageSignature } from './imagesig';

export { BLANK_CONTRAST, HASH_BITS, hamming };
export type { ImageSignature };

export interface GrayImage {
  width: number;
  height: number;
  /** Row-major luminance 0..255. */
  data: Uint8Array;
}

/** Decodes JPEG or PNG bytes to grayscale. Returns null for unsupported data. */
export function decodeToGray(bytes: Uint8Array): GrayImage | null {
  let width: number;
  let height: number;
  let rgba: Uint8Array;
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64, maxResolutionInMP: 20 });
      width = img.width; height = img.height; rgba = img.data;
    } else if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      const img = PNG.sync.read(Buffer.from(bytes));
      width = img.width; height = img.height; rgba = new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);
    } else {
      return null;
    }
  } catch {
    return null;
  }
  if (width < 2 || height < 2) return null;
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

/** Standard deviation of luminance on a 32x32 thumbnail; near-blank scans score very low. */
export function contrast(img: GrayImage): number {
  const t = resizeGray(img, 32, 32);
  let sum = 0;
  for (const v of t.data) sum += v;
  const mean = sum / t.data.length;
  let varSum = 0;
  for (const v of t.data) varSum += (v - mean) ** 2;
  return Math.sqrt(varSum / t.data.length);
}

export function signature(bytes: Uint8Array): ImageSignature | null {
  const img = decodeToGray(bytes);
  if (!img) return null;
  return { hash: dhash(img), contrast: contrast(img) };
}

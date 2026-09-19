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
import { HASH_BITS, HUE_BUCKETS, colourDistance, hamming, looksLikeScannedPage, type ImageSignature } from './imagesig';

export { HASH_BITS, HUE_BUCKETS, colourDistance, hamming, looksLikeScannedPage };
export type { ImageSignature };

// The hash itself lives in `dhash.ts`, which the browser may import too
// (ROADMAP 6.34); re-exported so nothing that used it from here changes.
import { dhash, resizeGray, toGray, type GrayImage } from './dhash';
export { dhash, resizeGray, toGray, type GrayImage };

export interface RgbaImage {
  width: number;
  height: number;
  /** Row-major RGBA, four bytes per pixel. */
  rgba: Uint8Array;
}

/** Decodes JPEG or PNG bytes. Returns null for unsupported or broken data. */
export function decode(bytes: Uint8Array): RgbaImage | null {
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
  return { width, height, rgba };
}

/** Decodes JPEG or PNG bytes to grayscale. Returns null for unsupported data. */
export function decodeToGray(bytes: Uint8Array): GrayImage | null {
  const img = decode(bytes);
  return img && toGray(img);
}

/**
 * Mean colourfulness and a 16-bucket hue histogram (ROADMAP 6.10).
 *
 * Sampled on a grid of at most 64x64 points rather than resized, because
 * nothing here needs sub-pixel accuracy and area-averaging colour would blur
 * a red-and-blue cover into purple.
 *
 * Each pixel votes for its hue bucket **weighted by its own saturation**, so
 * the white margins and grey shadows that most jackets are full of do not
 * decide what colour the cover is. The result is scaled so the fullest
 * bucket is 255: two photographs of the same jacket under different light
 * should land in the same place, and only the shape of the histogram counts.
 */
export function colour({ width, height, rgba }: RgbaImage): { saturation: number; hues: string } {
  const stepX = Math.max(1, Math.floor(width / 64));
  const stepY = Math.max(1, Math.floor(height / 64));
  const buckets = new Float64Array(HUE_BUCKETS);
  let saturationSum = 0;
  let n = 0;

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const p = (y * width + x) * 4;
      const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const saturation = max === 0 ? 0 : delta / max;
      saturationSum += saturation;
      n++;
      if (delta === 0) continue;
      let hue: number;
      if (max === r) hue = ((g - b) / delta + 6) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      const bucket = Math.min(HUE_BUCKETS - 1, Math.floor((hue / 6) * HUE_BUCKETS));
      // Weighted by saturation and brightness: a pale grey pixel has a hue,
      // but it says nothing about what the cover looks like.
      const weight = saturation * (max / 255);
      // Spread over the neighbouring buckets, wrapping around the wheel, so a
      // colour sitting on a bucket boundary is not split in half by it.
      buckets[bucket] += weight * 0.5;
      buckets[(bucket + 1) % HUE_BUCKETS] += weight * 0.25;
      buckets[(bucket - 1 + HUE_BUCKETS) % HUE_BUCKETS] += weight * 0.25;
    }
  }

  const peak = Math.max(...buckets);
  const scaled = new Uint8Array(HUE_BUCKETS);
  for (let i = 0; i < HUE_BUCKETS; i++) scaled[i] = peak === 0 ? 0 : Math.round((buckets[i] / peak) * 255);
  return {
    saturation: n === 0 ? 0 : Math.round((saturationSum / n) * 255),
    hues: Buffer.from(scaled).toString('base64'),
  };
}

/** Mean and standard deviation of luminance on a 32x32 thumbnail. */
export function luminance(img: GrayImage): { mean: number; contrast: number } {
  const t = resizeGray(img, 32, 32);
  let sum = 0;
  for (const v of t.data) sum += v;
  const mean = sum / t.data.length;
  let varSum = 0;
  for (const v of t.data) varSum += (v - mean) ** 2;
  return { mean, contrast: Math.sqrt(varSum / t.data.length) };
}

/** Standard deviation of luminance; near-blank scans score very low. */
export function contrast(img: GrayImage): number {
  return luminance(img).contrast;
}

export interface SignatureOptions {
  /**
   * Also measure colour. Off by default: only the built index needs it, and
   * every page response carries signatures that would grow for nothing.
   */
  colour?: boolean;
}

export function signature(bytes: Uint8Array, options: SignatureOptions = {}): ImageSignature | null {
  const decoded = decode(bytes);
  if (!decoded) return null;
  const gray = toGray(decoded);
  const { mean, contrast } = luminance(gray);
  const base: ImageSignature = { hash: dhash(gray), contrast, mean };
  return options.colour ? { ...base, ...colour(decoded) } : base;
}

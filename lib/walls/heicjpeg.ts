/**
 * HEIC → JPEG for the photo import (ROADMAP 6.74), for browsers that cannot
 * decode an iPhone photo themselves (Chrome, measured 2026-09-28). Server
 * only: libheif as WebAssembly through heic-decode, then jpeg-js. Everything
 * happens in memory for one request; nothing is written or logged.
 */
import decodeHeic from 'heic-decode';
import jpeg from 'jpeg-js';

export interface RgbaFrame {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Area-averaging downscale so the long edge is at most `maxEdge`; a smaller
 * image comes back as it is. Every source pixel counts towards exactly one
 * target pixel, so fine print on a spine blurs rather than drops out.
 */
export function shrinkRgba(image: RgbaFrame, maxEdge: number): RgbaFrame {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const sums = new Float64Array(width * height * 4);
  const counts = new Uint32Array(width * height);
  for (let y = 0; y < image.height; y++) {
    const ty = Math.min(height - 1, Math.floor((y * height) / image.height));
    for (let x = 0; x < image.width; x++) {
      const tx = Math.min(width - 1, Math.floor((x * width) / image.width));
      const t = ty * width + tx;
      const s = (y * image.width + x) * 4;
      sums[t * 4] += image.data[s];
      sums[t * 4 + 1] += image.data[s + 1];
      sums[t * 4 + 2] += image.data[s + 2];
      sums[t * 4 + 3] += image.data[s + 3];
      counts[t]++;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let t = 0; t < counts.length; t++) {
    for (let c = 0; c < 4; c++) data[t * 4 + c] = Math.round(sums[t * 4 + c] / counts[t]);
  }
  return { width, height, data };
}

/** Throws when libheif cannot read the bytes; the caller says so rather than guessing why. */
export async function heicToJpeg(bytes: Uint8Array, maxEdge: number): Promise<{ jpeg: Buffer; width: number; height: number }> {
  const decoded = await decodeHeic({ buffer: bytes });
  const image = shrinkRgba(decoded, maxEdge);
  const out = jpeg.encode({ data: Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength), width: image.width, height: image.height }, 90);
  return { jpeg: out.data, width: image.width, height: image.height };
}

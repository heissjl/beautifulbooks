/**
 * A photo as it goes to the model, made on the server (ROADMAP 5.11a).
 * Server only: jpeg-js and pngjs, like `lib/imagehash.ts`.
 *
 * Until 2026-09-30 the browser shrank the photo on a canvas and sent that.
 * Julian's LibreWolf — like Firefox with `privacy.resistFingerprinting`, and
 * the Tor Browser — hands back a striped pattern instead of what was drawn,
 * so the model got 1.1 MB of stripes and read nothing (measured, docs/plans/
 * PLAN-5.11a-regalfoto-zuverlaessig.md). The browser now checks its canvas
 * first and, when it cannot trust it, sends the photo as it is; this module
 * then does what the canvas did — turn it the way the EXIF tag says, shrink
 * it to the long edge the model reads, write a plain JPEG — and runs on every
 * photo, so the model never sees EXIF (and a phone's GPS tag never leaves
 * this process). Nothing here writes to disk or logs.
 */
import jpeg from 'jpeg-js';
import { decode, type RgbaImage } from './imagehash';

/** The long edge the model reads; it downsizes anything larger itself, so more pixels cost upload time and nothing else. */
export const PHOTO_EDGE = 1600;

/** The EXIF orientation of a JPEG (1–8), 1 when there is none or it cannot be read. */
export function exifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let p = 2;
  while (p + 4 <= bytes.length && bytes[p] === 0xff) {
    const marker = bytes[p + 1];
    const size = (bytes[p + 2] << 8) | bytes[p + 3];
    if (marker === 0xda) break; // start of scan: no APP1 after this
    if (marker === 0xe1 && size >= 14) {
      const start = p + 4;
      // "Exif\0\0" then a TIFF header: byte order, 42, offset of the first IFD.
      if (bytes[start] === 0x45 && bytes[start + 1] === 0x78 && bytes[start + 2] === 0x69 && bytes[start + 3] === 0x66) {
        const tiff = start + 6;
        const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
        const u16 = (at: number) => (little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1]);
        const u32 = (at: number) => (little ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) + bytes[at + 3] * 0x1000000 : bytes[at] * 0x1000000 + ((bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]));
        const ifd = tiff + u32(tiff + 4);
        if (ifd + 2 > bytes.length) return 1;
        const entries = u16(ifd);
        for (let i = 0; i < entries; i++) {
          const e = ifd + 2 + i * 12;
          if (e + 12 > bytes.length) return 1;
          if (u16(e) === 0x0112) {
            const value = u16(e + 8);
            return value >= 1 && value <= 8 ? value : 1;
          }
        }
      }
      return 1;
    }
    p += 2 + size;
  }
  return 1;
}

/** The image turned so that it stands as the photographer saw it. Orientations 2, 4, 5 and 7 mirror; a photo never has them, so they are treated as their unmirrored partner. */
export function orient(img: RgbaImage, orientation: number): RgbaImage {
  const turns = orientation === 3 || orientation === 4 ? 2 : orientation === 6 || orientation === 5 ? 1 : orientation === 8 || orientation === 7 ? 3 : 0;
  if (turns === 0) return img;
  const { width: w, height: h, rgba } = img;
  const swap = turns % 2 === 1;
  const W = swap ? h : w;
  const H = swap ? w : h;
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Where the pixel (x, y) lands after `turns` quarter turns clockwise.
      const [nx, ny] = turns === 1 ? [h - 1 - y, x] : turns === 2 ? [w - 1 - x, h - 1 - y] : [y, w - 1 - x];
      const s = (y * w + x) * 4;
      const d = (ny * W + nx) * 4;
      out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
    }
  }
  return { width: W, height: H, rgba: out };
}

/** Shrunk so that the long edge is at most `edge`, each new pixel the mean of the box it covers; unchanged when already small enough. */
export function shrink(img: RgbaImage, edge: number = PHOTO_EDGE): RgbaImage {
  const { width: w, height: h, rgba } = img;
  const scale = Math.min(1, edge / Math.max(w, h));
  if (scale === 1) return img;
  const W = Math.max(1, Math.round(w * scale));
  const H = Math.max(1, Math.round(h * scale));
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor((y * h) / H);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / H));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor((x * w) / W);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / W));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const s = (yy * w + xx) * 4;
          r += rgba[s]; g += rgba[s + 1]; b += rgba[s + 2]; n++;
        }
      }
      const d = (y * W + x) * 4;
      out[d] = r / n; out[d + 1] = g / n; out[d + 2] = b / n; out[d + 3] = 255;
    }
  }
  return { width: W, height: H, rgba: out };
}

/** The rectangle [x0, y0, x1, y1] (fractions of the picture) as its own image; clamped to the picture, at least one pixel. */
export function crop(img: RgbaImage, x0: number, y0: number, x1: number, y1: number): RgbaImage {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const left = Math.floor(clamp(Math.min(x0, x1)) * img.width);
  const top = Math.floor(clamp(Math.min(y0, y1)) * img.height);
  const width = Math.max(1, Math.min(img.width - left, Math.ceil(clamp(Math.max(x0, x1)) * img.width) - left));
  const height = Math.max(1, Math.min(img.height - top, Math.ceil(clamp(Math.max(y0, y1)) * img.height) - top));
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const from = ((top + y) * img.width + left) * 4;
    out.set(img.rgba.subarray(from, from + width * 4), y * width * 4);
  }
  return { width, height, rgba: out };
}

/** An image as a plain JPEG, without EXIF. */
export function toJpeg(img: RgbaImage, quality: number = 85): Buffer {
  return jpeg.encode({ width: img.width, height: img.height, data: Buffer.from(img.rgba.buffer, img.rgba.byteOffset, img.rgba.byteLength) }, quality).data;
}

/** The photo decoded and upright at the size it arrived in — what a closer second look cuts its pieces from (5.11a). Null when the bytes cannot be read. */
export function uprightPhoto(bytes: Uint8Array): { image: RgbaImage; orientation: number } | null {
  // A 12-megapixel photo is 48 MB of RGBA plus jpeg-js's own buffers; 50 MP is more than any phone.
  const decoded = decode(bytes, { maxMemoryUsageInMB: 512, maxResolutionInMP: 50 });
  if (!decoded) return null;
  const orientation = bytes[0] === 0xff ? exifOrientation(bytes) : 1;
  return { image: orient(decoded, orientation), orientation };
}

export interface PreparedPhoto {
  bytes: Buffer;
  width: number;
  height: number;
  /** What was done, for the log line: the orientation found and whether it was shrunk. */
  orientation: number;
  shrunk: boolean;
  /** The upright photo at the size it arrived in, for a closer second look at a part of it. */
  full: RgbaImage;
}

/** The photo as the model gets it: upright, at most PHOTO_EDGE on the long edge, a plain JPEG without EXIF. Null when the bytes are not a JPEG or PNG the decoder reads. */
export function preparePhoto(bytes: Uint8Array, quality: number = 85): PreparedPhoto | null {
  const up = uprightPhoto(bytes);
  if (!up) return null;
  const small = shrink(up.image);
  return { bytes: toJpeg(small, quality), width: small.width, height: small.height, orientation: up.orientation, shrunk: small !== up.image, full: up.image };
}

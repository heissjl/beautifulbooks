/**
 * Is this a picture Calibre may be given as a cover? (lab/calibre, ROADMAP 5.16)
 *
 * A download can be an error page, a 1 × 1 placeholder or half a file. The
 * check decodes the whole image, so a truncated JPEG is caught before it
 * replaces a good cover. Pure.
 */
import { decode } from '../../lib/imagehash';

export interface ImageFacts {
  format: 'jpeg' | 'png';
  width: number;
  height: number;
  bytes: number;
}

export type CoverCheck = ({ ok: true } & ImageFacts) | { ok: false; reason: string };

/** Below this a picture is a thumbnail, not a cover. */
export const MIN_WIDTH = 200;
export const MIN_HEIGHT = 280;

export function imageFormat(bytes: Uint8Array): 'jpeg' | 'png' | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  return null;
}

export function checkCover(bytes: Uint8Array): CoverCheck {
  const format = imageFormat(bytes);
  if (!format) return { ok: false, reason: 'Not a JPEG or PNG — probably an error page or a placeholder.' };
  const img = decode(bytes, { maxMemoryUsageInMB: 256, maxResolutionInMP: 40 });
  if (!img || !img.width || !img.height) return { ok: false, reason: 'The image does not decode — the download is probably incomplete.' };
  if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
    return { ok: false, reason: `Only ${img.width} × ${img.height} px — too small to be a cover (minimum ${MIN_WIDTH} × ${MIN_HEIGHT}).` };
  }
  return { ok: true, format, width: img.width, height: img.height, bytes: bytes.length };
}

/** Width and height of an image file, or null when it does not decode. No minimum: this describes, it does not judge. */
export function imageFacts(bytes: Uint8Array): ImageFacts | null {
  const format = imageFormat(bytes);
  if (!format) return null;
  const img = decode(bytes, { maxMemoryUsageInMB: 256, maxResolutionInMP: 40 });
  return img && img.width && img.height ? { format, width: img.width, height: img.height, bytes: bytes.length } : null;
}

/**
 * A new cover with clearly fewer pixels than the one it replaces. A tenth is
 * allowed: 322 × 500 against 325 × 500 is the same scan cropped by a hair,
 * not a loss (measured on the first collection, 2026-10-03).
 */
export const SMALLER_BELOW = 0.9;
export const isSmaller = (next: Pick<ImageFacts, 'width' | 'height'>, old: Pick<ImageFacts, 'width' | 'height'>): boolean =>
  next.width * next.height < SMALLER_BELOW * old.width * old.height;

/**
 * Width and height from the file's header alone, without decoding — for a
 * whole library's covers at once. Null for anything that is not a JPEG or PNG
 * with a readable header; says nothing about whether the rest decodes.
 */
export function imageSizeFast(bytes: Uint8Array): { width: number; height: number } | null {
  const format = imageFormat(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === 'png') return bytes.length >= 24 ? { width: view.getUint32(16), height: view.getUint32(20) } : null;
  if (format !== 'jpeg') return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at++;
      continue;
    }
    // Start-of-frame markers carry the size; C4, C8 and CC are tables, not frames.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
    }
    // Markers without a length: restart markers and start/end of image.
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      at += 2;
      continue;
    }
    at += 2 + view.getUint16(at + 2);
  }
  return null;
}

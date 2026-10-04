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

/**
 * Cover signatures and their comparison, without any image decoding.
 *
 * Split out of `imagehash.ts` (SPEC §9.3 step 11) so that folding duplicate
 * covers can run in the browser: the server hashes each page's covers and
 * sends the signatures along, the client compares them. Importing the
 * decoders would pull jpeg-js and pngjs into the client bundle.
 */

export const HASH_BITS = 64;

export interface ImageSignature {
  hash: string;
  /** Luminance standard deviation; below BLANK_CONTRAST the image carries no design. */
  contrast: number;
}

/** Below this, a scan is a blank or near-blank page rather than a cover. */
export const BLANK_CONTRAST = 6;

/** Number of differing bits between two hex hashes of equal length. */
export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return HASH_BITS;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

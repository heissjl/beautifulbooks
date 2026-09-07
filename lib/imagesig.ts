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
  /** Luminance standard deviation; a flat image has almost no design. */
  contrast: number;
  /** Mean luminance 0..255. Absent in signatures cached before it was added. */
  mean?: number;
}

/**
 * Probably a scanned page rather than a cover (SPEC §9.3 step 12).
 *
 * Open Library holds records whose only image is a title page, a back-cover
 * blurb or a plain-text ebook front matter. All three conditions must hold,
 * because each alone takes genuine covers with it (measured 2026-09-07 over
 * 185 covers of *Beloved* and *The Great Gatsby* and every flagged cover of
 * *Nineteen Eighty-Four*):
 *
 * - **near-white**: the known blurb scans sit at mean luminance 249-253,
 *   while the palest genuine cover in the sample, a Chinese *Beloved* on
 *   cream, reaches 234. Without this bound the rule condemns the cloth
 *   bindings of the 1949 Harcourt first edition, which are simply dark.
 * - **flat**: contrast 8-13 for the pages; a real Arcturus cover measures
 *   10.5, so contrast alone proves nothing.
 * - **no structure**: a page of small text averages to smooth paper and
 *   leaves 10-11 set bits of 64 in the hash. Knopf's white *Beloved* jacket
 *   is just as pale and just as flat but carries 23.
 *
 * Even so the measures overlap: a plain white Greek *1984* (Kaktos 1999,
 * mean 253, contrast 11.3, 12 bits) is indistinguishable from a blurb scan by
 * these numbers. **So a cover flagged here is never removed, only sorted to
 * the end of its group.** Being wrong then costs a position instead of
 * hiding a real cover.
 *
 * Signatures without `mean` predate the measure and are never flagged.
 */
export const BLANK_MEAN = 245;
export const BLANK_MEAN_MAX_CONTRAST = 20;
export const BLANK_MAX_SET_BITS = 12;

/** Set bits in a hex hash: how much horizontal structure the image has. */
export function setBits(hash: string): number {
  let n = 0;
  for (const c of hash) {
    let x = parseInt(c, 16);
    while (x) { n += x & 1; x >>= 1; }
  }
  return n;
}

export function looksLikeScannedPage(signature: ImageSignature | undefined): boolean {
  if (!signature?.mean) return false;
  return signature.mean >= BLANK_MEAN
    && signature.contrast < BLANK_MEAN_MAX_CONTRAST
    && setBits(signature.hash) <= BLANK_MAX_SET_BITS;
}

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

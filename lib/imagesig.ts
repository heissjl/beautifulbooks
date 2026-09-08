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
  /**
   * Mean colourfulness 0..255, and 16 hue buckets as base64.
   *
   * Both are absent everywhere except the built index (ROADMAP 6.10): the
   * dHash is a structure hash on grey pixels, so "looks like this one" —
   * which is a statement about colour — cannot be answered from it. Folding
   * duplicates does not need them, and leaving them out of the page
   * responses keeps those small.
   */
  saturation?: number;
  hues?: string;
}

/** Hue buckets in a colour signature; 16 is enough to tell red from teal. */
export const HUE_BUCKETS = 16;

/**
 * How unlike two colour signatures are, 0 (same) to 1 (nothing shared).
 *
 * Histogram intersection over the hue buckets, plus a penalty when one cover
 * is vivid and the other is almost grey — without it a red jacket and a
 * black-and-white photograph come out close, because a grey image spreads
 * thinly over every bucket rather than landing anywhere.
 *
 * **Hue is a circle, so the comparison has to be one too.** A plain red at 0°
 * and a crimson at 355° are neighbours to the eye but sit at opposite ends of
 * the array; measured on 2026-09-08 they scored 0.77, further apart than red
 * and teal. So the histograms are compared at three alignments — as they are,
 * and rotated by one bucket each way — and the best one counts. One bucket is
 * 22.5°, which is roughly the drift between two scans of one jacket and far
 * less than the step from red to teal.
 */
export function colourDistance(a: ImageSignature, b: ImageSignature): number | null {
  if (!a.hues || !b.hues) return null;
  const ha = decodeHues(a.hues);
  const hb = decodeHues(b.hues);
  if (!ha || !hb) return null;

  let hueDistance = 1;
  for (const shift of [-1, 0, 1]) {
    let shared = 0;
    let total = 0;
    for (let i = 0; i < HUE_BUCKETS; i++) {
      const j = (i + shift + HUE_BUCKETS) % HUE_BUCKETS;
      shared += Math.min(ha[i], hb[j]);
      total += Math.max(ha[i], hb[j]);
    }
    hueDistance = Math.min(hueDistance, total === 0 ? 0 : 1 - shared / total);
  }

  const vividness = Math.abs((a.saturation ?? 0) - (b.saturation ?? 0)) / 255;
  return Math.min(1, hueDistance * 0.75 + vividness * 0.25);
}

/** 16 bytes of base64 back to numbers. Returns null for anything malformed. */
export function decodeHues(encoded: string): Uint8Array | null {
  try {
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    return bytes.length === HUE_BUCKETS ? bytes : null;
  } catch {
    return null;
  }
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

/**
 * What the photo import needs to know about a file before it leaves the
 * browser (ROADMAP 5.13a, 6.74). Pure and client-safe.
 *
 * iPhone photos are HEIC. Chrome gives a `.HEIC` file an empty `type` and
 * cannot decode it, neither with `createImageBitmap` nor with `<img>`;
 * Safari can (measured 2026-09-28, lab/shelf README „HEIC-Fotos"). So the
 * file is recognised by its first bytes, not by its type or name.
 */

/** Long edge the photo is shrunk to before it is read; the model reads no more (lab/shelf). */
export const PHOTO_EDGE = 1600;

/** Largest HEIC the conversion route accepts; an iPhone photo is 1–5 MB. */
export const MAX_HEIC_BYTES = 25 * 1024 * 1024;

/**
 * Major brands of the HEIF still images a phone writes (ISO/IEC 23008-12):
 * HEVC-coded (`heic`, `heix`, and their multi-image forms) and the generic
 * `mif1`/`msf1` that iPhones also use. AVIF is left out on purpose: Chrome
 * decodes it itself, and libheif as bundled cannot.
 */
const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1']);

/** True when the first twelve bytes are an ISO box `ftyp` with a HEIF brand. */
export function looksLikeHeif(head: Uint8Array): boolean {
  if (head.length < 12) return false;
  const ascii = (from: number) => String.fromCharCode(...head.subarray(from, from + 4));
  return ascii(4) === 'ftyp' && HEIF_BRANDS.has(ascii(8));
}

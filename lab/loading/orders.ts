/**
 * The packing a loading-screen build needs (lab/loading/README.md).
 *
 * The orders themselves moved to `lib/loading.ts` on 2026-09-09, when the
 * mosaic reached the website: the browser derives them from the luminance
 * map, so the site and the lab must use the same function or the picture a
 * measurement was made on is not the picture a reader sees. `lab/` may import
 * from `lib/`; the reverse is a lint error (lab/README.md rule 2).
 */
export { revealOrder, rng, shuffledSources, type OrderKind } from '../../lib/loading';

/** A typed array as base64, the form a manifest ships it in. */
export function toBase64(data: Uint8Array | Uint16Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Mean luminance per cell, quantised to one byte — what an order is read from. */
export function quantiseLuminance(means: readonly number[]): Uint8Array {
  const out = new Uint8Array(means.length);
  for (let i = 0; i < means.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(means[i])));
  return out;
}

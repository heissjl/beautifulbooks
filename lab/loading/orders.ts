/**
 * In which order a mosaic appears on a loading screen (ROADMAP 6.19a).
 *
 * Pure, and the reason this file exists apart from `build.ts`: an order is
 * the whole content of an animation, and it is the one part that can be
 * tested without a browser, a network or a picture.
 *
 * Orders are computed once, offline, and shipped inside the manifest. The
 * browser decodes a `Uint16Array` and does nothing else — the client cost of
 * the loading screen is the constraint the whole experiment answers to
 * (Julian, 2026-09-08: "es darf clientseitig nicht zu ressourcenverbrauchend
 * sein").
 */

/** Deterministic RNG, so a seed names an animation and a test can assert one. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type OrderKind = 'extreme' | 'dark' | 'raster' | 'wave' | 'random';

/**
 * The order the cells are filled in.
 *
 * - `extreme` is **the assignment's own order** (`mosaic.ts`, `order:
 *   'extreme'`): the cells furthest from the average brightness first. On a
 *   portrait that is the eyes, the hair and the brightest highlight, so a
 *   face stands there as a shadow long before the field is full. An
 *   animation that replays it is showing what actually happened, not a
 *   decoration.
 * - `dark` fills darkest first, which draws the shadow side of the face and
 *   leaves the background to the end.
 * - `wave` sweeps diagonally across the grid, top-left to bottom-right.
 * - `raster` is row by row, the way a page prints.
 * - `random` is the scatter, seeded.
 */
export function revealOrder(
  kind: OrderKind,
  lum: Readonly<Uint8Array>,
  cols: number,
  rows: number,
  seed = 1,
): Uint16Array {
  const n = cols * rows;
  if (lum.length !== n) throw new Error(`lum has ${lum.length} cells, grid has ${n}`);
  if (n > 0xffff) throw new Error(`a grid of ${n} cells does not fit a Uint16Array`);
  const index = Array.from({ length: n }, (_, i) => i);

  if (kind === 'raster') return Uint16Array.from(index);
  if (kind === 'random') {
    const random = rng(seed);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [index[i], index[j]] = [index[j], index[i]];
    }
    return Uint16Array.from(index);
  }
  if (kind === 'wave') {
    // Diagonals, and within a diagonal top to bottom: a sweep that crosses
    // the picture rather than filling it in reading order.
    index.sort((a, b) => {
      const da = (a % cols) + Math.floor(a / cols);
      const db = (b % cols) + Math.floor(b / cols);
      return da - db || a - b;
    });
    return Uint16Array.from(index);
  }

  let sum = 0;
  for (const v of lum) sum += v;
  const mean = sum / Math.max(1, n);
  if (kind === 'dark') index.sort((a, b) => lum[a] - lum[b] || a - b);
  else index.sort((a, b) => Math.abs(lum[b] - mean) - Math.abs(lum[a] - mean) || a - b);
  return Uint16Array.from(index);
}

/**
 * Where each cell starts when the wall begins in the wrong order.
 *
 * `startAt[cell]` is the cell whose cover is shown there before the wall
 * sorts itself out. A derangement is not worth the trouble — a handful of
 * cells that happen to start in the right place are invisible among five
 * hundred — but no cell may be **empty**, which a plain shuffle guarantees.
 */
export function shuffledSources(count: number, seed = 1): Uint16Array {
  const source = Array.from({ length: count }, (_, i) => i);
  const random = rng(seed);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [source[i], source[j]] = [source[j], source[i]];
  }
  return Uint16Array.from(source);
}

/** A typed array as base64, the form the manifest ships it in. */
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

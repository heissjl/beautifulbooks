/**
 * The loading mosaic: what the browser needs to draw one (ROADMAP 6.19a).
 *
 * Pure, client-safe, no imports from node. Promoted from `lab/loading` on
 * 2026-09-09 — the pictures are computed offline by `lab/loading/build-all.ts`
 * and copied into `public/loading` by `scripts/build-loading-assets.ts`; this
 * is the half that runs in a reader's browser while a search is in flight.
 *
 * **The orders are derived here rather than shipped.** Each one is two bytes
 * per cell, 3.9 KB at the grid we use; deriving it from the 1.9 KB luminance
 * map costs about a millisecond, once. That is the difference between a
 * manifest of 18 KB and one of 3.
 */

/** One built size of a mosaic. Only one of them is ever fetched. */
export interface MosaicImage {
  /** File name under `/loading/`. */
  file: string;
  width: number;
  height: number;
  /** Size of one cell in the file, in pixels. */
  cellWidth: number;
  cellHeight: number;
  bytes: number;
}

/** What `/loading/<id>.json` holds. */
export interface MosaicManifest {
  id: string;
  /** The author whose covers and face these are. */
  author: string;
  /** How many covers went into it — the caption may claim this and no more. */
  tiles: number;
  /** How many of the author's books the covers come from. */
  works: number;
  /** Where the portrait comes from and under what licence. */
  credit: string;
  cols: number;
  rows: number;
  /** Mean brightness per cell, one byte each, base64. */
  lum: string;
  images: MosaicImage[];
}

/** An entry in `/loading/index.json`: the rotation. */
export interface MosaicEntry {
  id: string;
  author: string;
}

/** Deterministic RNG, so a seed names an arrangement and a test can assert one. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A base64 payload as bytes. */
export function unpackBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type OrderKind = 'extreme' | 'dark' | 'raster' | 'wave' | 'random';

/**
 * The order the cells are filled in.
 *
 * `random` is the one the site uses: the wall clears without a front, so
 * nothing travels across the picture (ROADMAP 6.19a, proposal 3b). The others
 * are the alternatives that were measured against it and are kept because the
 * lab compares them.
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
 * Where each cell starts before the wall sorts itself out.
 *
 * `startAt[cell]` is the cell whose cover is shown there at the beginning. A
 * derangement is not worth the trouble — a handful of cells that happen to
 * start in the right place are invisible among fifteen hundred — but no cell
 * may be **empty**, which a plain shuffle guarantees.
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

/**
 * How much smaller than the screen wants the file may be.
 *
 * A photograph would show a 25 % upscale; a wall of cover thumbnails does
 * not, because there is no line in it that has to stay straight. Without this
 * tolerance a 260 px frame at two device pixels asks for 520 and gets the
 * 640 px file — 60 % more bytes for pixels nobody can point at.
 */
const UPSCALE_ALLOWED = 0.8;

/**
 * Which of the built sizes to fetch for a frame this wide.
 *
 * The device ratio is capped at two: a mosaic is a picture made of noise, and
 * the third device pixel buys nothing anybody can see while costing half
 * again as many bytes.
 */
export function pickImage(images: readonly MosaicImage[], frameWidth: number, dpr: number): MosaicImage {
  const wanted = frameWidth * Math.min(2, dpr) * UPSCALE_ALLOWED;
  const sorted = [...images].sort((a, b) => a.width - b.width);
  return sorted.find(image => image.width >= wanted) ?? sorted[sorted.length - 1];
}

/**
 * The height a frame must reserve before the picture is there.
 *
 * A cell is a cover, so it is 2:3, and the grid says how many of each — which
 * means the shape is known from the manifest alone, without a byte of JPEG.
 * On a cold search the file takes two to four tenths of a second, and without
 * this the page would reflow under a reader who is already waiting.
 */
export function frameHeight(cols: number, rows: number, frameWidth: number): number {
  return Math.round((frameWidth * rows * 1.5) / cols);
}

/** Picks one mosaic out of the rotation. */
export function pickTemplate(entries: readonly MosaicEntry[], random = Math.random): MosaicEntry | undefined {
  if (entries.length === 0) return undefined;
  return entries[Math.floor(random() * entries.length)];
}

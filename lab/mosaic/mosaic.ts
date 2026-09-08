/**
 * A giant mosaic: one picture assembled from the covers of a single book
 * (lab/mosaic/README.md, ROADMAP 5.5).
 *
 * Everything in this file is pure — patches in, an assignment out; pixels in,
 * pixels out. Fetching covers, decoding them and writing a PNG is render.ts,
 * which is the part that cannot be tested without a network.
 *
 * The whole difficulty of a photomosaic built from **one book** is that the
 * palette is not a stock library: it is whatever jackets that book happened
 * to be given. A few hundred covers, most of them mid-toned, have to stand in
 * for every shade the target picture needs. Three things here answer that:
 *
 * - `paletteReport` says up front how much of the target the palette can
 *   reach, so a hopeless pairing is visible before anything is rendered.
 * - `assign` compares **relative** brightness by default (`normalise`), which
 *   stretches the palette onto the target's range. It changes which cover is
 *   picked, never a single pixel of it — the covers are shown as they are.
 * - Cells are filled hardest-first (`order: 'extreme'`), because a cell that
 *   needs the darkest cover in the book must get it before a mid-grey cell,
 *   which almost any tile can satisfy.
 */
import type { RgbaImage } from '../../lib/imagehash';

/** Mean colour of a rectangle, measured on a small grid inside it. */
export interface Patch {
  /** Row-major RGB per sub-cell, three entries each, 0..255. */
  rgb: Float64Array;
  /** Luminance per sub-cell, 0..255. */
  lum: Float64Array;
  /** Mean luminance over the whole patch. */
  mean: number;
}

export interface Tile extends Patch {
  id: string;
}

export interface Target {
  cols: number;
  rows: number;
  patchCols: number;
  patchRows: number;
  /** `cols * rows` patches, row-major. */
  cells: Patch[];
}

const LUM_R = 299, LUM_G = 587, LUM_B = 114;

/** Mean RGB and luminance of one rectangle, on a `pc` x `pr` sub-grid. */
function rectPatch(img: RgbaImage, x0: number, y0: number, x1: number, y1: number, pc: number, pr: number): Patch {
  const rgb = new Float64Array(pc * pr * 3);
  const lum = new Float64Array(pc * pr);
  for (let sy = 0; sy < pr; sy++) {
    const ay0 = y0 + Math.floor(((y1 - y0) * sy) / pr);
    const ay1 = Math.max(ay0 + 1, y0 + Math.floor(((y1 - y0) * (sy + 1)) / pr));
    for (let sx = 0; sx < pc; sx++) {
      const ax0 = x0 + Math.floor(((x1 - x0) * sx) / pc);
      const ax1 = Math.max(ax0 + 1, x0 + Math.floor(((x1 - x0) * (sx + 1)) / pc));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = ay0; y < ay1 && y < img.height; y++) {
        for (let x = ax0; x < ax1 && x < img.width; x++) {
          const p = (y * img.width + x) * 4;
          r += img.rgba[p]; g += img.rgba[p + 1]; b += img.rgba[p + 2]; n++;
        }
      }
      if (n === 0) n = 1;
      const i = sy * pc + sx;
      rgb[i * 3] = r / n; rgb[i * 3 + 1] = g / n; rgb[i * 3 + 2] = b / n;
      lum[i] = (rgb[i * 3] * LUM_R + rgb[i * 3 + 1] * LUM_G + rgb[i * 3 + 2] * LUM_B) / 1000;
    }
  }
  let sum = 0;
  for (const v of lum) sum += v;
  return { rgb, lum, mean: sum / lum.length };
}

/** The target picture reduced to one patch per mosaic cell. */
export function patchesOf(img: RgbaImage, cols: number, rows: number, patchCols = 2, patchRows = 3): Target {
  const cells: Patch[] = [];
  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor((img.height * row) / rows);
    const y1 = Math.max(y0 + 1, Math.floor((img.height * (row + 1)) / rows));
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor((img.width * col) / cols);
      const x1 = Math.max(x0 + 1, Math.floor((img.width * (col + 1)) / cols));
      cells.push(rectPatch(img, x0, y0, x1, y1, patchCols, patchRows));
    }
  }
  return { cols, rows, patchCols, patchRows, cells };
}

/** One cover reduced to the same grid, so it can be compared with a cell. */
export function tileOf(id: string, img: RgbaImage, patchCols = 2, patchRows = 3): Tile {
  return { id, ...rectPatch(img, 0, 0, img.width, img.height, patchCols, patchRows) };
}

function stats(values: readonly number[]): { min: number; max: number; mean: number; sd: number } {
  if (values.length === 0) return { min: 0, max: 0, mean: 0, sd: 0 };
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of values) { if (v < min) min = v; if (v > max) max = v; sum += v; }
  const mean = sum / values.length;
  let varSum = 0;
  for (const v of values) varSum += (v - mean) ** 2;
  return { min, max, mean, sd: Math.sqrt(varSum / values.length) };
}

export interface PaletteReport {
  tiles: number;
  cells: number;
  tileLum: { min: number; max: number; mean: number; sd: number };
  cellLum: { min: number; max: number; mean: number; sd: number };
  /** Share of target cells darker or brighter than any cover in the book. */
  outOfRange: number;
  /** Same share once the palette is stretched onto the target (what `normalise` does). */
  outOfRangeNormalised: number;
}

/**
 * Whether this book's covers can carry this picture at all.
 *
 * Worth reading before a render: a target that needs black in a quarter of
 * its cells, out of a book whose darkest jacket is mid-grey, will come out as
 * mush however good the assignment is. `outOfRangeNormalised` is the number
 * that matters, because that is the range the assignment actually works in.
 */
export function paletteReport(target: Target, tiles: readonly Tile[]): PaletteReport {
  const tileLum = stats(tiles.map(t => t.mean));
  const cellLum = stats(target.cells.map(c => c.mean));
  const { gain, offset } = fit(tileLum, cellLum);
  const lo = tileLum.min * gain + offset;
  const hi = tileLum.max * gain + offset;
  const outside = (min: number, max: number) =>
    target.cells.filter(c => c.mean < min || c.mean > max).length / Math.max(1, target.cells.length);
  return {
    tiles: tiles.length,
    cells: target.cells.length,
    tileLum,
    cellLum,
    outOfRange: outside(tileLum.min, tileLum.max),
    outOfRangeNormalised: outside(lo, hi),
  };
}

/**
 * The affine map that puts the palette's brightness range onto the target's.
 *
 * Applied to a tile only while comparing it, never to the pixels that are
 * drawn: the mosaic must show the covers as they are, or it stops being a
 * picture made of this book's covers and becomes a repainted photograph.
 */
function fit(tileLum: { mean: number; sd: number }, cellLum: { mean: number; sd: number }): { gain: number; offset: number } {
  const gain = tileLum.sd < 1 ? 1 : Math.min(4, Math.max(0.25, cellLum.sd / tileLum.sd));
  return { gain, offset: cellLum.mean - tileLum.mean * gain };
}

export interface MosaicOptions {
  /** No cover may repeat within this many cells in any direction. Default 1 (a 3x3 neighbourhood). */
  minGap?: number;
  /** 0 = brightness only, 1 = colour only. Default 0.6. */
  colourWeight?: number;
  /** Added per use beyond a tile's fair share, in the same units as the distance. Default 300. */
  reusePenalty?: number;
  /** Compare relative brightness by stretching the palette onto the target. Default true. */
  normalise?: boolean;
  /** `extreme` fills the most demanding cells first; `raster` goes top-left to bottom-right. Default `extreme`. */
  order?: 'extreme' | 'raster';
}

export interface Mosaic {
  cols: number;
  rows: number;
  /** Tile id per cell, row-major. Never empty: a cell always gets a cover. */
  tiles: string[];
  usage: Map<string, number>;
  meanDistance: number;
  maxDistance: number;
  /** Cells where the repeat rule had to be dropped because nothing else was left. */
  relaxed: number;
}

function distance(cell: Patch, tile: Patch, colourWeight: number, gain: number, offset: number): number {
  let lumSum = 0, colSum = 0;
  const n = cell.lum.length;
  for (let i = 0; i < n; i++) {
    const dl = cell.lum[i] - (tile.lum[i] * gain + offset);
    lumSum += dl * dl;
    for (let c = 0; c < 3; c++) {
      const dc = cell.rgb[i * 3 + c] - (tile.rgb[i * 3 + c] * gain + offset);
      colSum += dc * dc;
    }
  }
  return ((1 - colourWeight) * lumSum + colourWeight * (colSum / 3)) / n;
}

/**
 * Which cover goes in which cell.
 *
 * Greedy, one cell at a time, in order of how hard the cell is to satisfy.
 * Greedy is enough here and a global optimum is not wanted anyway: the eye
 * reads a mosaic by its worst cells, not by its average, which is exactly
 * what filling the extremes first protects.
 */
export function assign(target: Target, tiles: readonly Tile[], options: MosaicOptions = {}): Mosaic {
  const {
    minGap = 1, colourWeight = 0.6, reusePenalty = 300, normalise = true, order = 'extreme',
  } = options;
  if (tiles.length === 0) throw new Error('a mosaic needs at least one tile');
  const first = tiles[0];
  if (first.lum.length !== target.cells[0]?.lum.length) {
    throw new Error('tiles and target cells must use the same patch grid');
  }

  const { gain, offset } = normalise
    ? fit(stats(tiles.map(t => t.mean)), stats(target.cells.map(c => c.mean)))
    : { gain: 1, offset: 0 };

  const { cols, rows } = target;
  const placed: (string | null)[] = new Array(cols * rows).fill(null);
  const uses = new Map<string, number>(tiles.map(t => [t.id, 0]));
  const fair = target.cells.length / tiles.length;

  const cellMean = stats(target.cells.map(c => c.mean)).mean;
  const indices = target.cells.map((_, i) => i);
  if (order === 'extreme') {
    indices.sort((a, b) => Math.abs(target.cells[b].mean - cellMean) - Math.abs(target.cells[a].mean - cellMean));
  }

  let distanceSum = 0, maxDistance = 0, relaxed = 0;
  for (const index of indices) {
    const cell = target.cells[index];
    const col = index % cols;
    const row = (index - col) / cols;

    const banned = new Set<string>();
    for (let dy = -minGap; dy <= minGap; dy++) {
      const y = row + dy;
      if (y < 0 || y >= rows) continue;
      for (let dx = -minGap; dx <= minGap; dx++) {
        const x = col + dx;
        if (x < 0 || x >= cols) continue;
        const other = placed[y * cols + x];
        if (other) banned.add(other);
      }
    }

    let best: Tile | undefined;
    let bestScore = Infinity;
    let bestDistance = 0;
    for (const pass of [0, 1]) {
      for (const tile of tiles) {
        if (pass === 0 && banned.has(tile.id)) continue;
        const d = distance(cell, tile, colourWeight, gain, offset);
        const over = Math.max(0, (uses.get(tile.id) ?? 0) - fair);
        const score = d + over * reusePenalty;
        if (score < bestScore) { bestScore = score; best = tile; bestDistance = d; }
      }
      // Every cell gets a cover. With few tiles and a wide gap the repeat rule
      // can exclude all of them, and a hole would be worse than a repeat.
      if (best) { if (pass === 1) relaxed++; break; }
    }

    placed[index] = best!.id;
    uses.set(best!.id, (uses.get(best!.id) ?? 0) + 1);
    distanceSum += bestDistance;
    if (bestDistance > maxDistance) maxDistance = bestDistance;
  }

  return {
    cols, rows,
    tiles: placed as string[],
    usage: uses,
    meanDistance: distanceSum / Math.max(1, target.cells.length),
    maxDistance,
    relaxed,
  };
}

/** Area-averaging resize of an RGBA image. */
export function resizeRgba(img: RgbaImage, w: number, h: number): RgbaImage {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * img.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * img.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / w));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const p = (yy * img.width + xx) * 4;
          r += img.rgba[p]; g += img.rgba[p + 1]; b += img.rgba[p + 2]; n++;
        }
      }
      const q = (y * w + x) * 4;
      out[q] = r / n; out[q + 1] = g / n; out[q + 2] = b / n; out[q + 3] = 255;
    }
  }
  return { width: w, height: h, rgba: out };
}

export interface ComposeOptions {
  cellWidth: number;
  cellHeight: number;
  /**
   * How much of the target picture to lay over the finished mosaic, 0..1.
   *
   * The usual cheat, and the reason the measure in the README caps it at
   * 0.25: above that the picture carries the tiles instead of the tiles
   * carrying the picture, and the result is a filtered photograph.
   */
  blend?: number;
  /** The target picture, used only when `blend` is above zero. */
  target?: RgbaImage;
}

/** Draws the assignment: every cell gets its cover, scaled to the cell. */
export function compose(
  mosaic: Mosaic,
  images: ReadonlyMap<string, RgbaImage>,
  { cellWidth, cellHeight, blend = 0, target }: ComposeOptions,
): RgbaImage {
  const width = mosaic.cols * cellWidth;
  const height = mosaic.rows * cellHeight;
  const rgba = new Uint8Array(width * height * 4);
  const scaled = new Map<string, RgbaImage>();

  for (let row = 0; row < mosaic.rows; row++) {
    for (let col = 0; col < mosaic.cols; col++) {
      const id = mosaic.tiles[row * mosaic.cols + col];
      let tile = scaled.get(id);
      if (!tile) {
        const source = images.get(id);
        if (!source) throw new Error(`no image for tile ${id}`);
        tile = resizeRgba(source, cellWidth, cellHeight);
        scaled.set(id, tile);
      }
      for (let y = 0; y < cellHeight; y++) {
        const dst = ((row * cellHeight + y) * width + col * cellWidth) * 4;
        const src = y * cellWidth * 4;
        rgba.set(tile.rgba.subarray(src, src + cellWidth * 4), dst);
      }
    }
  }

  if (blend > 0 && target) {
    const over = resizeRgba(target, width, height);
    const a = Math.min(1, blend);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = rgba[i] * (1 - a) + over.rgba[i] * a;
      rgba[i + 1] = rgba[i + 1] * (1 - a) + over.rgba[i + 1] * a;
      rgba[i + 2] = rgba[i + 2] * (1 - a) + over.rgba[i + 2] * a;
      rgba[i + 3] = 255;
    }
  }
  return { width, height, rgba };
}

/**
 * Where the shelf boards and the spines are in a photo (ROADMAP 5.16). Pure,
 * no model, no network: the photo never leaves the browser.
 *
 * The one idea: a line between two books runs through most of the row's
 * height, while lettering, a logo or a highlight covers only a few rows. So
 * the strength of a column is a low quantile over the row of the colour
 * change across it, not the mean — text raises the mean of a column, but a
 * low quantile only if it runs through nearly every row. The same holds sideways for shelf boards, whose edges run the
 * whole width while the tops of books of different heights do not.
 *
 * Leaning books, books lying flat and photos taken at a steep angle break
 * the idea; the page lets the reader add and remove lines by hand.
 */
import { rgbToOklab } from './color';

/** OKLab per pixel, three floats each, row by row. */
export interface LabImage { width: number; height: number; data: Float32Array }

export function toLabImage(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): LabImage {
  const data = new Float32Array(width * height * 3);
  // A photo has far fewer distinct colours than pixels; remember them.
  const seen = new Map<number, [number, number, number]>();
  for (let i = 0, j = 0; i < width * height * 4; i += 4, j += 3) {
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    let v = seen.get(key);
    if (!v) {
      const lab = rgbToOklab(rgba[i], rgba[i + 1], rgba[i + 2]);
      v = [lab.L, lab.a, lab.b];
      seen.set(key, v);
    }
    data[j] = v[0]; data[j + 1] = v[1]; data[j + 2] = v[2];
  }
  return { width, height, data };
}

function diff(img: LabImage, x1: number, y1: number, x2: number, y2: number): number {
  const p = (y1 * img.width + x1) * 3, q = (y2 * img.width + x2) * 3;
  const d = img.data;
  return Math.hypot(d[p] - d[q], d[p + 1] - d[q + 1], d[p + 2] - d[q + 2]);
}

function quantile(values: Float32Array | number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

const median = (values: Float32Array | number[]) => quantile(values, 0.5);

function smooth(profile: Float32Array): Float32Array {
  const out = new Float32Array(profile.length);
  for (let i = 0; i < profile.length; i++) {
    const a = profile[Math.max(0, i - 1)], b = profile[i], c = profile[Math.min(profile.length - 1, i + 1)];
    out[i] = (a + 2 * b + c) / 4;
  }
  return out;
}

/**
 * Peaks of a profile that stand out from it: above its median by `spread`
 * times the median absolute deviation and above `floor`, at least `minGap`
 * apart; the strongest wins a conflict.
 */
export function peaks(profile: Float32Array, minGap: number, spread = 4, floor = 0.02): number[] {
  const m = median(profile);
  const mad = median(profile.map(v => Math.abs(v - m)));
  const threshold = Math.max(floor, m + spread * Math.max(mad, 0.002));
  const candidates: number[] = [];
  for (let i = 1; i < profile.length - 1; i++) {
    if (profile[i] >= threshold && profile[i] >= profile[i - 1] && profile[i] >= profile[i + 1]) candidates.push(i);
  }
  candidates.sort((p, q) => profile[q] - profile[p]);
  const kept: number[] = [];
  for (const c of candidates) if (kept.every(k => Math.abs(k - c) >= minGap)) kept.push(c);
  return kept.sort((p, q) => p - q);
}

export interface Band { y0: number; y1: number }
export interface Box { x0: number; y0: number; x1: number; y1: number }

/** Lines across the whole photo, i.e. candidate shelf-board edges. */
export function findRowCuts(img: LabImage): number[] {
  const { width, height } = img;
  const profile = new Float32Array(height);
  const column = new Float32Array(width - 2);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) column[x - 1] = diff(img, x, y - 1, x, y + 1);
    profile[y] = median(column);
  }
  return peaks(smooth(profile), Math.max(4, Math.round(height * 0.02)), 6, 0.04);
}

/**
 * Rows between cuts; a stretch lower than `minShare` of the photo is a shelf
 * board or the gap above a board, not a row of books.
 */
export function rowsFromCuts(cuts: number[], height: number, minShare = 0.12): Band[] {
  const edges = [0, ...cuts.filter(c => c > 0 && c < height).sort((p, q) => p - q), height];
  const rows: Band[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    if (edges[i + 1] - edges[i] >= height * minShare) rows.push({ y0: edges[i], y1: edges[i + 1] });
  }
  return rows.length > 0 ? rows : [{ y0: 0, y1: height }];
}

/**
 * A line between books must be there in four of five rows of the band.
 * The median was not enough: a title set down the middle of a spine has
 * straight left and right edges over half its height, and the median counted
 * them as books (27 extra lines on the painted shelf).
 */
const LINE_QUANTILE = 0.2;

/**
 * Lines between books inside one row. Only the lower two thirds of the row
 * are read, because books stand on the board and a short book leaves the top
 * of its row empty.
 */
export function findSpineCuts(img: LabImage, row: Band): number[] {
  const h = row.y1 - row.y0;
  const top = Math.round(row.y0 + h * 0.35), bottom = Math.round(row.y1 - h * 0.05);
  const profile = new Float32Array(img.width);
  const values = new Float32Array(Math.max(1, bottom - top));
  for (let x = 1; x < img.width - 1; x++) {
    for (let y = top; y < bottom; y++) values[y - top] = diff(img, x - 1, y, x + 1, y);
    profile[x] = quantile(values, LINE_QUANTILE);
  }
  return peaks(smooth(profile), minSpineWidth(row));
}

/** A spine is rarely narrower than a thirtieth of its height. */
export function minSpineWidth(row: Band): number {
  return Math.max(4, Math.round((row.y1 - row.y0) * 0.035));
}

export function spinesFromCuts(cuts: number[], row: Band, width: number): Box[] {
  const edges = [0, ...cuts.filter(c => c > 0 && c < width).sort((p, q) => p - q), width];
  const min = minSpineWidth(row);
  const boxes: Box[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    if (edges[i + 1] - edges[i] >= min) boxes.push({ x0: edges[i], x1: edges[i + 1], y0: row.y0, y1: row.y1 });
  }
  return boxes;
}

/**
 * Moves the left and right edge of a spine box that an image model drew
 * (lab/shelf, `lib/recognize.ts`) onto the nearest line between books. The
 * model knows which books there are and what they are called; it places its
 * boxes only roughly. Each edge looks within `reach` of the box's width on
 * either side for the nearest line and stays put where there is none, so a
 * refined box is never worse than the model's.
 */
export function refineSpineBox(img: LabImage, box: Box, reach = 0.4): Box {
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  if (w < 3 || h < 10) return box;
  const top = Math.round(box.y0 + h * 0.2), bottom = Math.max(top + 1, Math.round(box.y1 - h * 0.1));
  const from = Math.max(1, Math.floor(box.x0 - w * reach)), to = Math.min(img.width - 2, Math.ceil(box.x1 + w * reach));
  if (to - from < 4) return box;
  const profile = new Float32Array(to - from + 1);
  const values = new Float32Array(bottom - top);
  for (let x = from; x <= to; x++) {
    for (let y = top; y < bottom; y++) values[y - top] = diff(img, x - 1, y, x + 1, y);
    profile[x - from] = quantile(values, LINE_QUANTILE);
  }
  const smoothed = smooth(profile);
  const m = median(smoothed);
  const threshold = Math.max(0.02, m + 4 * Math.max(median(smoothed.map(v => Math.abs(v - m))), 0.002));
  // The nearest line, not the strongest: a narrow neighbour's far edge can
  // fall inside the window and be the stronger one.
  const snap = (edge: number, lo: number, hi: number) => {
    let best = -1;
    for (let x = Math.max(from + 1, Math.round(lo)); x <= Math.min(to - 1, Math.round(hi)); x++) {
      const v = smoothed[x - from];
      if (v < threshold || v < smoothed[x - from - 1] || v < smoothed[x - from + 1]) continue;
      if (best < 0 || Math.abs(x - edge) < Math.abs(best - edge)) best = x;
    }
    return best < 0 ? edge : best;
  };
  const x0 = snap(box.x0, box.x0 - w * reach, box.x0 + w * reach);
  const x1 = snap(box.x1, box.x1 - w * reach, box.x1 + w * reach);
  // Both edges on the same line, or the book shrunk to a sliver: keep the model's box.
  if (x1 - x0 < w * 0.5) return box;
  return { ...box, x0, x1 };
}

/**
 * Fits a model's box into the shelf row it belongs to. Measured on Julian's
 * first real photo (2026-09-29, a whole bookcase, 1200 × 1600): the model
 * placed its boxes well from left to right but badly from top to bottom —
 * they began halfway down the spines and ran over the board into the next
 * row, so the colour was read partly from the board and the books below.
 * The boards themselves `findRowCuts` found cleanly. So the row is the one
 * the box's top lies in, and the box is cut to that row. A box that would
 * be left very short is given the lower half of its row, where books stand.
 */
export function fitBoxToRows(box: Box, rows: Band[]): Box {
  if (rows.length < 2) return box;
  const row = rows.find(r => box.y0 >= r.y0 && box.y0 < r.y1)
    ?? rows.reduce((best, r) => overlap(r, box) > overlap(best, box) ? r : best, rows[0]);
  const h = row.y1 - row.y0;
  let y0 = Math.max(box.y0, row.y0), y1 = Math.min(box.y1, row.y1);
  if (y1 - y0 < h * 0.15) { y0 = row.y1 - h * 0.5; y1 = row.y1; }
  return { ...box, y0: Math.round(y0), y1: Math.round(y1) };
}

function overlap(row: Band, box: Box): number {
  return Math.max(0, Math.min(row.y1, box.y1) - Math.max(row.y0, box.y0));
}

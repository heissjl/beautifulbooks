/**
 * Where the shelves of a photographed bookcase are, found in the picture
 * itself (ROADMAP 5.11a). Pure; works on a decoded image, so server only in
 * practice (lib/photoprep.ts decodes).
 *
 * A row of pixels across a shelf of books changes colour every few pixels —
 * spine after spine, letter after letter. A row across a shelf board, or the
 * shadow under it, hardly changes at all. The boards are therefore the bands
 * where that change falls away, and a closer second look at a dense photo
 * (lib/walls/dense.ts) cuts there: a cut anywhere else goes through the
 * titles on the spines, and the model then reads "Edo to Performance" where
 * "Body to Performance" stands (measured 2026-10-03). The model's own idea of
 * where the shelves are was off by half a shelf, which is why this is done
 * with arithmetic.
 */
import type { RgbaImage } from './imagehash';

/** A band is a board when its change is below this share of the picture's median row. */
const QUIET = 0.45;
/** A board is at least this share of the picture's height; a quiet stripe on a cover is thinner. */
const MIN_BOARD = 0.012;
/** A shelf of books is at least this share of the height. */
const MIN_SHELF = 0.08;

/** How much each of ~`rows` rows of the picture changes along its length: mean difference in brightness between neighbours a few pixels apart. */
export function rowChange(img: RgbaImage, rows: number = 400): number[] {
  const n = Math.min(rows, img.height);
  const step = Math.max(1, Math.floor(img.width / 400));
  const out: number[] = [];
  for (let r = 0; r < n; r++) {
    const y = Math.min(img.height - 1, Math.floor(((r + 0.5) * img.height) / n));
    let sum = 0;
    let count = 0;
    let prev = -1;
    for (let x = 0; x < img.width; x += step) {
      const i = (y * img.width + x) * 4;
      const lum = (img.rgba[i] * 299 + img.rgba[i + 1] * 587 + img.rgba[i + 2] * 114) / 1000;
      if (prev >= 0) {
        sum += Math.abs(lum - prev);
        count++;
      }
      prev = lum;
    }
    out.push(count ? sum / count : 0);
  }
  return out;
}

/**
 * The shelves as [top, bottom] fractions of the height, top to bottom,
 * together covering the whole picture: the stretches between boards. Empty
 * when no board divides the picture — a pile, a single shelf — and the caller
 * cuts some other way.
 */
export function shelvesOf(img: RgbaImage, options: { dropEdgeStrips?: boolean } = {}): [number, number][] {
  const change = rowChange(img);
  const n = change.length;
  if (n < 20) return [];
  // Smooth over about one per cent of the height, so a single calm row inside a cover is no board.
  const w = Math.max(1, Math.round(n * 0.01));
  const smooth = change.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let k = Math.max(0, i - w); k <= Math.min(n - 1, i + w); k++) {
      s += change[k];
      c++;
    }
    return s / c;
  });
  const median = [...smooth].sort((a, b) => a - b)[Math.floor(n / 2)];
  const quiet = smooth.map((v) => v < median * QUIET);
  // Boards: runs of quiet rows long enough; their middles are where to cut.
  const cuts: number[] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    if (i < n && quiet[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if ((i - start) / n >= MIN_BOARD) cuts.push((start + i) / 2 / n);
      start = -1;
    }
  }
  if (cuts.length === 0) return [];
  // The whole height, shared out: a stretch too low to be a shelf (the strip above the top board, the floor
  // under the last) goes to its neighbour rather than being left out — books lie there too.
  const edges = [0, ...cuts, 1];
  const shelves: [number, number][] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const piece: [number, number] = [edges[i], edges[i + 1]];
    if (piece[1] - piece[0] >= MIN_SHELF || shelves.length === 0) shelves.push(piece);
    else shelves[shelves.length - 1][1] = piece[1];
  }
  if (shelves.length > 1 && shelves[0][1] - shelves[0][0] < MIN_SHELF) {
    shelves[1][0] = shelves[0][0];
    shelves.shift();
  }
  // A variant being measured (lab/shelf/evaluate.ts --variant trim): the low strips at the top and bottom
  // edge — where the photo cuts a shelf off — are not read again at all, rather than given to a neighbour.
  if (options.dropEdgeStrips) {
    const first = edges[1] - edges[0];
    const last = edges[edges.length - 1] - edges[edges.length - 2];
    if (first < MIN_SHELF && shelves.length > 1) shelves[0][0] = edges[1];
    if (last < MIN_SHELF && shelves.length > 1) shelves[shelves.length - 1][1] = edges[edges.length - 2];
  }
  return shelves.length > 1 ? shelves : [];
}

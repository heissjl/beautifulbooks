/**
 * The colour step of the shelf prototype (ROADMAP 5.16, on lab/shelf 5.11).
 * lab/shelf/serve.ts bundles this file for its page as `/colors.js`; it runs
 * in the browser, on the photo the browser already holds, so the colours
 * cost no request and the photo goes nowhere it was not already going.
 *
 * The image model finds the books and reads their titles; this file moves a
 * spine's box onto the lines between books (`refineSpineBox`), reads its
 * colour, and orders the collection by colour with the rules of sort.ts.
 */
import { spineColor } from './color';
import { corners, fromAxis, orientedColor, refineOriented, tilt } from './oriented';
import { findRowCuts, findSpineCuts, fitBoxToRows, refineSpineBox, rowsFromCuts, toLabImage, type Band, type Box } from './spines';
import { DEFAULTS, layout, sortBooks, type Book, type Mode } from './sort';
import { syntheticShelf } from './synthetic';

export interface BookInPhoto {
  kind: 'spine' | 'cover';
  /** [x, y, w, h] as fractions of the photo, as lib/recognize.ts gives it. */
  box?: [number, number, number, number];
  /** Centre line and thickness, fractions (x and t of the width, y of the height). */
  axis?: [number, number, number, number, number];
}

export interface BookColor {
  hex: string;
  lch: { L: number; C: number; h: number };
  /** The box the colour was read from, as fractions — refined for spines. */
  box: [number, number, number, number];
  refined: boolean;
  /** Turned books: the rectangle's corners as fractions, for drawing. */
  corners?: Array<[number, number]>;
  /** Degrees from upright, how many long edges were found, and the main colour's share before and after. */
  tilt?: number;
  edges?: number;
  shareBefore?: number;
  share?: number;
}

export function colorsForBooks(canvas: HTMLCanvasElement, books: BookInPhoto[]): Array<BookColor | null> {
  const { width, height } = canvas;
  const rgba = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  const lab = toLabImage(rgba, width, height);
  const rows = rowsFromCuts(findRowCuts(lab), height);
  return books.map(book => {
    if (book.axis) {
      const [ax, ay, bx, by, t] = book.axis;
      let model = fromAxis(ax * width, ay * height, bx * width, by * height, t * width);
      // A line shorter than the book is thick runs across the book, not along it — seen on a
      // painted stack, where the model drew lying books from their bottom to their top. Turn it;
      // the edge search then finds the real thickness.
      if (model.length < model.thickness) model = { ...model, angle: model.angle + Math.PI / 2, length: model.thickness, thickness: model.length };
      const before = orientedColor(rgba, width, height, model);
      const refined = refineOriented(lab, model);
      const after = refined.moved ? orientedColor(rgba, width, height, refined.box) : before;
      // A move that makes the book less of one colour took in a neighbour: keep the model's.
      const keep = refined.moved && after.share >= before.share - 0.05;
      const b = keep ? refined.box : model, c = keep ? after : before;
      const pts = corners(b);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      return {
        hex: c.hex, lch: c.lch,
        box: [Math.min(...xs) / width, Math.min(...ys) / height, (Math.max(...xs) - Math.min(...xs)) / width, (Math.max(...ys) - Math.min(...ys)) / height],
        refined: keep,
        corners: pts.map(([x, y]) => [x / width, y / height] as [number, number]),
        tilt: Math.round(tilt(b)), edges: keep ? refined.edges : 0,
        shareBefore: before.share, share: c.share,
      };
    }
    if (!book.box) return null;
    const [fx, fy, fw, fh] = book.box;
    const raw: Box = {
      x0: Math.round(fx * width), y0: Math.round(fy * height),
      x1: Math.round((fx + fw) * width), y1: Math.round((fy + fh) * height),
    };
    if (raw.x1 - raw.x0 < 2 || raw.y1 - raw.y0 < 2) return null;
    const box = book.kind === 'spine' ? refineSpineBox(lab, fitBoxToRows(raw, rows)) : raw;
    const c = spineColor(rgba, width, box);
    return {
      hex: c.hex,
      lch: c.lch,
      box: [box.x0 / width, box.y0 / height, (box.x1 - box.x0) / width, (box.y1 - box.y0) / height],
      refined: box.x0 !== raw.x0 || box.x1 !== raw.x1 || box.y0 !== raw.y0 || box.y1 !== raw.y1,
    };
  });
}

/**
 * Indices of `colors` in colour order. Books without a colour (no box, no
 * photo) keep their photo order after the others: nothing was measured, so
 * nothing is claimed about where they belong.
 */
export function colourOrder(colors: Array<BookColor | null>, mode: Mode): number[] {
  const books: Book[] = [];
  colors.forEach((c, i) => { if (c) books.push({ id: i, row: 0, pos: i, width: 1, lch: c.lch }); });
  const sorted = sortBooks(books, { ...DEFAULTS, mode }).map(b => b.id);
  return [...sorted, ...colors.flatMap((c, i) => (c ? [] : [i]))];
}

/**
 * A painted shelf with `n` books and model-like boxes: each true box pushed
 * sideways by up to a quarter of its width, as a model's boxes are. For the
 * sample mode, which has titles but no photo.
 */
export function paintedSample(n: number, seed = Date.now() % 1000): { canvas: HTMLCanvasElement; boxes: Array<[number, number, number, number]> } {
  const shelf = syntheticShelf(Math.max(600, n * 60), 420, 1, seed);
  const canvas = document.createElement('canvas');
  canvas.width = shelf.width; canvas.height = shelf.height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(shelf.width, shelf.height);
  image.data.set(shelf.rgba);
  ctx.putImageData(image, 0, 0);
  const row = shelf.rows[0];
  let s = seed;
  const jitter = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296 - 0.5) * 0.5; };
  const boxes = row.cuts.slice(0, -1).slice(0, n).map((x0, i): [number, number, number, number] => {
    const w = row.cuts[i + 1] - x0;
    const x = x0 + jitter() * w;
    return [x / shelf.width, row.y0 / shelf.height, w / shelf.width, (row.y1 - row.y0) / shelf.height];
  });
  return { canvas, boxes };
}

/** Shelf boards and spine lines found in the photo itself, without the model. */
export function detectShelf(canvas: HTMLCanvasElement): { rows: Band[]; rowCuts: number[]; cuts: number[][]; ms: number } {
  const started = performance.now();
  const { width, height } = canvas;
  const rgba = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  const lab = toLabImage(rgba, width, height);
  const rowCuts = findRowCuts(lab);
  const rows = rowsFromCuts(rowCuts, height);
  return { rows, rowCuts, cuts: rows.map(r => findSpineCuts(lab, r)), ms: Math.round(performance.now() - started) };
}

/**
 * The shelf rebuilt from the photo's own spines in a new order (Julian,
 * 2026-09-29: „baue noch die funktion ein, dass am ende das sortierte regal
 * gezeigt wird"). Each book is cut out along its turned rectangle and stood
 * upright, so a leaning or lying book stands like the others; the rows are
 * refilled in order, each up to the width its books took in the photo
 * (`layout` in sort.ts), and stand on a board. Returns how many books it drew.
 */
export function drawSortedShelf(
  target: HTMLCanvasElement,
  photo: HTMLCanvasElement,
  colors: Array<BookColor | null>,
  rows: number[],
  order: number[],
): number {
  const W = photo.width, H = photo.height;
  type Piece = { index: number; row: number; cx: number; cy: number; angle: number; w: number; h: number };
  const pieces = new Map<number, Piece>();
  colors.forEach((c, index) => {
    if (!c) return;
    if (c.corners) {
      const [p0, p1, , p3] = c.corners.map(([x, y]) => [x * W, y * H]);
      let angle = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      if (Math.sin(angle) > 0.2) angle -= Math.PI; // stand it head up
      const cx = c.corners.reduce((sum, q) => sum + q[0] * W, 0) / 4, cy = c.corners.reduce((sum, q) => sum + q[1] * H, 0) / 4;
      pieces.set(index, { index, row: rows[index] ?? 0, cx, cy, angle, h: Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), w: Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) });
    } else {
      const [x, y, w, h] = c.box;
      pieces.set(index, { index, row: rows[index] ?? 0, cx: (x + w / 2) * W, cy: (y + h / 2) * H, angle: -Math.PI / 2, w: w * W, h: h * H });
    }
  });
  const sequence = order.map(i => pieces.get(i)).filter((p): p is Piece => !!p);
  if (sequence.length === 0) return 0;
  const rowCount = Math.max(...sequence.map(p => p.row)) + 1;
  const capacity = Array.from({ length: rowCount }, (_, r) => sequence.filter(p => p.row === r).reduce((sum, p) => sum + p.w, 0));
  const placed = layout(sequence.map((p, k) => ({ id: k, row: p.row, pos: k, width: p.w, lch: { L: 0, C: 0, h: 0 } })), capacity);

  const pad = Math.round(W * 0.02), board = Math.max(4, Math.round(H * 0.012)), gap = Math.round(H * 0.03);
  const rowHeights = Array.from({ length: rowCount }, (_, r) => Math.max(10, ...placed.filter(q => q.row === r).map(q => sequence[q.book.id].h)));
  const rowWidths = Array.from({ length: rowCount }, (_, r) => placed.filter(q => q.row === r).reduce((sum, q) => sum + sequence[q.book.id].w, 0));
  const width = Math.round(Math.max(...rowWidths) + 2 * pad);
  const height = Math.round(rowHeights.reduce((sum, h) => sum + h + board + gap, gap));
  const scale = Math.min(1, 2400 / width);
  target.width = Math.round(width * scale); target.height = Math.round(height * scale);
  const ctx = target.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#e4ddd0';
  ctx.fillRect(0, 0, width, height);
  let top = gap;
  for (let r = 0; r < rowCount; r++) {
    const bottom = top + rowHeights[r];
    let x = pad + (width - 2 * pad - rowWidths[r]) / 2;
    for (const q of placed.filter(p => p.row === r)) {
      const p = sequence[q.book.id];
      ctx.save();
      ctx.translate(x + p.w / 2, bottom - p.h / 2);
      ctx.beginPath();
      ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.clip();
      ctx.rotate(-Math.PI / 2 - p.angle);
      ctx.drawImage(photo, -p.cx, -p.cy);
      ctx.restore();
      x += p.w;
    }
    ctx.fillStyle = '#7a5a3e';
    ctx.fillRect(0, bottom, width, board);
    top = bottom + board + gap;
  }
  return sequence.length;
}

declare global {
  interface Window { shelfColors: { colorsForBooks: typeof colorsForBooks; colourOrder: typeof colourOrder; paintedSample: typeof paintedSample; detectShelf: typeof detectShelf; drawSortedShelf: typeof drawSortedShelf } }
}
if (typeof window !== 'undefined') window.shelfColors = { colorsForBooks, colourOrder, paintedSample, detectShelf, drawSortedShelf };

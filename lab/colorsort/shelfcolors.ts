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
import { DEFAULTS, sortBooks, type Book, type Mode } from './sort';
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

declare global {
  interface Window { shelfColors: { colorsForBooks: typeof colorsForBooks; colourOrder: typeof colourOrder; paintedSample: typeof paintedSample; detectShelf: typeof detectShelf } }
}
if (typeof window !== 'undefined') window.shelfColors = { colorsForBooks, colourOrder, paintedSample, detectShelf };

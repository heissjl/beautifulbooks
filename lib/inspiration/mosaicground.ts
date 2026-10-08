/**
 * The `mosaic` ground of the share pictures (ROADMAP 5.18b; Julian,
 * 2026-10-05: „make a background for the share pics that is derived from the
 * visual language of the mosaics we use in loading screens", and of the
 * mockup's variants „nimm erstmal weiterhin Option 0, das Papier und option
 * A"). Server only: it reads the loading pictures from disk.
 *
 * A dense field of tiny covers, 2:3 and without gaps, like the loading mosaic
 * — and made of the very same cells: the twenty pictures in `public/loading`
 * are cut into their 16 × 24 cells (28,760 of them) and set at random. No
 * cover is requested for it, and the field is the same kind of picture for
 * every board; only the arrangement changes, seeded by the board, so one
 * board always gets the same picture. Dimmed to half, darker towards the
 * edges, and darker still behind the words, so the type reads on any field.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { Rect } from './layout';

/** A cell of a 640 px loading picture, 40 across. */
const CELL = { w: 16, h: 24 };
/** How large a cell is drawn on a 1080 px poster: 40 across, as in the loader. */
const DRAWN_W = 27;

const DIR = path.join(process.cwd(), 'public', 'loading');

interface Library { cells: Buffer[] }

let library: Promise<Library> | null = null;

/** Every cell of every loading picture, read once per instance. */
function loadLibrary(): Promise<Library> {
  library ??= (async () => {
    const files = (await readdir(DIR)).filter((f) => f.endsWith('-640.jpg')).sort();
    const cells: Buffer[] = [];
    for (const f of files) {
      const { data, info } = await sharp(await readFile(path.join(DIR, f))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const cols = Math.floor(info.width / CELL.w);
      const rows = Math.floor(info.height / CELL.h);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const px = Buffer.alloc(CELL.w * CELL.h * 3);
        for (let y = 0; y < CELL.h; y++) data.copy(px, y * CELL.w * 3, ((r * CELL.h + y) * info.width + c * CELL.w) * 3, ((r * CELL.h + y) * info.width + (c + 1) * CELL.w) * 3);
        cells.push(px);
      }
    }
    if (cells.length === 0) throw new Error('no loading pictures');
    return { cells };
  })().catch((e) => { library = null; throw e; });
  return library;
}

/** A small seeded generator (Park–Miller), so a board's field never changes. */
export function seeded(text: string): () => number {
  let s = 0;
  for (let i = 0; i < text.length; i++) s = (s * 31 + text.charCodeAt(i)) % 2147483646;
  s = s + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Which cell stands where: `cols × rows` indices into a library of `size`
 * cells. Pure, so it can be tested without the pictures.
 */
export function arrangement(seed: string, cols: number, rows: number, size: number): number[] {
  const next = seeded(seed);
  return Array.from({ length: cols * rows }, () => Math.floor(next() * size));
}

/**
 * How dark the field is at a point, 0 (as it is) to 1 (black): half
 * everywhere, more towards the edges, and more behind the words.
 */
/** Where words stand; `dark` is how dark the field gets right behind them (0.78 unless set). */
export type WordArea = Rect & { dark?: number };

export function shade(x: number, y: number, width: number, height: number, words: WordArea[], windows: Rect[] = [], base = 0.5): number {
  // A window shows the field nearly as it is: the page's card lets the covers through where a board's places are.
  for (const w of windows) if (x >= w.x && x < w.x + w.width && y >= w.y && y < w.y + w.height) return 0.12;
  const r = Math.min(1, Math.hypot((x / width - 0.5) * 2, (y / height - 0.5) * 2) / 1.5);
  let a = base + (0.8 - 0.5) * Math.max(0, (r - 0.3) / 0.7);
  for (const w of words) {
    const dx = Math.max(w.x - x, 0, x - (w.x + w.width));
    const dy = Math.max(w.y - y, 0, y - (w.y + w.height));
    const d = Math.hypot(dx, dy);
    if (d < 60) a = Math.max(a, Math.max(base, w.dark ?? 0.78) - 0.28 * (d / 60));
  }
  return Math.min(1, a);
}

/** The field as a PNG of `width × height`; `windows` stay bright, `base` is how dark the rest is (half on a board's picture). */
export async function mosaicGround(width: number, height: number, seed: string, words: WordArea[], windows: Rect[] = [], base = 0.5): Promise<Buffer> {
  const { cells } = await loadLibrary();
  const cols = Math.ceil(width / DRAWN_W);
  const rows = Math.ceil(height / (DRAWN_W * 1.5));
  const w = cols * CELL.w;
  const h = rows * CELL.h;
  const field = Buffer.alloc(w * h * 3);
  arrangement(seed, cols, rows, cells.length).forEach((i, k) => {
    const c = k % cols;
    const r = Math.floor(k / cols);
    for (let y = 0; y < CELL.h; y++) cells[i].copy(field, ((r * CELL.h + y) * w + c * CELL.w) * 3, y * CELL.w * 3, (y + 1) * CELL.w * 3);
  });
  const px = await sharp(field, { raw: { width: w, height: h, channels: 3 } })
    .resize(width, height, { fit: 'cover', position: 'left top', kernel: 'lanczos3' })
    .raw()
    .toBuffer();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = Math.min(1, shade(x, y, width, height, words, windows, base));
    const o = (y * width + x) * 3;
    px[o] = px[o] * (1 - a) + 12 * a;
    px[o + 1] = px[o + 1] * (1 - a) + 10 * a;
    px[o + 2] = px[o + 2] * (1 - a) + 9 * a;
  }
  return sharp(px, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

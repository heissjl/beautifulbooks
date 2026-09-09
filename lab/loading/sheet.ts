/**
 * The whole rotation on one sheet (lab/loading/README.md, ROADMAP 6.19a).
 *
 *   npx tsx lab/loading/sheet.ts                 # every built template, finished
 *   npx tsx lab/loading/sheet.ts --at 0.35       # every one of them a third of the way through 3b
 *
 * Twenty pictures cannot be judged one at a time: the question is whether
 * they hold up **as a set**, because a reader sees a different one every
 * search and the weakest is the one that decides what the site looks like.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import { decode, type RgbaImage } from '../../lib/imagehash';
import { resizeRgba } from '../mosaic/mosaic';

const OUT_DIR = path.join('lab', 'loading', 'out');
const CELL_WIDTH = 190;
const GAP = 8;
const COLUMNS = 5;
/** The site's `--bg` in light mode. */
const GROUND: [number, number, number] = [0xf4, 0xf0, 0xe8];
const SURFACE: [number, number, number] = [0xfb, 0xf9, 0xf4];

interface Manifest {
  id: string;
  author: string;
  tiles: number;
  grids: {
    cols: number; rows: number; shuffle: string; orders: Record<string, string>;
    images: { file: string; width: number; height: number; cellWidth: number; cellHeight: number }[];
  }[];
}

function unpack16(base64: string): Uint16Array {
  const bytes = Buffer.from(base64, 'base64');
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

function copyCell(
  dst: RgbaImage, src: RgbaImage, at: number, from: number,
  cols: number, cellWidth: number, cellHeight: number,
) {
  const sc = from % cols, sr = (from - sc) / cols;
  const dc = at % cols, dr = (at - dc) / cols;
  for (let y = 0; y < cellHeight; y++) {
    const sy = sr * cellHeight + y, dy = dr * cellHeight + y;
    if (sy >= src.height || dy >= dst.height) break;
    const s = (sy * src.width + sc * cellWidth) * 4;
    const d = (dy * dst.width + dc * cellWidth) * 4;
    dst.rgba.set(src.rgba.subarray(s, s + cellWidth * 4), d);
  }
}

/** Proposal 3b held still: the wall scrambled, `progress` of it put right. */
function clearing(mosaic: RgbaImage, manifest: Manifest, progress: number): RgbaImage {
  const grid = manifest.grids[0];
  const image = grid.images[0];
  const cells = grid.cols * grid.rows;
  if (progress >= 1) return mosaic;
  const shuffle = unpack16(grid.shuffle);
  const random = unpack16(grid.orders.random);
  const out: RgbaImage = { width: mosaic.width, height: mosaic.height, rgba: new Uint8Array(mosaic.rgba.length) };
  for (let i = 0; i < cells; i++) copyCell(out, mosaic, i, shuffle[i], grid.cols, image.cellWidth, image.cellHeight);
  const eased = 1 - (1 - progress) ** 2;
  for (let i = 0; i < Math.round(eased * cells); i++) {
    copyCell(out, mosaic, random[i], random[i], grid.cols, image.cellWidth, image.cellHeight);
  }
  const dim = 0.5 * (1 - eased);
  for (let i = 0; i < out.rgba.length; i += 4) {
    out.rgba[i] = out.rgba[i] * (1 - dim) + SURFACE[0] * dim;
    out.rgba[i + 1] = out.rgba[i + 1] * (1 - dim) + SURFACE[1] * dim;
    out.rgba[i + 2] = out.rgba[i + 2] * (1 - dim) + SURFACE[2] * dim;
    out.rgba[i + 3] = 255;
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const atAt = argv.indexOf('--at');
  const progress = atAt >= 0 ? Number(argv[atAt + 1]) : 1;

  const index = JSON.parse(await readFile(path.join(OUT_DIR, 'index.json'), 'utf8')) as { id: string; file: string }[];
  const stills: RgbaImage[] = [];
  const names: string[] = [];
  for (const entry of [...index].sort((a, b) => a.id.localeCompare(b.id))) {
    const manifest = JSON.parse(await readFile(path.join(OUT_DIR, entry.file), 'utf8')) as Manifest;
    const image = manifest.grids[0].images[0];
    const mosaic = decode(new Uint8Array(await readFile(path.join(OUT_DIR, image.file))));
    if (!mosaic) throw new Error(`could not decode ${image.file}`);
    stills.push(clearing(mosaic, manifest, progress));
    names.push(`${manifest.author} (${manifest.tiles})`);
  }
  if (stills.length === 0) throw new Error('nothing built yet');

  const cellHeight = Math.round((CELL_WIDTH * stills[0].height) / stills[0].width);
  const rows = Math.ceil(stills.length / COLUMNS);
  const width = COLUMNS * CELL_WIDTH + (COLUMNS + 1) * GAP;
  const height = rows * cellHeight + (rows + 1) * GAP;
  const sheet: RgbaImage = { width, height, rgba: new Uint8Array(width * height * 4) };
  for (let i = 0; i < sheet.rgba.length; i += 4) {
    sheet.rgba[i] = GROUND[0]; sheet.rgba[i + 1] = GROUND[1]; sheet.rgba[i + 2] = GROUND[2]; sheet.rgba[i + 3] = 255;
  }
  for (const [i, still] of stills.entries()) {
    const small = resizeRgba(still, CELL_WIDTH, cellHeight);
    const x0 = GAP + (i % COLUMNS) * (CELL_WIDTH + GAP);
    const y0 = GAP + Math.floor(i / COLUMNS) * (cellHeight + GAP);
    for (let y = 0; y < cellHeight; y++) {
      const s = y * CELL_WIDTH * 4;
      sheet.rgba.set(small.rgba.subarray(s, s + CELL_WIDTH * 4), ((y0 + y) * width + x0) * 4);
    }
  }

  const png = new PNG({ width, height });
  png.data = Buffer.from(sheet.rgba);
  const suffix = progress >= 1 ? '' : `-${Math.round(progress * 100)}`;
  const out = path.join(OUT_DIR, `rotation${suffix}.png`);
  await writeFile(out, PNG.sync.write(png));
  console.log(`wrote ${out}, ${width}x${height}, ${stills.length} templates`);
  console.log(names.map((n, i) => `${i + 1}. ${n}`).join('   '));
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

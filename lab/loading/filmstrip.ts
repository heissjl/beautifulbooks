/**
 * A contact sheet of the three proposals: three rows, five moments each
 * (lab/loading/README.md, ROADMAP 6.19a).
 *
 *   npx tsx lab/loading/filmstrip.ts --id mark-twain --grid 1 --size 1
 *
 * The point is judging them without starting anything: the preview page shows
 * the animations moving, this shows what they look like at 10, 30, 50, 75 and
 * 100 per cent, which is the part a still can carry.
 *
 * Row 1 Rückzug, row 2 Schwerste Zelle zuerst, row 3 Umsortieren, row 4 Das
 * Rauschen klärt sich (3b).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import { decode, type RgbaImage } from '../../lib/imagehash';
import { resizeRgba } from '../mosaic/mosaic';

const OUT_DIR = path.join('lab', 'loading', 'out');
const MOMENTS = [0.1, 0.3, 0.5, 0.75, 1];
const STILL_WIDTH = 200;
const GAP = 10;
/** The site's `--surface-2` in light mode: the ground a loading screen sits on. */
const GROUND: [number, number, number] = [0xeb, 0xe5, 0xda];

interface Manifest {
  id: string;
  grids: {
    cols: number;
    rows: number;
    orders: Record<string, string>;
    shuffle: string;
    images: { file: string; width: number; height: number; cellWidth: number; cellHeight: number }[];
  }[];
}

function unpack16(base64: string): Uint16Array {
  const bytes = Buffer.from(base64, 'base64');
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

function blank(width: number, height: number, colour: readonly number[]): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = colour[0]; rgba[i + 1] = colour[1]; rgba[i + 2] = colour[2]; rgba[i + 3] = 255;
  }
  return { width, height, rgba };
}

/** Copies cell `from` of the mosaic into the place of cell `at`. */
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

function dim(image: RgbaImage, amount: number, colour: readonly number[]): void {
  for (let i = 0; i < image.rgba.length; i += 4) {
    image.rgba[i] = image.rgba[i] * (1 - amount) + colour[0] * amount;
    image.rgba[i + 1] = image.rgba[i + 1] * (1 - amount) + colour[1] * amount;
    image.rgba[i + 2] = image.rgba[i + 2] * (1 - amount) + colour[2] * amount;
  }
}

/** Vorschlag 1: the visible part of the picture at this point of the pull-back. */
function zoomStill(mosaic: RgbaImage, progress: number, maxScale: number): RgbaImage {
  const scale = maxScale ** (1 - progress);
  const ox = mosaic.width * 0.52, oy = mosaic.height * 0.3;
  const w = Math.max(1, Math.round(mosaic.width / scale));
  const h = Math.max(1, Math.round(mosaic.height / scale));
  const x0 = Math.max(0, Math.min(mosaic.width - w, Math.round(ox - ox / scale)));
  const y0 = Math.max(0, Math.min(mosaic.height - h, Math.round(oy - oy / scale)));
  const cut: RgbaImage = { width: w, height: h, rgba: new Uint8Array(w * h * 4) };
  for (let y = 0; y < h; y++) {
    const s = ((y0 + y) * mosaic.width + x0) * 4;
    cut.rgba.set(mosaic.rgba.subarray(s, s + w * 4), y * w * 4);
  }
  return cut;
}

async function main() {
  const flags = new Map<string, string>();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) flags.set(argv[i].replace(/^--/, ''), argv[i + 1] ?? '');
  const id = flags.get('id') ?? 'mark-twain';
  const gridIndex = Number(flags.get('grid') ?? 1);
  const sizeIndex = Number(flags.get('size') ?? 1);

  const manifest = JSON.parse(await readFile(path.join(OUT_DIR, `${id}.json`), 'utf8')) as Manifest;
  const grid = manifest.grids[gridIndex];
  const image = grid.images[sizeIndex];
  const mosaic = decode(new Uint8Array(await readFile(path.join(OUT_DIR, image.file))));
  if (!mosaic) throw new Error(`could not decode ${image.file}`);

  const cols = grid.cols, cells = grid.cols * grid.rows;
  const extreme = unpack16(grid.orders.extreme);
  const wave = unpack16(grid.orders.wave);
  const random = unpack16(grid.orders.random);
  const shuffle = unpack16(grid.shuffle);
  // The same start the page uses: twice the pixels of the file, at a 360 px frame.
  const maxScale = Math.max(2, (image.width / 360) * 2);

  const stills: RgbaImage[][] = [[], [], [], []];
  for (const progress of MOMENTS) {
    stills[0].push(zoomStill(mosaic, progress, maxScale));

    const reveal = blank(mosaic.width, mosaic.height, GROUND);
    const placed = Math.round(progress * cells);
    for (let i = 0; i < placed; i++) copyCell(reveal, mosaic, extreme[i], extreme[i], cols, image.cellWidth, image.cellHeight);
    stills[1].push(reveal);

    const sort = blank(mosaic.width, mosaic.height, GROUND);
    for (let i = 0; i < cells; i++) copyCell(sort, mosaic, i, shuffle[i], cols, image.cellWidth, image.cellHeight);
    dim(sort, 0.55, [0xfb, 0xf9, 0xf4]);
    for (let i = 0; i < Math.round(progress * cells); i++) {
      copyCell(sort, mosaic, wave[i], wave[i], cols, image.cellWidth, image.cellHeight);
    }
    stills[2].push(sort);

    /*
      3b: the same wall, but the cells land in random order and the dimming
      lifts with the wait. No front, so nothing travels across the picture —
      it only gets clearer.
    */
    const clear = blank(mosaic.width, mosaic.height, GROUND);
    for (let i = 0; i < cells; i++) copyCell(clear, mosaic, i, shuffle[i], cols, image.cellWidth, image.cellHeight);
    const eased = 1 - (1 - progress) ** 2;
    for (let i = 0; i < Math.round(eased * cells); i++) {
      copyCell(clear, mosaic, random[i], random[i], cols, image.cellWidth, image.cellHeight);
    }
    dim(clear, 0.5 * (1 - eased), [0xfb, 0xf9, 0xf4]);
    stills[3].push(clear);
  }

  const stillHeight = Math.round((STILL_WIDTH * mosaic.height) / mosaic.width);
  const width = MOMENTS.length * STILL_WIDTH + (MOMENTS.length + 1) * GAP;
  const height = stills.length * stillHeight + (stills.length + 1) * GAP;
  const sheet = blank(width, height, [0xf4, 0xf0, 0xe8]);
  for (let row = 0; row < stills.length; row++) {
    for (let col = 0; col < MOMENTS.length; col++) {
      const small = resizeRgba(stills[row][col], STILL_WIDTH, stillHeight);
      const x0 = GAP + col * (STILL_WIDTH + GAP);
      const y0 = GAP + row * (stillHeight + GAP);
      for (let y = 0; y < stillHeight; y++) {
        const s = y * STILL_WIDTH * 4;
        sheet.rgba.set(small.rgba.subarray(s, s + STILL_WIDTH * 4), ((y0 + y) * width + x0) * 4);
      }
    }
  }

  const png = new PNG({ width, height });
  png.data = Buffer.from(sheet.rgba);
  const out = path.join(OUT_DIR, `${id}-filmstrip.png`);
  await writeFile(out, PNG.sync.write(png));
  console.log(`wrote ${out}, ${width}x${height}`);
  console.log(
    'rows: Rückzug / Schwerste Zelle zuerst / Umsortieren / Das Rauschen klärt sich; '
    + `columns ${MOMENTS.map(m => `${m * 100}%`).join(', ')}`,
  );
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

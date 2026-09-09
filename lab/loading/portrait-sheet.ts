/**
 * Every portrait of the rotation on one sheet, with the frame each one is
 * built from drawn on it (lab/loading/README.md, ROADMAP 6.19a).
 *
 *   npx tsx lab/loading/portrait-sheet.ts
 *
 * The one step of this experiment that cannot be automated. A mosaic of
 * 1,400 cells shows a head, not a garden, and whether a portrait is a head
 * or a garden is something a person has to look at once. The red frame is
 * what `crop` in `templates.json` says, or what the 3:4 cut takes when
 * nothing says otherwise.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import { decode, type RgbaImage } from '../../lib/imagehash';
import { fetchBytes } from '../../lib/sources/http';
import { resizeRgba } from '../mosaic/mosaic';
import type { Template } from './portraits';

const TEMPLATES = path.join('lab', 'loading', 'templates.json');
const OUT = path.join('lab', 'loading', 'out', 'portraits.png');
const CELL = 200;
const GAP = 8;
const COLUMNS = 5;

function blank(width: number, height: number, colour: readonly number[]): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = colour[0]; rgba[i + 1] = colour[1]; rgba[i + 2] = colour[2]; rgba[i + 3] = 255;
  }
  return { width, height, rgba };
}

/** Draws the rectangle a template would build from, in the site's accent. */
function frame(img: RgbaImage, box: { x: number; y: number; w: number; h: number }) {
  const px = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    const p = (y * img.width + x) * 4;
    img.rgba[p] = 0xb1; img.rgba[p + 1] = 0x50; img.rgba[p + 2] = 0x2b;
  };
  for (let t = 0; t < 2; t++) {
    for (let x = box.x; x < box.x + box.w; x++) { px(x, box.y + t); px(x, box.y + box.h - 1 - t); }
    for (let y = box.y; y < box.y + box.h; y++) { px(box.x + t, y); px(box.x + box.w - 1 - t, y); }
  }
}

async function main() {
  const templates = (JSON.parse(await readFile(TEMPLATES, 'utf8')) as Template[])
    .filter(t => t.rotation !== false && t.target && !t.skipped);
  const stills: RgbaImage[] = [];
  const names: string[] = [];

  for (const t of templates) {
    let image: RgbaImage | null = null;
    try {
      image = decode(await fetchBytes(t.target, { timeoutMs: 25_000, revalidate: 0 }));
    } catch (err) {
      console.log(`  ${t.id}: could not be fetched (${(err as Error).message})`);
    }
    if (!image) { names.push(`${t.author} (no picture)`); stills.push(blank(300, 400, [0xeb, 0xe5, 0xda])); continue; }

    const height = Math.round((CELL * image.height) / image.width);
    const small = resizeRgba(image, CELL, height);
    // Where the mosaic's own frame falls, in this thumbnail.
    const c = t.crop ?? [0, 0, 1, 1];
    let x = c[0] * CELL, y = c[1] * height, w = c[2] * CELL, h = c[3] * height;
    // Then the 3:4 cut inside it, the way the build does it.
    const aspect = 3 / 4;
    if (w / h > aspect) { const next = h * aspect; x += (w - next) / 2; w = next; } else { const next = w / aspect; y += (h - next) * 0.15; h = next; }
    frame(small, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    stills.push(small);
    names.push(`${t.author}${t.crop ? ' (crop)' : ''}`);
  }

  const cellHeight = Math.max(...stills.map(s => s.height));
  const rows = Math.ceil(stills.length / COLUMNS);
  const width = COLUMNS * CELL + (COLUMNS + 1) * GAP;
  const height = rows * cellHeight + (rows + 1) * GAP;
  const sheet = blank(width, height, [0xf4, 0xf0, 0xe8]);
  for (const [i, still] of stills.entries()) {
    const x0 = GAP + (i % COLUMNS) * (CELL + GAP);
    const y0 = GAP + Math.floor(i / COLUMNS) * (cellHeight + GAP);
    for (let y = 0; y < still.height && y < cellHeight; y++) {
      const s = y * still.width * 4;
      sheet.rgba.set(still.rgba.subarray(s, s + still.width * 4), ((y0 + y) * width + x0) * 4);
    }
  }
  const png = new PNG({ width, height });
  png.data = Buffer.from(sheet.rgba);
  await writeFile(OUT, PNG.sync.write(png));
  console.log(`wrote ${OUT}, ${width}x${height}`);
  console.log(names.map((n, i) => `${i + 1}. ${n}`).join('   '));
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

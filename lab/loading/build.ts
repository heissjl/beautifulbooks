/**
 * Builds one loading-screen mosaic: a picture plus the little that a browser
 * needs to animate it (lab/loading/README.md, ROADMAP 6.19a).
 *
 * Run:
 *   npx tsx lab/loading/build.ts --author "mark twain" \
 *     --target "https://commons.wikimedia.org/wiki/Special:FilePath/Mark_Twain_by_AF_Bradley.jpg?width=1200" \
 *     --credit "A. F. Bradley, New York, 1907 — public domain"
 *
 * The difference to `lab/mosaic/render.ts`, which makes a poster: everything
 * here is measured against **one file the browser has to fetch and decode
 * while a reader is already waiting**. So the output is small, it is JPEG
 * rather than PNG, and it carries the fill orders precomputed, so the client
 * sorts nothing (Julian, 2026-09-08: "es darf clientseitig nicht zu
 * ressourcenverbrauchend sein").
 *
 * Every built mosaic is also written into `out/index.json`, which is the
 * rotation: several authors, one picked per search.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { loadPalette, targetImage, worksOfAuthor, type WorkRef } from '../mosaic/covers';
import { assign, compose, patchesOf, type Mosaic, type Target } from '../mosaic/mosaic';
import { quantiseLuminance, revealOrder, shuffledSources, toBase64 } from './orders';
import type { Tile } from '../mosaic/mosaic';

const CELL_ASPECT = 1.5;
const OUT_DIR = path.join('lab', 'loading', 'out');

interface Options {
  author: string;
  works: string[];
  id: string;
  target: string;
  credit: string;
  cols: number[];
  widths: number[];
  quality: number;
  colourWeight: number;
  maxWorks: number;
  maxPages: number;
}

function parseArgs(argv: string[]): Options {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(`expected a --flag, got ${argv[i]}`);
    flags.set(argv[i].slice(2), argv[i + 1] ?? '');
  }
  const num = (name: string, fallback: number) => {
    const raw = flags.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`--${name} needs a number, got ${raw}`);
    return value;
  };
  const list = (name: string, fallback: number[]) => {
    const raw = flags.get(name);
    if (!raw) return fallback;
    return raw.split(',').map(s => {
      const value = Number(s.trim());
      if (!Number.isFinite(value)) throw new Error(`--${name} needs numbers, got ${raw}`);
      return value;
    });
  };
  const author = flags.get('author') ?? '';
  const works = (flags.get('work') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!author && works.length === 0) throw new Error('--author or --work is needed');
  return {
    author,
    works,
    id: flags.get('id') ?? (author || works.join('-')).replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    target: flags.get('target') ?? 'auto',
    credit: flags.get('credit') ?? '',
    // Two grids, because the trade-off is the whole question: at 24 columns a
    // cell is still visibly a book, at 48 the face is better and the tiles
    // turn into confetti.
    cols: list('cols', [24, 40]),
    // 480 covers a phone at 2x for a 240 px picture; 960 covers a desktop.
    widths: list('width', [480, 720, 960]),
    quality: num('quality', 72),
    colourWeight: num('colour-weight', 0.15),
    maxWorks: num('max-works', 8),
    maxPages: num('max-pages', 12),
  };
}

/** What the browser gets: one image per size, and the orders to draw it in. */
interface ImageVariant {
  file: string;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  bytes: number;
  /** What the same picture would have cost as a PNG, for the record. */
  pngBytes: number;
}

interface GridVariant {
  cols: number;
  rows: number;
  /** Mean luminance per cell, one byte each, base64. */
  lum: string;
  /** Cell indices in fill order, Uint16 little-endian, base64. */
  orders: Record<string, string>;
  /** Which cell's cover each cell shows before the wall sorts itself out. */
  shuffle: string;
  images: ImageVariant[];
  /** How well the covers sit on the picture, for the notes. */
  meanDistance: number;
  coversUsed: number;
  mostUsedShare: number;
}

interface Manifest {
  id: string;
  author: string;
  built: string;
  /** Everything the caption may claim, and nothing more. */
  tiles: number;
  works: { id: string; title: string; editions: number }[];
  portrait: { source: string; credit: string };
  grids: GridVariant[];
}

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** The picture at one size, as JPEG, with the PNG it would have been. */
function encodeAt(
  mosaic: Mosaic,
  images: Map<string, { width: number; height: number; rgba: Uint8Array }>,
  width: number,
  quality: number,
): { jpegData: Uint8Array; pngBytes: number; picture: { width: number; height: number } } {
  const cellWidth = Math.max(1, Math.round(width / mosaic.cols));
  const cellHeight = Math.max(1, Math.round(cellWidth * CELL_ASPECT));
  const picture = compose(mosaic, images, { cellWidth, cellHeight });
  const data = Buffer.from(picture.rgba);
  const jpegData = jpeg.encode({ data, width: picture.width, height: picture.height }, quality).data;
  const png = new PNG({ width: picture.width, height: picture.height });
  png.data = data;
  return { jpegData: new Uint8Array(jpegData), pngBytes: PNG.sync.write(png).length, picture };
}

async function buildGrid(
  id: string,
  cols: number,
  target: { width: number; height: number; rgba: Uint8Array },
  tiles: Tile[],
  images: Map<string, { width: number; height: number; rgba: Uint8Array }>,
  options: Options,
): Promise<GridVariant> {
  const rows = Math.max(1, Math.round((cols / CELL_ASPECT) * (target.height / target.width)));
  const grid: Target = patchesOf(target, cols, rows);
  const mosaic = assign(grid, tiles, { colourWeight: options.colourWeight });
  const usage = [...mosaic.usage.values()];
  const cells = cols * rows;
  console.log(
    `  ${cols}x${rows} (${cells} cells): mean distance ${round(mosaic.meanDistance)}, `
    + `${usage.filter(n => n > 0).length} of ${tiles.length} covers used, `
    + `most-used holds ${round((Math.max(...usage) / cells) * 100)}%`,
  );

  const lum = quantiseLuminance(grid.cells.map(c => c.mean));
  const images_: ImageVariant[] = [];
  for (const width of options.widths) {
    const { jpegData, pngBytes, picture } = encodeAt(mosaic, images, width, options.quality);
    const file = `${id}-${cols}-${width}.jpg`;
    await writeFile(path.join(OUT_DIR, file), jpegData);
    images_.push({
      file,
      width: picture.width,
      height: picture.height,
      cellWidth: picture.width / cols,
      cellHeight: picture.height / rows,
      bytes: jpegData.length,
      pngBytes,
    });
    console.log(
      `    ${picture.width}x${picture.height}: JPEG q${options.quality} ${round(jpegData.length / 1024)} KB, `
      + `PNG would be ${round(pngBytes / 1024)} KB`,
    );
  }

  return {
    cols,
    rows,
    lum: toBase64(lum),
    /*
      Only the two orders the animations use. Every extra order is two bytes
      per cell on the wire (3.8 KB at 40 columns) to save a sort of 1,440
      numbers in the browser — which is why the site would ship `lum` alone
      and sort once (lab/loading/README.md).
    */
    orders: {
      extreme: toBase64(revealOrder('extreme', lum, cols, rows)),
      wave: toBase64(revealOrder('wave', lum, cols, rows)),
    },
    shuffle: toBase64(shuffledSources(cells, cells)),
    images: images_,
    meanDistance: round(mosaic.meanDistance),
    coversUsed: usage.filter(n => n > 0).length,
    mostUsedShare: round((Math.max(...usage) / cells) * 100, 2),
  };
}

/** The rotation: every mosaic built so far, newest first. */
async function updateIndex(manifest: Manifest) {
  const file = path.join(OUT_DIR, 'index.json');
  let known: { id: string; author: string; file: string }[] = [];
  try {
    known = JSON.parse(await readFile(file, 'utf8')) as typeof known;
  } catch {
    // First mosaic; the rotation starts here.
  }
  const entry = { id: manifest.id, author: manifest.author, file: `${manifest.id}.json` };
  const next = [entry, ...known.filter(k => k.id !== entry.id)];
  await writeFile(file, `${JSON.stringify(next, null, 1)}\n`);
  console.log(`rotation: ${next.length} mosaic${next.length === 1 ? '' : 's'} in ${file}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const started = Date.now();
  await mkdir(OUT_DIR, { recursive: true });
  const log = (line: string) => console.log(line);

  const works: WorkRef[] = options.author
    ? await worksOfAuthor(options.author, options.maxWorks, log)
    : options.works.map(id => ({ id, title: id, editionCount: 0, author: '' }));
  const { tiles, images, covers, signatures, incomplete } = await loadPalette(works.map(w => w.id), options.maxPages, log);
  console.log(
    `${tiles.length} tiles from ${works.length} work${works.length === 1 ? '' : 's'}`
    + (incomplete > 0 ? `, ${incomplete} of them incomplete because Open Library stopped answering` : ''),
  );

  const { image: target, what } = await targetImage(options.target, covers, signatures);
  console.log(`target: ${what}`);

  const grids: GridVariant[] = [];
  for (const cols of options.cols) grids.push(await buildGrid(options.id, cols, target, tiles, images, options));

  const manifest: Manifest = {
    id: options.id,
    // Open Library's spelling of the name, not the flag's: the caption is
    // a claim about a person, and "mark twain" is not how he is written.
    author: works[0].author || options.author,
    built: new Date().toISOString().slice(0, 10),
    tiles: tiles.length,
    works: works.map(w => ({ id: w.id, title: w.title, editions: w.editionCount })),
    portrait: { source: options.target, credit: options.credit },
    grids,
  };
  await writeFile(path.join(OUT_DIR, `${options.id}.json`), `${JSON.stringify(manifest)}\n`);
  const manifestBytes = JSON.stringify(manifest).length;
  console.log(`manifest ${options.id}.json, ${round(manifestBytes / 1024)} KB`);
  await updateIndex(manifest);
  console.log(`took ${round((Date.now() - started) / 1000)}s`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Building one loading-screen mosaic: the picture, and the little a browser
 * needs to animate it (lab/loading/README.md, ROADMAP 6.19a).
 *
 * Split out of `build.ts` on 2026-09-09 so that `build-all.ts` walks the
 * twenty templates through exactly the same code as one hand-made picture.
 *
 * The difference to `lab/mosaic/render.ts`, which makes a poster: everything
 * here is measured against **one file the browser has to fetch and decode
 * while a reader is already waiting**. So the output is small, it is JPEG
 * rather than PNG, and the fill orders are worked out offline, so the client
 * sorts nothing (Julian, 2026-09-08: "es darf clientseitig nicht zu
 * ressourcenverbrauchend sein").
 *
 * Every built mosaic is written into `out/index.json`, which is the rotation:
 * several authors, one picked per search.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { loadPalette, targetImage, worksOfAuthor, type WorkRef } from '../mosaic/covers';
import { assign, compose, cropToAspect, paletteReport, patchesOf, type Mosaic, type Target } from '../mosaic/mosaic';
import { quantiseLuminance, revealOrder, shuffledSources, toBase64 } from './orders';
import type { RgbaImage } from '../../lib/imagehash';
import type { Log } from '../mosaic/covers';
import type { Tile } from '../mosaic/mosaic';

const CELL_ASPECT = 1.5;
const OUT_DIR = path.join('lab', 'loading', 'out');

export interface Options {
  /** The name Open Library is searched and matched with. */
  author: string;
  /**
   * The name under the picture, when the catalogue spells it differently.
   *
   * Open Library files Tolstoy's works under „Лев Толстой", which is right
   * and is not what a German loading screen should say.
   */
  name?: string;
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
  /**
   * Width to height of the finished picture, or 0 to keep the portrait's own.
   *
   * The rotation uses 3:4 for all twenty: the frame a search waits in must
   * not change shape when the mosaic behind it changes (ROADMAP 6.19a), and
   * a portrait cut to the head spends its cells on a face instead of a coat.
   */
  aspect: number;
  /** The part of the portrait to use, as fractions: `[x, y, width, height]`. */
  crop?: [number, number, number, number];
}

/** What the browser gets: one image per size, and the orders to draw it in. */
export interface ImageVariant {
  file: string;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  bytes: number;
  /** What the same picture would have cost as a PNG, for the record. */
  pngBytes: number;
}

export interface GridVariant {
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
  /**
   * How much light and dark the **target** has, as the standard deviation of
   * cell brightness.
   *
   * The number that decides whether a portrait can carry a mosaic at all, and
   * it is not the same as `meanDistance`. Tolstoy's colour photograph of 1908
   * fits its covers beautifully — mean distance 285, the second best of the
   * twenty — and shows no face, because there is nothing in the picture to
   * show: a soft old photograph of a grey man against grey trees. Measured
   * over the twenty, a portrait under about 45 reads badly however well the
   * covers sit on it.
   */
  targetContrast: number;
  coversUsed: number;
  mostUsedShare: number;
}

export interface Manifest {
  id: string;
  author: string;
  built: string;
  /** Everything the caption may claim, and nothing more. */
  tiles: number;
  works: { id: string; title: string; editions: number }[];
  portrait: { source: string; credit: string };
  grids: GridVariant[];
}

export function round(value: number, digits = 1): number {
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
  log: Log,
): Promise<GridVariant> {
  const rows = Math.max(1, Math.round((cols / CELL_ASPECT) * (target.height / target.width)));
  const grid: Target = patchesOf(target, cols, rows);
  const mosaic = assign(grid, tiles, { colourWeight: options.colourWeight });
  const palette = paletteReport(grid, tiles);
  const usage = [...mosaic.usage.values()];
  const cells = cols * rows;
  log(
    `  ${cols}x${rows} (${cells} cells): target contrast ${round(palette.cellLum.sd)}, `
    + `mean distance ${round(mosaic.meanDistance)}, `
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
    log(
      `    ${picture.width}x${picture.height}: JPEG q${options.quality} ${round(jpegData.length / 1024)} KB, `
      + `PNG would be ${round(pngBytes / 1024)} KB`,
    );
  }

  return {
    cols,
    rows,
    lum: toBase64(lum),
    /*
      Only the orders the animations use. Every extra order is two bytes
      per cell on the wire (3.8 KB at 40 columns) to save a sort of 1,440
      numbers in the browser — which is why the site would ship `lum` alone
      and sort once (lab/loading/README.md).
    */
    orders: {
      extreme: toBase64(revealOrder('extreme', lum, cols, rows)),
      wave: toBase64(revealOrder('wave', lum, cols, rows)),
      random: toBase64(revealOrder('random', lum, cols, rows, cells)),
    },
    shuffle: toBase64(shuffledSources(cells, cells)),
    images: images_,
    meanDistance: round(mosaic.meanDistance),
    targetContrast: round(palette.cellLum.sd),
    coversUsed: usage.filter(n => n > 0).length,
    mostUsedShare: round((Math.max(...usage) / cells) * 100, 2),
  };
}

/** The rotation: every mosaic built so far, newest first. */
async function updateIndex(manifest: Manifest, log: Log) {
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
  log(`rotation: ${next.length} mosaic${next.length === 1 ? '' : 's'} in ${file}`);
}

/** The part of a picture a template's `crop` names, in fractions. */
function cut(img: RgbaImage, [fx, fy, fw, fh]: [number, number, number, number]): RgbaImage {
  const x0 = Math.max(0, Math.round(fx * img.width));
  const y0 = Math.max(0, Math.round(fy * img.height));
  const width = Math.max(1, Math.min(img.width - x0, Math.round(fw * img.width)));
  const height = Math.max(1, Math.min(img.height - y0, Math.round(fh * img.height)));
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const s = ((y0 + y) * img.width + x0) * 4;
    rgba.set(img.rgba.subarray(s, s + width * 4), y * width * 4);
  }
  return { width, height, rgba };
}

/** Builds one template end to end: covers, target, grids, files, manifest. */
export async function buildTemplate(options: Options, log: Log = line => console.log(line)): Promise<Manifest> {
  await mkdir(OUT_DIR, { recursive: true });

  const works: WorkRef[] = options.author
    ? await worksOfAuthor(options.author, options.maxWorks, log)
    : options.works.map(id => ({ id, title: id, editionCount: 0, author: '' }));
  const { tiles, images, covers, signatures, incomplete, failedImages, fetchedImages } =
    await loadPalette(works.map(w => w.id), options.maxPages, log);
  log(
    `${tiles.length} tiles from ${works.length} work${works.length === 1 ? '' : 's'}`
    + (failedImages > 0 ? `, ${failedImages} cover images did not arrive` : '')
    + (incomplete > 0 ? `, ${incomplete} works incomplete because Open Library stopped answering` : ''),
  );
  /*
    **A picture is not built out of an outage.**

    Measured on 2026-09-09: under a rate limit the cover CDN refused most of
    the requests, and a George Eliot mosaic came out of **two** covers with
    nothing in the run saying so — the log read "101 covers, 1 design" and
    the summary read like a thin book. Half is a generous line; a healthy run
    loses a few per cent.
  */
  const listed = fetchedImages + failedImages;
  if (listed > 0 && fetchedImages / listed < 0.5) {
    throw new Error(
      `only ${fetchedImages} of ${listed} cover images arrived — that is an outage, not a palette. `
      + 'Wait for the source to recover and build this template again.',
    );
  }

  const { image: full, what } = await targetImage(options.target, covers, signatures);
  // A hand-set frame first, where the portrait needed one, then the ratio.
  const framed = options.crop ? cut(full, options.crop) : full;
  const target = options.aspect > 0 ? cropToAspect(framed, options.aspect) : framed;
  log(
    `target: ${what}, ${full.width}x${full.height}`
    + (options.crop ? ` framed to ${framed.width}x${framed.height}` : '')
    + (target === framed ? '' : ` cut to ${target.width}x${target.height}`),
  );

  const grids: GridVariant[] = [];
  for (const cols of options.cols) grids.push(await buildGrid(options.id, cols, target, tiles, images, options, log));

  const manifest: Manifest = {
    id: options.id,
    // Open Library's spelling of the name, not the flag's: the caption is a
    // claim about a person, and "mark twain" is not how he is written.
    author: options.name || works[0].author || options.author,
    built: new Date().toISOString().slice(0, 10),
    tiles: tiles.length,
    works: works.map(w => ({ id: w.id, title: w.title, editions: w.editionCount })),
    portrait: { source: options.target, credit: options.credit },
    grids,
  };
  await writeFile(path.join(OUT_DIR, `${options.id}.json`), `${JSON.stringify(manifest)}\n`);
  log(`manifest ${options.id}.json, ${round(JSON.stringify(manifest).length / 1024)} KB`);
  await updateIndex(manifest, log);
  return manifest;
}

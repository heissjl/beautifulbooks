/**
 * Builds one mosaic and writes it as a PNG (lab/mosaic/README.md).
 *
 * Run:
 *   npx tsx lab/mosaic/render.ts --work OL1168083W
 *   npx tsx lab/mosaic/render.ts --work OL468431W --cols 24 --rows 24 --blend 0.2
 *
 * This is the half that touches the world: Open Library for the editions,
 * covers.openlibrary.org for the images, the file system for the result.
 * The decisions live in mosaic.ts, which is pure and tested.
 *
 * **No Google Books** (lab/README.md rule 6, E10): every page is loaded with
 * `googleBooks: false`, so a run costs nothing from the 1,000 a day. It does
 * cost Open Library one request per hundred edition records plus one image
 * per cover, which is why this is a script run by hand and not a route.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import { decode, signature } from '../../lib/imagehash';
import { looksLikeScannedPage, type ImageSignature } from '../../lib/imagesig';
import type { Cover, Edition } from '../../lib/model';
import { fetchBytes } from '../../lib/sources/http';
import { getWorkPage } from '../../lib/work';
import { foldDuplicateCovers } from '../../lib/works';
import { assign, compose, paletteReport, patchesOf, tileOf, type Tile } from './mosaic';

interface RgbaImage { width: number; height: number; rgba: Uint8Array }

/** A cover is half again as tall as it is wide, and so is a cell. */
const CELL_ASPECT = 1.5;

interface Options {
  work: string;
  cols: number;
  rows: number;
  width: number;
  blend: number;
  target: string;
  out: string;
  maxPages: number;
  colourWeight: number;
  minGap: number;
  normalise: boolean;
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
  const work = flags.get('work') ?? 'OL1168083W';
  return {
    work,
    // Covers are 2:3, so a square grid of them gives a 2:3 picture — the
    // shape of a Pinterest pin. Rows default to 0, which means "work it out
    // from the target", because forcing a square grid onto a portrait
    // stretches the face: measured on the Orwell photograph (1176x1594), a
    // 40x40 grid made the head half again as long as it is.
    cols: num('cols', 30),
    rows: num('rows', 0),
    width: num('width', 1020),
    blend: num('blend', 0),
    target: flags.get('target') ?? 'auto',
    out: flags.get('out') ?? path.join('lab', 'mosaic', 'out', `${work}.png`),
    maxPages: num('max-pages', 12),
    colourWeight: num('colour-weight', 0.6),
    minGap: num('min-gap', 1),
    normalise: (flags.get('normalise') ?? 'true') !== 'false',
  };
}

/** Every edition page of the work, Open Library only. */
async function loadCovers(workId: string, maxPages: number): Promise<{ covers: Cover[]; editions: Edition[]; title: string }> {
  const byCover = new Map<string, Cover>();
  const editions: Edition[] = [];
  let offset: number | undefined = 0;
  let title = workId;
  for (let page = 0; page < maxPages && offset !== undefined; page++) {
    const loaded = await getWorkPage(workId, { offset, googleBooks: false });
    if (!loaded) throw new Error(`no such work: ${workId}`);
    title = loaded.work.title;
    editions.push(...loaded.editions);
    for (const cover of loaded.covers) {
      const seen = byCover.get(cover.id);
      if (!seen) byCover.set(cover.id, { ...cover, editionIds: [...cover.editionIds] });
      else for (const id of cover.editionIds) if (!seen.editionIds.includes(id)) seen.editionIds.push(id);
    }
    process.stdout.write(`  page ${page}: ${byCover.size} covers so far\n`);
    offset = loaded.page.nextOffset;
  }
  return { covers: [...byCover.values()], editions, title };
}

const CACHE_DIR = path.join('lab', 'mosaic', 'out', 'cache');

/**
 * The cover image, from disk if we have already asked for it.
 *
 * Outside Next there is no data cache, and trying three grids on one book
 * would otherwise download the same few hundred images three times. Open
 * Library redirects covers to archive.org and documents a rate limit, so
 * asking twice for what has not changed is rude as well as slow. The cache
 * lives under `out/`, which is git-ignored; deleting it costs one refetch.
 */
async function coverBytes(cover: Cover): Promise<Uint8Array> {
  const file = path.join(CACHE_DIR, `${cover.id.replace(/[^a-z0-9]/gi, '_')}.img`);
  try {
    return new Uint8Array(await readFile(file));
  } catch {
    const bytes = await fetchBytes(cover.urlSmall ?? cover.url, { timeoutMs: 15_000, revalidate: 0 });
    await writeFile(file, bytes);
    return bytes;
  }
}

/** Downloads with a small pool; a cover that will not load is simply left out. */
async function fetchAll(covers: readonly Cover[], concurrency = 8): Promise<Map<string, Uint8Array>> {
  await mkdir(CACHE_DIR, { recursive: true });
  const out = new Map<string, Uint8Array>();
  const queue = [...covers];
  const worker = async () => {
    while (queue.length > 0) {
      const cover = queue.shift()!;
      try {
        out.set(cover.id, await coverBytes(cover));
      } catch {
        // Left out on purpose: a missing cover costs one tile, and stopping
        // the run over it would cost the picture.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, covers.length) }, worker));
  return out;
}

/**
 * The picture the covers have to add up to.
 *
 * `auto` takes the book's own best-known jacket at full size — deliberately
 * refetched rather than reused from the tiles, whose medium images are six
 * pixels per cell and would leave the target a blur.
 */
async function targetImage(option: string, covers: readonly Cover[], signatures: ReadonlyMap<string, ImageSignature>): Promise<{ image: RgbaImage; what: string }> {
  let bytes: Uint8Array;
  let what: string;
  if (option === 'auto') {
    // The book's own best-known jacket — but **contrast decides**, not how
    // many editions carry it. Picking by edition count on Nineteen
    // Eighty-Four chose a jacket whose luminance spans 57 to 90 of 255
    // (measured 2026-09-08): a nearly flat picture, and a mosaic of it is a
    // wall of covers with no motif in it. A target has to have light and dark.
    const ranked = [...covers]
      .filter(c => (signatures.get(c.id)?.contrast ?? 0) > 0)
      .sort((a, b) => (signatures.get(b.id)!.contrast) - (signatures.get(a.id)!.contrast));
    const best = ranked[0];
    if (!best) throw new Error('no covers to pick a target from');
    bytes = await fetchBytes(best.url, { timeoutMs: 15_000, revalidate: 0 });
    what = `${best.id} (the most contrasted jacket, contrast ${Math.round(signatures.get(best.id)!.contrast)})`;
  } else if (/^https?:/.test(option)) {
    bytes = await fetchBytes(option, { timeoutMs: 20_000, revalidate: 0 });
    what = option;
  } else {
    bytes = new Uint8Array(await readFile(option));
    what = option;
  }
  const image = decode(bytes);
  if (!image) throw new Error(`could not decode the target picture: ${what}`);
  return { image, what };
}

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const started = Date.now();
  console.log(`work ${options.work}, ${options.cols} covers across`);

  const { covers, editions, title } = await loadCovers(options.work, options.maxPages);
  console.log(`${title}: ${covers.length} covers on record, ${editions.length} editions`);

  const bytes = await fetchAll(covers);
  console.log(`${bytes.size} cover images loaded`);

  const signatures = new Map<string, ImageSignature>();
  for (const [id, data] of bytes) {
    const sig = signature(data);
    if (sig) signatures.set(id, sig);
  }

  // One tile per design, not per scan: the same rule the cover wall uses.
  const folded = foldDuplicateCovers(covers.filter(c => bytes.has(c.id)), signatures, editions);
  const usable = folded.filter(c => !looksLikeScannedPage(signatures.get(c.id)));
  console.log(`${folded.length} designs after folding, ${usable.length} after dropping scanned pages`);

  const tiles: Tile[] = [];
  const decoded = new Map<string, RgbaImage>();
  for (const cover of usable) {
    const image = decode(bytes.get(cover.id)!);
    if (!image) continue;
    decoded.set(cover.id, image);
    tiles.push(tileOf(cover.id, image));
  }
  console.log(`${tiles.length} tiles`);

  const { image: target, what } = await targetImage(options.target, usable, signatures);
  console.log(`target: ${what}`);

  // A cell is one cover, so it is 2:3. The number of rows that keeps the
  // target undistorted follows from that and the target's own shape.
  const rows = options.rows > 0
    ? options.rows
    : Math.max(1, Math.round((options.cols / CELL_ASPECT) * (target.height / target.width)));
  console.log(`grid ${options.cols}x${rows}${options.rows > 0 ? '' : ' (rows from the target shape)'}`);

  const grid = patchesOf(target, options.cols, rows);
  const palette = paletteReport(grid, tiles);
  console.log(
    `palette: covers ${round(palette.tileLum.min)}..${round(palette.tileLum.max)} (sd ${round(palette.tileLum.sd)}), `
    + `picture ${round(palette.cellLum.min)}..${round(palette.cellLum.max)} (sd ${round(palette.cellLum.sd)})`,
  );
  console.log(
    `out of reach: ${round(palette.outOfRange * 100)}% of cells as measured, `
    + `${round(palette.outOfRangeNormalised * 100)}% after stretching the palette`,
  );

  const mosaic = assign(grid, tiles, {
    minGap: options.minGap,
    colourWeight: options.colourWeight,
    normalise: options.normalise,
  });
  const usage = [...mosaic.usage.values()];
  const most = Math.max(...usage);
  console.log(
    `assigned: mean distance ${round(mosaic.meanDistance)}, worst ${round(mosaic.maxDistance)}, `
    + `${mosaic.relaxed} cells had to repeat a neighbour`,
  );
  console.log(
    `variety: ${usage.filter(n => n > 0).length} of ${tiles.length} covers used, `
    + `most-used holds ${round((most / (options.cols * rows)) * 100)}% of cells`,
  );

  const cellWidth = Math.max(1, Math.round(options.width / options.cols));
  const cellHeight = Math.round(cellWidth * CELL_ASPECT);
  const picture = compose(mosaic, decoded, { cellWidth, cellHeight, blend: options.blend, target });

  const png = new PNG({ width: picture.width, height: picture.height });
  png.data = Buffer.from(picture.rgba);
  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(options.out, PNG.sync.write(png));
  console.log(`wrote ${options.out}, ${picture.width}x${picture.height}, blend ${options.blend}`);
  console.log(`took ${round((Date.now() - started) / 1000)}s`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

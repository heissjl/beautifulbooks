/**
 * Builds one mosaic and writes it as a PNG (lab/mosaic/README.md).
 *
 * Run:
 *   npx tsx lab/mosaic/render.ts --work OL1168083W
 *   npx tsx lab/mosaic/render.ts --author "george orwell" --target <portrait url>
 *   npx tsx lab/mosaic/render.ts --work OL1168083W,OL27258W --cols 48
 *
 * The loading and caching live in `covers.ts`, the decisions in `mosaic.ts`,
 * which is pure and tested. This file is the command line and the PNG.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import { loadPalette, targetImage, worksOfAuthor } from './covers';
import { assign, compose, paletteReport, patchesOf } from './mosaic';

/** A cover is half again as tall as it is wide, and so is a cell. */
const CELL_ASPECT = 1.5;

interface Options {
  works: string[];
  author: string;
  maxWorks: number;
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
  const author = flags.get('author') ?? '';
  const works = (flags.get('work') ?? (author ? '' : 'OL1168083W')).split(',').map(s => s.trim()).filter(Boolean);
  const slug = author ? author.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : works.join('-');
  return {
    works,
    author,
    /** Enough books to widen the palette, few enough to stay one author's work. */
    maxWorks: num('max-works', 8),
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
    out: flags.get('out') ?? path.join('lab', 'mosaic', 'out', `${slug}.png`),
    maxPages: num('max-pages', 12),
    colourWeight: num('colour-weight', 0.6),
    minGap: num('min-gap', 1),
    normalise: (flags.get('normalise') ?? 'true') !== 'false',
  };
}

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const log = (line: string) => console.log(line);

  const workIds = options.author
    ? (await worksOfAuthor(options.author, options.maxWorks, log)).map(w => w.id)
    : options.works;
  const { tiles, images, covers, signatures, incomplete } = await loadPalette(workIds, options.maxPages, log);
  console.log(
    `${tiles.length} tiles from ${workIds.length} work${workIds.length === 1 ? '' : 's'}`
    + (incomplete > 0 ? `, ${incomplete} of them incomplete because Open Library stopped answering` : ''),
  );

  const { image: target, what } = await targetImage(options.target, covers, signatures);
  console.log(`target: ${what}`);

  // A cell is one cover, so it is 2:3. The number of rows that keeps the
  // target undistorted follows from that and the target's own shape.
  const rows = options.rows > 0
    ? options.rows
    : Math.max(1, Math.round((options.cols / CELL_ASPECT) * (target.height / target.width)));
  const cells = options.cols * rows;
  console.log(`grid ${options.cols}x${rows}${options.rows > 0 ? '' : ' (rows from the target shape)'}, ${cells} cells`);

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
  const used = usage.filter(n => n > 0).length;
  console.log(
    `assigned: mean distance ${round(mosaic.meanDistance)}, worst ${round(mosaic.maxDistance)}, `
    + `${mosaic.relaxed} cells had to repeat a neighbour`,
  );
  console.log(
    `variety: ${used} of ${tiles.length} covers used, `
    + `${round(cells / Math.max(1, used))} cells each on average, `
    + `most-used holds ${round((Math.max(...usage) / cells) * 100)}% of cells`,
  );

  const cellWidth = Math.max(1, Math.round(options.width / options.cols));
  const cellHeight = Math.round(cellWidth * CELL_ASPECT);
  const picture = compose(mosaic, images, { cellWidth, cellHeight, blend: options.blend, target });

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

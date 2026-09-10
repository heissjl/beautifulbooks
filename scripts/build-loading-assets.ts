/**
 * Copies the loading mosaics from the lab into the website (ROADMAP 6.19a).
 *
 *   npx tsx scripts/build-loading-assets.ts
 *
 * The pictures are built offline by `lab/loading/build-all.ts`, which is the
 * part that talks to Open Library and takes a quarter of an hour. This is the
 * promotion step: it reads what the lab produced and writes `public/loading/`,
 * which is committed and is all the website ever needs.
 *
 * **It trims the manifest on the way.** The lab ships the fill orders
 * precomputed because its pages have no bundler; the site derives them from
 * the luminance map in about a millisecond (`lib/loading.ts`), which is the
 * difference between 18 KB of JSON per template and 3.
 *
 * Nothing here is imported by the website, and the website does not need
 * `lab/` to build: `public/loading/` is committed.
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MosaicEntry, MosaicManifest } from '../lib/loading';

const FROM = path.join('lab', 'loading', 'out');
const TO = path.join('public', 'loading');

interface LabManifest {
  id: string;
  author: string;
  tiles: number;
  works: { id: string; title: string; editions: number }[];
  portrait: { source: string; credit: string };
  grids: {
    cols: number;
    rows: number;
    lum: string;
    images: { file: string; width: number; height: number; cellWidth: number; cellHeight: number; bytes: number }[];
  }[];
}

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

async function main() {
  const index = JSON.parse(await readFile(path.join(FROM, 'index.json'), 'utf8')) as { id: string; author: string; file: string }[];
  if (index.length === 0) throw new Error('nothing built; run lab/loading/build-all.ts first');

  // Written fresh every time, so a template dropped from the rotation does
  // not linger in the deployment as a file nothing points at.
  await rm(TO, { recursive: true, force: true });
  await mkdir(TO, { recursive: true });

  const rotation: MosaicEntry[] = [];
  let jsonBytes = 0;
  let imageBytes = 0;

  for (const entry of index) {
    const lab = JSON.parse(await readFile(path.join(FROM, entry.file), 'utf8')) as LabManifest;
    const grid = lab.grids[0];
    if (lab.grids.length > 1) {
      // One grid per template, or the site would have to choose between them
      // at runtime for no reason a reader could see.
      throw new Error(`${lab.id} has ${lab.grids.length} grids; the site takes one`);
    }
    const manifest: MosaicManifest = {
      id: lab.id,
      author: lab.author,
      tiles: lab.tiles,
      works: lab.works.length,
      credit: lab.portrait.credit,
      cols: grid.cols,
      rows: grid.rows,
      lum: grid.lum,
      images: grid.images.map(im => ({
        file: im.file, width: im.width, height: im.height,
        cellWidth: im.cellWidth, cellHeight: im.cellHeight, bytes: im.bytes,
      })),
    };
    const json = `${JSON.stringify(manifest)}\n`;
    await writeFile(path.join(TO, `${lab.id}.json`), json);
    jsonBytes += json.length;
    for (const image of grid.images) {
      const bytes = await readFile(path.join(FROM, image.file));
      await writeFile(path.join(TO, image.file), bytes);
      imageBytes += bytes.length;
    }
    rotation.push({ id: lab.id, author: lab.author });
    console.log(
      `${lab.id.padEnd(24)} ${String(lab.tiles).padStart(5)} covers, `
      + `${grid.images.map(im => `${round(im.bytes / 1024)} KB`).join(' / ')}, manifest ${round(json.length / 1024)} KB`,
    );
  }

  const indexJson = `${JSON.stringify(rotation)}\n`;
  await writeFile(path.join(TO, 'index.json'), indexJson);
  const written = (await readdir(TO)).length;
  console.log(
    `\n${rotation.length} templates, ${written} files in ${TO}: `
    + `${round(imageBytes / 1024 / 1024, 2)} MB of pictures, ${round((jsonBytes + indexJson.length) / 1024)} KB of JSON. `
    + `A reader fetches the index, one manifest and one picture.`,
  );
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

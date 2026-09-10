/**
 * Builds the whole rotation: twenty loading pictures from `templates.json`
 * (lab/loading/README.md, ROADMAP 6.19a).
 *
 *   npx tsx lab/loading/build-all.ts --check     # which works Open Library gives, no downloads
 *   npx tsx lab/loading/build-all.ts             # build what is missing
 *   npx tsx lab/loading/build-all.ts --force     # build everything again
 *   npx tsx lab/loading/build-all.ts --only mark-twain,jules-verne
 *
 * **The settings are the whole point of this file** and they are argued for
 * in the README: one grid of 40 columns, two widths, quality 50. A loading
 * picture is looked at for two seconds on a phone that is also waiting for a
 * search, so it is bought at the price of bytes, not of sharpness.
 *
 * A template that fails — Open Library silent, no work whose primary author
 * is that person — is **reported and skipped**, never quietly left out of the
 * summary. The rotation is only as long as the summary says it is.
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { worksOfAuthor } from '../mosaic/covers';
import { buildTemplate, type Manifest, type Options } from './template';
import type { Template } from './portraits';

const TEMPLATES = path.join('lab', 'loading', 'templates.json');
const OUT_DIR = path.join('lab', 'loading', 'out');

/**
 * What every picture of the rotation is built with.
 *
 * - **40 columns**: at 24 a cell is comfortably a book and the face is gone;
 *   40 is where both just work, measured on Mark Twain at 300 to 440 px.
 * - **480 and 640 px**: the phone frame is about 260 px and the desktop one
 *   about 420, and only one of the two files is ever fetched. Above 640 the
 *   bytes double for sharpness nobody sees in a picture made of noise.
 * - **quality 50**: at 1:1 the difference to 65 is a slight softening and
 *   costs 25 % more; at the size this is shown, there is nothing in it.
 * - **colour weight 0.15**: these are grey photographs, and the default 0.6
 *   makes saturated covers expensive and the motif muddy.
 * - **3:4**: every picture the same shape, so the frame a search waits in
 *   does not change size when the rotation turns; and a portrait cut to the
 *   head spends its cells on a face rather than on a coat.
 */
const SETTINGS = {
  cols: [40],
  widths: [480, 640],
  quality: 50,
  colourWeight: 0.15,
  maxWorks: 8,
  maxPages: 12,
  aspect: 3 / 4,
};

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

interface Row {
  id: string;
  author: string;
  tiles: number;
  contrast: number;
  meanDistance: number;
  coversUsed: number;
  bytes: number[];
  failed?: string;
}

function table(rows: Row[]): string {
  const line = (r: Row) => (r.failed
    ? `${r.id.padEnd(22)} ${'—'.padStart(6)} ${r.failed}`
    : `${r.id.padEnd(22)} ${String(r.tiles).padStart(6)} ${String(r.contrast).padStart(8)}`
      + `${r.contrast < 45 ? ' !' : '  '}${String(r.meanDistance).padStart(8)} `
      + `${String(r.coversUsed).padStart(7)} ${r.bytes.map(b => `${round(b / 1024)} KB`).join(' / ').padStart(18)}`);
  return [
    `${'id'.padEnd(22)} ${'tiles'.padStart(6)} ${'contrast'.padStart(8)}  ${'distance'.padStart(8)} ${'used'.padStart(7)} ${'bytes'.padStart(18)}`,
    ...rows.map(line),
  ].join('\n');
}

async function check(templates: Template[]) {
  for (const t of templates) {
    try {
      const works = await worksOfAuthor(t.openLibrary ?? t.author, t.maxWorks ?? SETTINGS.maxWorks, () => {});
      const editions = works.reduce((sum, w) => sum + w.editionCount, 0);
      console.log(
        `${t.id.padEnd(22)} ${String(works.length).padStart(2)} works, `
        + `${String(editions).padStart(5)} editions — ${works[0].author}`,
      );
    } catch (err) {
      console.log(`${t.id.padEnd(22)} FAILED: ${(err as Error).message}`);
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const onlyAt = argv.indexOf('--only');
  const only = onlyAt >= 0 ? new Set((argv[onlyAt + 1] ?? '').split(',').map(s => s.trim())) : null;

  const all = JSON.parse(await readFile(TEMPLATES, 'utf8')) as Template[];
  const wanted = all
    .filter(t => t.rotation !== false && t.target && !t.skipped)
    .filter(t => !only || only.has(t.id));
  console.log(`${wanted.length} templates in the rotation`);

  if (argv.includes('--check')) {
    await check(wanted);
    return;
  }

  const started = Date.now();
  const rows: Row[] = [];
  for (const [i, t] of wanted.entries()) {
    const done = await exists(path.join(OUT_DIR, `${t.id}.json`));
    if (done && !force) {
      const manifest = JSON.parse(await readFile(path.join(OUT_DIR, `${t.id}.json`), 'utf8')) as Manifest;
      rows.push({
        id: t.id, author: manifest.author, tiles: manifest.tiles,
        contrast: manifest.grids[0].targetContrast, meanDistance: manifest.grids[0].meanDistance,
        coversUsed: manifest.grids[0].coversUsed, bytes: manifest.grids[0].images.map(im => im.bytes),
      });
      console.log(`\n[${i + 1}/${wanted.length}] ${t.id}: already built`);
      continue;
    }
    console.log(`\n[${i + 1}/${wanted.length}] ${t.id} — ${t.author}`);
    const options: Options = {
      ...SETTINGS,
      // The catalogue's spelling for the search, ours for the caption.
      author: t.openLibrary ?? t.author,
      name: t.author,
      works: [], id: t.id, target: t.target, credit: t.credit, crop: t.crop,
      maxWorks: t.maxWorks ?? SETTINGS.maxWorks,
    };
    try {
      const manifest = await buildTemplate(options);
      rows.push({
        id: t.id, author: manifest.author, tiles: manifest.tiles,
        contrast: manifest.grids[0].targetContrast, meanDistance: manifest.grids[0].meanDistance,
        coversUsed: manifest.grids[0].coversUsed, bytes: manifest.grids[0].images.map(im => im.bytes),
      });
    } catch (err) {
      // A source that said nothing is not a template that cannot be built;
      // it is a template we do not know about yet, and the summary says so.
      rows.push({ id: t.id, author: t.author, tiles: 0, contrast: 0, meanDistance: 0, coversUsed: 0, bytes: [], failed: (err as Error).message });
      console.log(`  FAILED: ${(err as Error).message}`);
    }
  }

  const built = rows.filter(r => !r.failed);
  /*
    The index **is** the rotation, so it is written from what this run built
    rather than added to. A template taken out of `templates.json` has to
    disappear from the rotation, or the site keeps offering a picture that
    nothing points at any more.
  */
  await writeFile(
    path.join(OUT_DIR, 'index.json'),
    `${JSON.stringify(built.map(r => ({ id: r.id, author: r.author, file: `${r.id}.json` })), null, 1)}\n`,
  );
  const totalBytes = built.reduce((sum, r) => sum + r.bytes.reduce((a, b) => a + b, 0), 0);
  console.log(`\n${table(rows)}`);
  const phone = built.map(r => r.bytes[0]).filter(b => b > 0);
  console.log(
    `\n${built.length} of ${wanted.length} built in ${round((Date.now() - started) / 60_000)} min.`
    + (phone.length === 0 ? '' : ` On disk ${round(totalBytes / 1024 / 1024, 2)} MB for all of them; `
      + `a reader fetches one, ${round(Math.min(...phone) / 1024)}–${round(Math.max(...phone) / 1024)} KB on a phone.`),
  );
  const thin = built.filter(r => r.contrast < 45);
  if (thin.length > 0) {
    /*
      A reason to look, not a verdict.

      Measured over the twenty: Tolstoy's colour photograph of 1908 sat at 42
      and showed no face, and swapping it for a portrait at 63 fixed it — but
      Whitman sits at 36, the lowest of all, and reads perfectly, because his
      contrast is in his beard and Tolstoy's was in a tree. **What matters is
      whether the light and dark are in the face**, and no number here knows
      that. Four of the twenty are marked and three of them are fine.
    */
    console.log(
      `marked !: ${thin.map(r => r.id).join(', ')} — little light and dark in the portrait. `
      + 'A reason to look at them, not a verdict: it was right about one of five.',
    );
  }
  const failed = rows.filter(r => r.failed);
  if (failed.length > 0) console.log(`${failed.length} failed: ${failed.map(r => r.id).join(', ')}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

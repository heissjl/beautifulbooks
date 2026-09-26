/**
 * 5.10i, step 2: stage one cover per remaining work for upload to Open Library.
 *
 *   npx tsx lab/international-covers/stage.ts
 *
 * Reads `picks.json` (chosen by hand from `discovered.json`, after looking at
 * each image), downloads each image once into
 * lab/collections/for-openlibrary/international/ (git-ignored), measures it,
 * asks Open Library whether the edition exists, and writes `manifest.json`
 * there in the shape of the relaunch manifest. Julian uploads from his
 * signed-in browser; nothing here writes to Open Library.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { repairName } from '../isfdb/parse';
import { IMAGE_DIR, img, isfdb, ol } from './lookup';

export interface Pick {
  order: number;
  language: string;
  translatedTitle: string;
  isbn: string | null;
  publisher: string;
  year: string;
  imageSource: string;
  imageOrigin: 'isfdb' | 'dnb' | 'commons' | 'openlibrary';
  isfdbRecord?: string;
  /** An OL work other than the relaunch work that the translation already sits in. */
  olWorkSuggested?: string;
  sameContent?: string;
  note?: string | null;
}

const dir = import.meta.dirname;
const list: { order: number; id: string; title: string; author: string }[] =
  JSON.parse(readFileSync(join(dir, '..', 'collections', 'lists', 'sf-relaunch-international.json'), 'utf8'));

function size(buf: Buffer): { width: number; height: number } {
  if (buf[0] === 0x89) { const p = PNG.sync.read(buf); return { width: p.width, height: p.height }; }
  const j = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 });
  return { width: j.width, height: j.height };
}

async function main() {
  const picks: Pick[] = JSON.parse(readFileSync(join(dir, 'picks.json'), 'utf8'));
  const out = [];
  const failed: number[] = [];
  for (const p of picks.sort((a, b) => a.order - b.order)) {
    const w = list.find(x => x.order === p.order)!;
    const ext = /\.png($|\?)/i.test(p.imageSource) ? 'png' : 'jpg';
    const file = `${String(p.order).padStart(3, '0')}-${p.language}-${p.isbn ?? 'noisbn'}.${ext}`;
    try {
      await img(p.imageSource, file);
    } catch (err) {
      // A download that failed is not a missing cover (N12): listed, tried again next run.
      console.log(p.order, w.title, 'download failed:', err instanceof Error ? err.message : err);
      failed.push(p.order);
      continue;
    }
    const { width, height } = size(readFileSync(join(IMAGE_DIR, file)));
    let olEdition: string | null = null, olWorks: string[] = [], olCovers: number[] = [];
    if (p.isbn) {
      const r = await ol(p.isbn);
      if (r.edition) { olEdition = r.edition; olWorks = (r.works ?? []).map((x: { key: string }) => x.key.replace('/works/', '')); olCovers = r.covers ?? []; }
    }
    let coverArtist: string[] = [];
    if (p.isbn && p.isfdbRecord) {
      const r = await isfdb(p.isbn);
      const pub = r.publications.find(x => x.record === p.isfdbRecord) ?? r.publications[0];
      // ISFDB's REST answer has already lost every non-ASCII letter; a name that cannot be repaired is left out (lab/isfdb).
      coverArtist = (pub?.artists ?? []).map(repairName).filter((a): a is string => a !== null);
    }
    out.push({
      order: p.order,
      relaunchWork: w.id,
      title: w.title,
      author: w.author,
      language: p.language,
      translatedTitle: p.translatedTitle,
      isbn: p.isbn,
      publisher: p.publisher,
      year: p.year,
      file,
      width,
      height,
      imageSource: p.imageSource,
      imageOrigin: p.imageOrigin,
      isfdbRecord: p.isfdbRecord ?? null,
      olEdition,
      olEditionWorks: olWorks,
      olEditionCovers: olCovers,
      /*
        upload-new-edition: OL has no edition for this ISBN; create it under olWork, then add the image.
        upload-cover: the edition exists without a cover, or with a worse or wrong one (see note).
        map-work: the edition and this cover are on OL already, in a separate work record;
          nothing to upload — a line in translations.json (or a merge on OL) brings it to the wall.
        attach-edition: the edition has the cover but belongs to no work.
      */
      action: !olEdition ? 'upload-new-edition'
        : !olCovers.length || p.imageOrigin !== 'openlibrary' ? 'upload-cover'
        : !olWorks.length ? 'attach-edition'
        : olWorks.includes(w.id) ? 'already-in-work' : 'map-work',
      olWork: olWorks[0] ?? w.id,
      translationsJsonEntry: olWorks.length && !olWorks.includes(w.id) ? { [olWorks[0]]: w.id } : null,
      coverArtist,
      coverArtistFrom: coverArtist.length ? `isfdb:${p.isfdbRecord} (the printing under this ISBN)` : null,
      sameContent: p.sameContent ?? null,
      note: p.note ?? null,
    });
    console.log(p.order, w.title, p.language, `${width}x${height}`, olEdition ?? 'new edition');
  }
  if (failed.length) console.log('failed downloads:', failed.join(' '));
  // The image folder is git-ignored; the committed copy beside this script keeps the record.
  writeFileSync(join(IMAGE_DIR, 'manifest.json'), JSON.stringify(out, null, 1) + '\n');
  writeFileSync(join(dir, 'staged-manifest.json'), JSON.stringify(out, null, 1) + '\n');
}

main();

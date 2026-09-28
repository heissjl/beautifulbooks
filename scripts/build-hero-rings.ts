/**
 * Writes data/hero-rings.json: a ring of seven covers for every curated work
 * the cover index can fill (ROADMAP 1.9), and a ring of seven books for every
 * published collection with enough covers (ROADMAP 6.59). The rules are in
 * lib/heroring.ts.
 *
 * Run it after the index, the curated list or data/collections.json changes,
 * and commit the result. A test fails when the committed file no longer
 * matches what the rules give for the committed inputs, so a stale file is
 * caught before the home page shows a ring that breaks them. The file carries
 * no timestamp for the same reason: it must compare equal.
 *
 * **Collection covers are mostly not in the cover index** (on 2026-09-26,
 * 26 of the 644 on the six collections that qualify), so their signatures
 * are measured here, once, and kept in data/hero-ring-signatures.json, which
 * is committed: a second run, and the test, need no network. Only covers
 * missing from both the index and that file are fetched — the M image from
 * covers.openlibrary.org, three at a time, with the cover index's retries
 * (archive.org throttles in bursts).
 * A cover that will not load is simply absent and is tried again next run.
 * `--offline` skips the fetching and picks from what is already known.
 *
 * **It builds from the file, not from the running site.** Drafts published
 * on /curate and publish switches live in Redis (lib/collections-live.ts)
 * and may differ from data/collections.json; the home page therefore shows a
 * collection ring only while that collection is published on the running
 * site (app/page.tsx passes the live slugs), and the ring's covers are the
 * file's.
 *
 * Usage: npx tsx scripts/build-hero-rings.ts [--offline]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { collectionRecords, parseCollections } from '../lib/collections';
import { CURATED_LIST } from '../lib/curated';
import {
  collectionRingsFor,
  ringCollections,
  COLLECTION_RING_MIN_COVERS,
  COLLECTION_RING_MIN_COLOUR,
  ringsFor,
  RING_MIN_BITS,
  RING_MIN_COLOUR,
  RING_SIZE,
  signatureMap,
  type CoverIndexFile,
  type SignatureFile,
} from '../lib/heroring';
import { signature } from '../lib/imagehash';
import { olCoverUrl } from '../lib/sources/openlibrary-parse';

const OFFLINE = process.argv.includes('--offline');
const CONCURRENCY = 3;

const data = path.join(process.cwd(), 'data');
const SIGNATURES = path.join(data, 'hero-ring-signatures.json');
const index = JSON.parse(readFileSync(path.join(data, 'cover-index.json'), 'utf8')) as CoverIndexFile;
const rings = ringsFor(index, CURATED_LIST);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function loadSignatures(): SignatureFile {
  return existsSync(SIGNATURES) ? (JSON.parse(readFileSync(SIGNATURES, 'utf8')) as SignatureFile) : { covers: {} };
}

function saveSignatures(file: SignatureFile) {
  // Sorted, so that a rerun that measures nothing new writes the same bytes.
  const covers = Object.fromEntries(Object.entries(file.covers).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(SIGNATURES, JSON.stringify({ covers }, null, 0).replace(/\],"/g, '],\n"') + '\n');
}

/** One image, three tries with a growing pause, as in scripts/build-cover-index.ts. */
async function image(url: string): Promise<Uint8Array | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(5000 * attempt * attempt);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      if (res.status === 404) return null;
    } catch {
      // try again
    }
  }
  return null;
}

async function measure(coverIds: string[], file: SignatureFile): Promise<number> {
  const queue = [...coverIds];
  let done = 0;
  let failed = 0;
  const worker = async () => {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      const bytes = await image(olCoverUrl(Number(id.slice(3)), 'M'));
      const sig = bytes ? signature(bytes, { colour: true }) : null;
      if (sig?.hues && sig.saturation !== undefined && sig.mean !== undefined) {
        file.covers[id] = [sig.hash, Math.round(sig.contrast), Math.round(sig.mean), sig.saturation, sig.hues];
      } else failed++;
      if (++done % 25 === 0) {
        saveSignatures(file);
        process.stdout.write(`  ${done}/${coverIds.length}\r`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, coverIds.length) }, worker));
  saveSignatures(file);
  return failed;
}

async function main() {
  const collections = ringCollections(parseCollections(collectionRecords(), { includeDrafts: false }));
  const file = loadSignatures();
  const known = signatureMap(index, file);
  const missing = [...new Set(collections.flatMap(c => c.works.map(w => `ol:${w.coverId}`)))].filter(id => !known.has(id));
  if (missing.length > 0 && !OFFLINE) {
    console.log(`measuring ${missing.length} collection covers from Open Library, ${CONCURRENCY} at a time`);
    const failed = await measure(missing, file);
    if (failed > 0) console.log(`${failed} would not load; they stay off the rings until a later run reads them`);
  } else if (missing.length > 0) {
    console.log(`--offline: ${missing.length} collection covers have no signature and cannot stand on a ring`);
  }

  const collectionRings = collectionRingsFor(collections, signatureMap(index, loadSignatures()));
  const out = {
    rules: { size: RING_SIZE, minBits: RING_MIN_BITS, minColour: RING_MIN_COLOUR },
    collectionRules: { minCovers: COLLECTION_RING_MIN_COVERS, minColour: COLLECTION_RING_MIN_COLOUR },
    rings,
    collectionRings,
  };
  writeFileSync(path.join(data, 'hero-rings.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`${rings.length} of ${CURATED_LIST.length} curated works have a ring of ${RING_SIZE}`);
  console.log(
    `${collectionRings.length} of ${collections.length} published collections with ${COLLECTION_RING_MIN_COVERS}+ covers have one: ` +
      collectionRings.map(r => r.slug).join(', '),
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

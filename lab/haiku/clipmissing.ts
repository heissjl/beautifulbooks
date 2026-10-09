/**
 * ROADMAP 6.102a: give every index cover a CLIP vector (Julian, 2026-10-09: "yes, run it"). Images from
 * covers.openlibrary.org by id, four at a time; the cache in lab/clip/out keeps what is done, so a stopped run resumes.
 *
 *   npx tsx lab/haiku/clipmissing.ts
 */
import { readFileSync } from 'node:fs';
import { embedCovers } from '../clip/clip';

const { covers } = JSON.parse(readFileSync('data/cover-index.json', 'utf8')) as { covers: Array<[number, string]> };
const started = Date.now();
embedCovers(covers.map((c) => c[1]), 4).then((got) => {
  const ok = [...got.values()].filter(Boolean).length;
  console.log(`${ok} of ${covers.length} with a vector, ${Math.round((Date.now() - started) / 1000)} s`);
});

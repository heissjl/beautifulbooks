/**
 * The teacher: a CLIP vector for every cover of the index, the targets the
 * student net learns to reproduce. Run once, offline, about an hour.
 *
 *   npx tsx lab/distill/teacher.ts [--only-outside]
 *
 * Reuses lab/clip's image and vector cache (lab/clip/out/, git-ignored), so
 * the 2,523 covers measured there are not fetched again. Writes nothing of its
 * own: train.py reads the vector cache directly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { embedCovers } from '../clip/clip';

const ROOT = join(__dirname, '..', '..');

async function main() {
  const index = JSON.parse(readFileSync(join(ROOT, 'data/cover-index.json'), 'utf8')) as {
    covers: Array<[number, string, ...unknown[]]>;
  };
  const ids = index.covers.map((c) => c[1]);
  const started = Date.now();
  const vectors = await embedCovers(ids);
  const got = [...vectors.values()].filter(Boolean).length;
  console.log(`${got} of ${ids.length} index covers have a vector, ${vectors.size - got} have no image, ${ids.length - vectors.size} failed and will be retried; ${Math.round((Date.now() - started) / 1000)} s`);
}

main();

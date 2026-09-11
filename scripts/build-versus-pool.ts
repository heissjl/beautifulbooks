/**
 * Freezes the cover game's pool into data/versus-pool.json (ROADMAP 5.8a).
 *
 *   npx tsx scripts/build-versus-pool.ts
 *
 * Frozen rather than built per request: the votes in the store name covers,
 * and a pool that shifted with the next build of the index would orphan them.
 * Built data in the repository, read-only at run time — allowed by E18.
 *
 * One cover from each of a hundred books, the same draw the lab played
 * (`mix-100-paperwhite`), minus the covers a person has already judged not to
 * be covers. A book that loses its cover that way gets another of its own.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPool, poolName, type PoolOptions, type RawIndex } from '../lib/hotornot/pool';

const ROOT = join(import.meta.dirname, '..');

const EXCLUDED = [
  {
    id: 'ol:10942061',
    reason: 'A Slaughterhouse-Five reading guide with "Note: This is not the actual book cover" printed on it; '
      + 'taken out with the "not a cover" button in the lab test, 2026-09-11.',
  },
];

const options: PoolOptions = { mode: 'mix', size: 100, seed: 'paperwhite', exclude: EXCLUDED.map(e => e.id) };
const index = JSON.parse(readFileSync(join(ROOT, 'data', 'cover-index.json'), 'utf8')) as RawIndex;
const covers = buildPool(index, options);

const out = {
  name: poolName(options),
  builtAt: new Date().toISOString().slice(0, 10),
  indexBuiltAt: index.builtAt,
  excluded: EXCLUDED,
  covers,
};
writeFileSync(join(ROOT, 'data', 'versus-pool.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(`${out.name}: ${covers.length} covers from ${new Set(covers.map(c => c.workId)).size} books, ${EXCLUDED.length} excluded`);

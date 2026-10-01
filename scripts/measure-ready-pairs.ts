/**
 * What the three pairs that come with /versus cost to build (ROADMAP 6.82).
 *
 *   npx tsx scripts/measure-ready-pairs.ts
 *
 * The page is dynamic, so this runs on every visit: with the pool at 5,012
 * covers it is worth knowing whether it is microseconds or a tenth of a
 * second. No network, no store — the pool is frozen in the repository (E18).
 */
import { POOL, readyPairs } from '../lib/hotornot/game';
import { pairSecret } from '../lib/hotornot/token';

const secret = pairSecret(undefined);
const runs = 20;
readyPairs(secret, 3, { store: 'memory' }); // warm the module
const times: number[] = [];
for (let i = 0; i < runs; i++) {
  const t = performance.now();
  readyPairs(secret, 3, { store: 'memory' });
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
const median = times[Math.floor(runs / 2)];
console.log(`pool ${POOL.name}: ${POOL.covers.length} covers`);
console.log(`readyPairs(3): median ${median.toFixed(1)} ms, fastest ${times[0].toFixed(1)} ms, slowest ${times[runs - 1].toFixed(1)} ms`);

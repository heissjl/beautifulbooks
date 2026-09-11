/**
 * The forecast table for lab/hotornot (ROADMAP 5.8, Spielart 4).
 *
 *   npx tsx lab/hotornot/simulate.ts             # the full grid, 20 runs a row
 *   npx tsx lab/hotornot/simulate.ts --hold 3    # a crown counts after three checks in a row
 *   npx tsx lab/hotornot/simulate.ts --runs 5    # quicker, coarser
 *   npx tsx lab/hotornot/simulate.ts --quick     # one pool size, to check it runs
 *
 * Two questions per end: when is the true ugliest cover actually at the
 * bottom of the fit ("gefunden"), and when would the board first say "this is
 * the ugliest" ("Urteil") — and how often was that first claim wrong. The
 * second pair decides whether anything may be posted.
 *
 * No network and no randomness outside the seeds: the same command prints
 * the same table. Output is Markdown, in German, for docs/history.md.
 */
import { simulate, type SimOptions, type SimResult } from './sim';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const quick = process.argv.includes('--quick');
const POOLS = quick ? [50] : [50, 100, 200, 400];
const NOISES = quick ? [1] : [0.5, 1, 2];
const STRATEGIES: Array<SimOptions['strategy']> = ['random', 'adaptive'];
const RUNS = Number(arg('runs') ?? (quick ? 3 : 20));
const HOLD = Number(arg('hold') ?? 1);
/** A cap, not a target: sixty votes for every cover is already a lot of clicking. */
const PER_COVER = 60;

const pct = (x: number) => `${Math.round(x * 100)} %`;
const thousands = (n: number) => n.toLocaleString('de-DE');
const label = (s: SimOptions['strategy']) => (s === 'adaptive' ? 'gezielt' : 'zufällig');

/** Median over the runs, a run that never got there counting as "later than the cap". */
function median(pool: number, values: Array<number | null>): string {
  const sorted = values.map(v => v ?? Infinity).sort((x, y) => x - y);
  const mid = sorted[Math.floor((sorted.length - 1) / 2)];
  if (!Number.isFinite(mid)) return `nicht in ${PER_COVER}/Cover`;
  return `${thousands(mid)} (${Math.round(mid / pool)}/Cover)`;
}

function wrong(claims: Array<boolean | null>): string {
  const made = claims.filter((c): c is boolean => c !== null);
  return made.length ? `${made.filter(c => !c).length} von ${made.length}` : '–';
}

const claims = { adaptive: { made: 0, wrong: 0 }, random: { made: 0, wrong: 0 } };
const started = Date.now();

console.log(`Eine Krone zählt, wenn dasselbe Cover sie ${HOLD === 1 ? 'einmal' : `${HOLD}-mal in Folge`} trägt.\n`);
console.log('| Pool | Rauschen | Einigkeit, Zufallspaare | Paarung | Favorit gewinnt | hässlichstes gefunden | Urteil „hässlichstes" nach | davon falsch | schönstes gefunden | Urteil „schönstes" nach | davon falsch |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const pool of POOLS) {
  for (const noise of NOISES) {
    for (const strategy of STRATEGIES) {
      const runs: SimResult[] = [];
      for (let r = 0; r < RUNS; r++) {
        runs.push(simulate({ pool, noise, strategy, votesPerCover: PER_COVER, seed: 1000 * pool + 10 * r + 1, hold: HOLD }));
      }
      for (const run of runs) {
        for (const right of [run.worstClaimRight, run.bestClaimRight]) {
          if (right === null) continue;
          claims[strategy].made += 1;
          if (!right) claims[strategy].wrong += 1;
        }
      }
      const favourite = runs.reduce((sum, run) => sum + run.favourite, 0) / runs.length;
      console.log(
        `| ${pool} | ${noise} | ${pct(runs[0].consensus)} | ${label(strategy)} | ${pct(favourite)} | `
        + `${median(pool, runs.map(r => r.worst))} | ${median(pool, runs.map(r => r.worstClaimed))} | ${wrong(runs.map(r => r.worstClaimRight))} | `
        + `${median(pool, runs.map(r => r.best))} | ${median(pool, runs.map(r => r.bestClaimed))} | ${wrong(runs.map(r => r.bestClaimRight))} |`,
      );
    }
  }
}

console.log('');
for (const strategy of STRATEGIES) {
  const { made, wrong: bad } = claims[strategy];
  console.log(`Urteile „das ist das hässlichste / schönste", ${label(strategy)}: ${made} gefällt, ${bad} falsch (${made ? pct(bad / made) : '–'}).`);
}
console.error(`\n${RUNS} Läufe je Zeile, Krone ${HOLD}-mal in Folge, Deckel ${PER_COVER} Stimmen je Cover, ${((Date.now() - started) / 1000).toFixed(0)} s`);

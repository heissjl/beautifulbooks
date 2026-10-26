/**
 * ROADMAP 6.15 step 3b: do LCC cutter or LibraryThing id join an original and
 * its translation? Reads `pairs.json` (lead card, surplus card per search,
 * from the labelled sample), fetches each work record once from Open Library
 * (6 s pause, stops at the first refusal or non-200, umgang §1) into
 * `out/works/`, then compares the pairs.
 *
 *   npx tsx lab/translations/probe.ts [--pause 6000]
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = __dirname;
const pairs: [string, string, string][] = JSON.parse(readFileSync(join(DIR, 'pairs.json'), 'utf8'));
const ids = [...new Set(pairs.flatMap(([, a, b]) => [a, b]))];
const pause = Number(process.argv[process.argv.indexOf('--pause') + 1] || 6000);

async function fetchAll() {
  mkdirSync(join(DIR, 'out', 'works'), { recursive: true });
  for (const id of ids) {
    const file = join(DIR, 'out', 'works', id + '.json');
    if (existsSync(file)) continue;
    let res: Response;
    try { res = await fetch(`https://openlibrary.org/works/${id}.json`, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'BuyItsCovers lab (buyitscovers.com)' } }); }
    catch (e) { console.error(`${id}: ${String(e)} — stopping`); process.exit(1); }
    if (res.status !== 200) { console.error(`${id}: ${res.status} — stopping`); process.exit(1); }
    writeFileSync(file, JSON.stringify(await res.json(), null, 1));
    console.log(`${id} ok`);
    await new Promise((r) => setTimeout(r, pause));
  }
}

const rec = (id: string) => JSON.parse(readFileSync(join(DIR, 'out', 'works', id + '.json'), 'utf8'));
const lcc = (r: any): string[] => (r.lc_classifications ?? []) as string[];
const lt = (r: any): string[] => [...(r.identifiers?.librarything ?? [])].map(String);
const cutter = (s: string) => (s.match(/\.([A-Z]\d*)\s/)?.[1] ?? '').replace(/\d.*/, '');

function compare() {
  let n = 0, hasLccBoth = 0, lccBase = 0, hasLtBoth = 0, ltSame = 0;
  console.log('| search | lead | other | lead LCC | other LCC | LT lead | LT other |\n|---|---|---|---|---|---|---|');
  for (const [s, a, b] of pairs) {
    const ra = rec(a), rb = rec(b); n++;
    const la = lcc(ra), lb = lcc(rb), ta = lt(ra), tb = lt(rb);
    if (la.length && lb.length) { hasLccBoth++; if (la.some((x) => lb.some((y) => x.split(/\s/)[0] === y.split(/\s/)[0] && cutter(x) === cutter(y)))) lccBase++; }
    if (ta.length && tb.length) { hasLtBoth++; if (ta.some((x) => tb.includes(x))) ltSame++; }
    console.log(`| ${s} | ${a} | ${b} | ${la.join('; ') || '–'} | ${lb.join('; ') || '–'} | ${ta.join(',') || '–'} | ${tb.join(',') || '–'} |`);
  }
  console.log({ pairs: n, lccOnBoth: hasLccBoth, lccSameClassAndCutterBase: lccBase, librarythingOnBoth: hasLtBoth, librarythingSame: ltSame });
}

(async () => { await fetchAll(); compare(); })();

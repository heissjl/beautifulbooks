/**
 * Proposes a checked first-publication year for the curated works (ROADMAP
 * 6.16 Schritt 2): Open Library's year beside Wikidata's, and a flag where
 * they differ, for Julian to read. One-off, no runtime caller (E10 untouched).
 *
 *   npx tsx lab/first-years/propose.ts            # writes lab/first-years/proposal.json
 *
 * Wikidata is asked in batches of 40 work ids over its SPARQL endpoint
 * (property P648 = Open Library ID, P577 = publication date, the earliest
 * taken), two seconds between batches, a user agent that names the site.
 * Open Library's year is the one the curation tool recorded when the work
 * was picked (`firstPublished` in data/curated.json), which is its
 * `first_publish_year` — the number the site showed until now.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface CuratedFile { works: Array<{ id: string; title: string; author: string; coverId: string; firstPublished?: number; skipped?: boolean; dropped?: boolean }> }
export interface Proposal {
  id: string;
  title: string;
  author: string;
  openLibrary: number | null;
  wikidata: number | null;
  qid: string | null;
  /** True when both have a year and they differ, or Wikidata has none. */
  differs: boolean;
}

const UA = 'buyitscovers-first-years (one-off, lab/first-years/propose.ts, julian.heiss@posteo.de)';
const BATCH = 40;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function wikidataYears(ids: string[]): Promise<Map<string, { year: number; qid: string }>> {
  const values = ids.map(id => `"${id}"`).join(' ');
  const sparql = `SELECT ?id ?item ?date WHERE { VALUES ?id { ${values} } ?item wdt:P648 ?id . OPTIONAL { ?item wdt:P577 ?date } }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
  const json = (await res.json()) as { results: { bindings: Array<Record<string, { value: string }>> } };
  const out = new Map<string, { year: number; qid: string }>();
  for (const b of json.results.bindings) {
    const id = b.id?.value;
    const qid = b.item?.value.split('/').pop() ?? '';
    const year = b.date ? Number(b.date.value.slice(0, 4)) : NaN;
    if (!id) continue;
    const have = out.get(id);
    // The earliest date on the item is the first publication; an item without a date keeps its QID with NaN.
    if (!have || (Number.isFinite(year) && (!Number.isFinite(have.year) || year < have.year))) out.set(id, { year, qid });
  }
  return out;
}

async function main() {
  const file = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'curated.json'), 'utf8')) as CuratedFile;
  const works = file.works.filter(w => !w.skipped && !w.dropped && w.coverId.startsWith('ol:'));
  const found = new Map<string, { year: number; qid: string }>();
  for (let i = 0; i < works.length; i += BATCH) {
    const slice = works.slice(i, i + BATCH).map(w => w.id);
    for (const [id, v] of await wikidataYears(slice)) found.set(id, v);
    console.log(`${Math.min(i + BATCH, works.length)}/${works.length} asked, ${found.size} items found`);
    if (i + BATCH < works.length) await sleep(2000);
  }
  const proposals: Proposal[] = works.map(w => {
    const wd = found.get(w.id);
    const wikidata = wd && Number.isFinite(wd.year) ? wd.year : null;
    const openLibrary = w.firstPublished ?? null;
    return { id: w.id, title: w.title, author: w.author, openLibrary, wikidata, qid: wd?.qid ?? null, differs: wikidata === null || (openLibrary !== null && wikidata !== openLibrary) };
  });
  const out = path.join(process.cwd(), 'lab', 'first-years', 'proposal.json');
  writeFileSync(out, `${JSON.stringify({ at: new Date().toISOString().slice(0, 10), works: proposals }, null, 1)}\n`);
  const agree = proposals.filter(p => !p.differs).length;
  const noItem = proposals.filter(p => !p.qid).length;
  const noDate = proposals.filter(p => p.qid && p.wikidata === null).length;
  const differ = proposals.filter(p => p.wikidata !== null && p.openLibrary !== null && p.wikidata !== p.openLibrary);
  console.log(`${proposals.length} works: ${agree} agree, ${differ.length} differ, ${noDate} items without a date, ${noItem} without a Wikidata item → ${out}`);
  for (const p of differ) console.log(`  ${p.id} ${p.title} — ${p.author}: Open Library ${p.openLibrary}, Wikidata ${p.wikidata} (${p.qid})`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

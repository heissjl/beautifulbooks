/**
 * ROADMAP 6.93: how many covers would Apple Books add to the five works of
 * SPEC §3 F1, after the wall's own folding?
 *
 *   npx tsx lab/apple-books/measure.ts
 *
 * For each work: every Open Library edition page (cap 1500 records, as the
 * site), the covers built by the site's own parser, a signature for each
 * cover; Apple's ebook search in the US, UK and German stores, matched by
 * title and author; then `foldDuplicateCovers` over both. An Apple cover
 * that ends in a group of its own is one the wall does not have.
 *
 * Pacing: Open Library one request at a time, 1.5 s apart (it shuts the door
 * on bursts, CLAUDE.md); Apple 4 s apart (it allows about 20 a minute). All
 * answers and signatures are cached under `out/` (git-ignored), so a second
 * run asks nothing it has already asked. No Google Books.
 *
 * Writes out/results.json and out/sheet.html — look at the sheet before
 * believing the numbers: the fold's thresholds were set by looking.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { signatureFor } from '../../lib/coverhash';
import type { ImageSignature } from '../../lib/imagesig';
import type { Cover, Edition, Work } from '../../lib/model';
import { displayTitle } from '../../lib/normalize';
import { parseEditions, type OlEditionEntry } from '../../lib/sources/openlibrary-parse';
import { assembleEditions, foldDuplicateCovers } from '../../lib/works';
import { artworkAt, candidatesFor, type AppleCandidate, type ItunesResult, type WorkToMatch } from './itunes';

const OUT = join(import.meta.dirname, 'out');
mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** `--fixtures`: the recorded edition pages instead of Open Library — a part of each wall only. */
const FROM_FIXTURES = process.argv.includes('--fixtures');
const FIXTURES = join(import.meta.dirname, '../../lib/__fixtures__');
const FIXTURE_DIR: Record<string, string> = {
  OL30751W: 'mumbo-jumbo', OL1168083W: '1984', OL2636675W: 'gravitys-rainbow', OL468431W: 'the-great-gatsby', OL66554W: 'pride-and-prejudice',
};

const WORKS: WorkToMatch[] = [
  { id: 'OL30751W', title: 'Mumbo Jumbo', author: 'Ishmael Reed' },
  { id: 'OL1168083W', title: 'Nineteen Eighty-Four', author: 'George Orwell', aliases: ['1984', 'Neunzehnhundertvierundachtzig'] },
  { id: 'OL2636675W', title: "Gravity's Rainbow", author: 'Thomas Pynchon', aliases: ['Die Enden der Parabel'] },
  { id: 'OL468431W', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', aliases: ['Der große Gatsby'] },
  { id: 'OL66554W', title: 'Pride and Prejudice', author: 'Jane Austen', aliases: ['Stolz und Vorurteil'] },
];
const COUNTRIES = ['us', 'gb', 'de'];
const MAX_EDITIONS = 1500;

// --- caches -----------------------------------------------------------------

function loadJson<T>(name: string, empty: T): T {
  const file = join(OUT, name);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as T : empty;
}
const httpCache = loadJson<Record<string, unknown>>('http-cache.json', {});
const sigCache = loadJson<Record<string, ImageSignature | null>>('signatures.json', {});
const saveHttp = () => writeFileSync(join(OUT, 'http-cache.json'), JSON.stringify(httpCache));
const saveSigs = () => writeFileSync(join(OUT, 'signatures.json'), JSON.stringify(sigCache));

/** One paced GET, cached. A failure is thrown and never cached: not asked is not "nothing there". */
async function getJson<T>(url: string, pauseMs: number): Promise<T> {
  if (url in httpCache) return httpCache[url] as T;
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(40_000), headers: { 'user-agent': 'buyitscovers-lab-apple-books' } });
      if (res.status === 429 || res.status === 403) { last = String(res.status); await sleep(attempt * 30_000); continue; }
      if (!res.ok) throw new Error(String(res.status));
      httpCache[url] = await res.json();
      saveHttp();
      await sleep(pauseMs);
      return httpCache[url] as T;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      if (/ECONNREFUSED/.test(last)) throw new Error(`refused: ${url} — stop asking for a while (CLAUDE.md)`);
      await sleep(attempt * 5000);
    }
  }
  throw new Error(`no answer for ${url}: ${last}`);
}

// --- Open Library -----------------------------------------------------------

async function olCovers(w: WorkToMatch): Promise<{ covers: Cover[]; editions: Edition[]; records: number }> {
  const work: Work = { id: w.id, title: w.title, authors: [w.author] };
  const entries: OlEditionEntry[] = [];
  if (FROM_FIXTURES) {
    for (const suffix of ['', '-100', '-200']) {
      const file = join(FIXTURES, FIXTURE_DIR[w.id], `openlibrary-editions${suffix}.json`);
      if (existsSync(file)) entries.push(...((JSON.parse(readFileSync(file, 'utf8')) as { entries?: OlEditionEntry[] }).entries ?? []));
    }
  }
  for (let offset = 0; !FROM_FIXTURES && offset < MAX_EDITIONS; offset += 100) {
    const page = await getJson<{ size?: number; entries?: OlEditionEntry[] }>(
      `https://openlibrary.org/works/${w.id}/editions.json?limit=100&offset=${offset}`, 1500);
    entries.push(...(page.entries ?? []));
    if ((page.entries ?? []).length < 100 || offset + 100 >= (page.size ?? 0)) break;
  }
  const { covers, editions } = assembleEditions(parseEditions(entries, work));
  return { covers, editions, records: entries.length };
}

// --- Apple ------------------------------------------------------------------

async function appleCandidates(w: WorkToMatch) {
  const surname = w.author.split(' ').pop()!;
  const terms = [displayTitle(w.title), ...(w.aliases ?? [])].map(t => `${t} ${surname}`);
  const answers: Array<{ country: string; results: ItunesResult[] }> = [];
  for (const country of COUNTRIES) {
    for (const term of terms) {
      const url = `https://itunes.apple.com/search?${new URLSearchParams({ term, media: 'ebook', entity: 'ebook', limit: '50', country })}`;
      const data = await getJson<{ results?: ItunesResult[] }>(url, 4000);
      answers.push({ country, results: data.results ?? [] });
    }
  }
  return candidatesFor(answers, w);
}

function appleCover(c: AppleCandidate, workId: string): { cover: Cover; edition: Edition } {
  const id = `ap:${c.trackId}`;
  return {
    // `source` is the site's type, which knows two catalogues; Apple stands in
    // as the retail one. Folding reads it only to prefer an Open Library scan
    // as a group's face.
    cover: { id, url: artworkAt(c.artwork, 600), urlSmall: artworkAt(c.artwork, 300), source: 'googlebooks', editionIds: [id] },
    edition: { id, workId, source: 'googlebooks', title: c.title, year: c.year, format: 'ebook' },
  };
}

// --- signatures -------------------------------------------------------------

async function signatures(covers: readonly Cover[]): Promise<Map<string, ImageSignature>> {
  const queue = covers.filter(c => !(c.id in sigCache) || sigCache[c.id] === null);
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const c = queue.shift()!;
      sigCache[c.id] = await signatureFor(c, 20_000);
      if (++done % 25 === 0) { saveSigs(); process.stdout.write(`  ${done} hashed\n`); }
    }
  };
  // covers.openlibrary.org is not the catalogue host and took this pace on 2026-10-04.
  await Promise.all(Array.from({ length: 4 }, worker));
  saveSigs();
  return new Map(covers.flatMap(c => (sigCache[c.id] ? [[c.id, sigCache[c.id]!] as const] : [])));
}

// --- measure ----------------------------------------------------------------

interface WorkResult {
  id: string; title: string;
  olRecords: number; olCovers: number; olHashed: number; olAfterFold: number;
  appleMatched: number; appleByAlias: number; appleRejected: number; appleHashed: number;
  appleNew: Array<{ id: string; title: string; artist: string; year?: number; matchedBy: string; countries: string[]; image: string; alsoFolded: string[] }>;
  appleFolded: Array<{ id: string; title: string; image: string; into: string; intoImage: string }>;
  rejectedSample: Array<{ title: string; artist: string }>;
}

async function measure(w: WorkToMatch): Promise<WorkResult> {
  console.log(`\n${w.title}`);
  const ol = await olCovers(w);
  console.log(`  Open Library: ${ol.records} records, ${ol.covers.length} covers`);
  const apple = await appleCandidates(w);
  console.log(`  Apple: ${apple.candidates.length} images matched, ${apple.rejected.length} results rejected`);
  const ap = apple.candidates.map(c => ({ c, ...appleCover(c, w.id) }));
  const all = [...ol.covers, ...ap.map(a => a.cover)];
  const sigs = await signatures(all);
  const editions = [...ol.editions, ...ap.map(a => a.edition)];

  const olOnly = foldDuplicateCovers(ol.covers, sigs, ol.editions);
  const folded = foldDuplicateCovers(all, sigs, editions);
  const byId = new Map(all.map(c => [c.id, c]));
  const meta = new Map(ap.map(a => [a.cover.id, a.c]));

  const appleNew: WorkResult['appleNew'] = [];
  const appleFolded: WorkResult['appleFolded'] = [];
  for (const g of folded) {
    const members = [g.id, ...(g.similarIds ?? [])];
    const apples = members.filter(id => id.startsWith('ap:'));
    if (apples.length === 0) continue;
    if (members.every(id => id.startsWith('ap:'))) {
      const c = meta.get(g.id)!;
      appleNew.push({
        id: g.id, title: c.title, artist: c.artist, year: c.year, matchedBy: c.matchedBy, countries: c.countries,
        image: byId.get(g.id)!.urlSmall!, alsoFolded: apples.filter(id => id !== g.id),
      });
    } else {
      for (const id of apples) appleFolded.push({ id, title: meta.get(id)!.title, image: byId.get(id)!.urlSmall!, into: g.id, intoImage: byId.get(g.id)!.urlSmall ?? byId.get(g.id)!.url });
    }
  }
  const r: WorkResult = {
    id: w.id, title: w.title,
    olRecords: ol.records, olCovers: ol.covers.length, olHashed: ol.covers.filter(c => sigs.has(c.id)).length, olAfterFold: olOnly.length,
    appleMatched: ap.length, appleByAlias: ap.filter(a => a.c.matchedBy === 'alias').length, appleRejected: apple.rejected.length,
    appleHashed: ap.filter(a => sigs.has(a.cover.id)).length,
    appleNew, appleFolded, rejectedSample: apple.rejected.slice(0, 15),
  };
  console.log(`  wall: ${r.olAfterFold} after folding (${r.olHashed}/${r.olCovers} hashed); Apple new: ${appleNew.length} (${appleNew.filter(a => a.matchedBy === 'alias').length} via alias), folded: ${appleFolded.length}`);
  return r;
}

const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

function sheet(results: readonly WorkResult[]): string {
  const tile = (src: string, caption: string) =>
    `<figure><img loading="lazy" src="${esc(src)}"><figcaption>${esc(caption)}</figcaption></figure>`;
  const body = results.map(r => `
    <h2>${esc(r.title)} <small>${r.olAfterFold} on the wall · Apple ${r.appleMatched} matched · ${r.appleNew.length} new · ${r.appleFolded.length} folded</small></h2>
    <h3>New — no cover on the wall folds with these</h3>
    <div class="row">${r.appleNew.map(a => tile(a.image, `${a.title} · ${a.artist} · ${a.year ?? '?'} · ${a.countries.join('/')}${a.matchedBy === 'alias' ? ' · alias' : ''}${a.alsoFolded.length ? ` · +${a.alsoFolded.length}` : ''}`)).join('') || '<p>none</p>'}</div>
    <h3>Folded — Apple left, the wall's cover right</h3>
    <div class="row">${r.appleFolded.map(f => `<div class="pair">${tile(f.image, f.title)}${tile(f.intoImage, f.into)}</div>`).join('') || '<p>none</p>'}</div>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>Apple Books covers</title>
<style>body{font:14px system-ui;margin:24px;background:#faf8f4;color:#222}h2{margin-top:40px}small{color:#777;font-weight:normal}
.row{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:120px}img{width:120px;height:180px;object-fit:contain;background:#eee}
figcaption{font-size:11px;color:#555}.pair{display:flex;gap:4px;padding:6px;background:#fff;border:1px solid #ddd}</style>
<h1>Apple Books against the wall (ROADMAP 6.93)${FROM_FIXTURES ? ' — recorded pages only, part of each wall' : ''}</h1>${body}`;
}

async function main() {
  const results: WorkResult[] = [];
  for (const w of WORKS) results.push(await measure(w));
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ wall: FROM_FIXTURES ? 'fixtures (part of each wall)' : 'open library (whole wall, cap 1500)', results }, null, 2));
  writeFileSync(join(OUT, 'sheet.html'), sheet(results));
  console.log('\nwork | OL covers | hashed | wall | Apple matched (alias) | new (alias) | folded');
  for (const r of results) {
    const newAlias = r.appleNew.filter(a => a.matchedBy === 'alias').length;
    console.log(`${r.title} | ${r.olCovers} | ${r.olHashed} | ${r.olAfterFold} | ${r.appleMatched} (${r.appleByAlias}) | ${r.appleNew.length} (${newAlias}) | ${r.appleFolded.length}`);
  }
  console.log(`\nout/results.json, out/sheet.html`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

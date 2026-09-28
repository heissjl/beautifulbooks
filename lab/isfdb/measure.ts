/**
 * How many covers would get a line „Cover art: …" from ISFDB? (ROADMAP 6.52,
 * step 1; Julian, 2026-09-25: „yes, do the measurement".)
 *
 *   npx tsx lab/isfdb/measure.ts
 *
 * Two samples, reported apart because they answer different questions:
 *
 *  (a) **the collections** — every ISBN in the series lists under
 *      `lab/collections/lists/`: what the collection walls would show;
 *  (b) **what a reader can select** — 40 works drawn from the site's index
 *      (fixed seed), up to five covers each from their first 100 Open
 *      Library editions, one ISBN per cover: what the sidebar would show.
 *
 * ISFDB is asked once per ISBN, two seconds apart; every answer, and every
 * failure as a failure, lands in `cache.json` beside this file (git-ignored),
 * so a second run asks only what the first could not. A 403, a 5xx or a
 * timeout is **not** "no artist" (N12): it is counted as failed, and after
 * eight failures in a row the run stops rather than hammering a site that is
 * refusing it. Open Library is asked for the editions of sample (b) only,
 * never Google (lab rule 6).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverCredit, parsePublications, type CoverCredit } from './parse';

const ROOT = join(import.meta.dirname, '..', '..');
const CACHE_FILE = join(import.meta.dirname, 'cache.json');
const OL_CACHE_FILE = join(import.meta.dirname, 'ol-cache.json');
const LISTS = join(ROOT, 'lab', 'collections', 'lists');
const PAUSE_MS = 2000;
const SAMPLE_WORKS = 40;
const COVERS_PER_WORK = 5;

type Answer = { ok: true; credit: CoverCredit } | { ok: false; reason: string };

const cache: Record<string, Answer> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const olCache: Record<string, unknown> = existsSync(OL_CACHE_FILE) ? JSON.parse(readFileSync(OL_CACHE_FILE, 'utf8')) : {};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function askIsfdb(isbn: string): Promise<Answer> {
  const hit = cache[isbn];
  if (hit?.ok) return hit;
  let answer: Answer;
  try {
    const res = await fetch(`https://www.isfdb.org/cgi-bin/rest/getpub.cgi?${isbn}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'beautifulbooks-lab (measurement for ROADMAP 6.52)' },
    });
    if (!res.ok) answer = { ok: false, reason: `HTTP ${res.status}` };
    else {
      const text = new TextDecoder('iso-8859-1').decode(await res.arrayBuffer());
      answer = text.includes('<ISFDB>') ? { ok: true, credit: coverCredit(parsePublications(text)) } : { ok: false, reason: 'not an ISFDB answer' };
    }
  } catch (err) {
    answer = { ok: false, reason: err instanceof Error ? err.name : String(err) };
  }
  cache[isbn] = answer;
  writeFileSync(CACHE_FILE, JSON.stringify(cache));
  await sleep(PAUSE_MS);
  return answer;
}

/** A small deterministic generator, so sample (b) is the same on every run. */
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

interface Edition { covers?: number[]; isbn_13?: string[]; isbn_10?: string[] }

async function editionsOf(workId: string): Promise<Edition[] | null> {
  const key = `editions:${workId}`;
  if (key in olCache) return olCache[key] as Edition[];
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}/editions.json?limit=100`, {
      signal: AbortSignal.timeout(30_000),
      headers: { 'user-agent': 'beautifulbooks-lab' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { entries?: Edition[] };
    olCache[key] = (body.entries ?? []).map(e => ({ covers: e.covers, isbn_13: e.isbn_13, isbn_10: e.isbn_10 }));
    writeFileSync(OL_CACHE_FILE, JSON.stringify(olCache));
    await sleep(800);
    return olCache[key] as Edition[];
  } catch {
    return null;
  }
}

async function readerSample(): Promise<{ isbns: string[]; worksAsked: number; worksSilent: number }> {
  const works = (JSON.parse(readFileSync(join(ROOT, 'data', 'index-works.json'), 'utf8')) as { works: Array<{ id: string }> }).works;
  const rand = seeded(20260925);
  const pool = [...works];
  const picked: string[] = [];
  while (picked.length < SAMPLE_WORKS && pool.length) picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].id);
  const isbns: string[] = [];
  let silent = 0;
  for (const id of picked) {
    const eds = await editionsOf(id);
    if (!eds) { silent += 1; continue; }
    const seen = new Set<number>();
    let n = 0;
    for (const e of eds) {
      const cover = (e.covers ?? []).find(c => c > 0);
      const isbn = e.isbn_13?.[0] ?? e.isbn_10?.[0];
      if (!cover || !isbn || seen.has(cover)) continue;
      seen.add(cover);
      isbns.push(isbn.replace(/[^0-9X]/gi, ''));
      if (++n >= COVERS_PER_WORK) break;
    }
  }
  return { isbns, worksAsked: picked.length, worksSilent: silent };
}

interface Tally { n: number; artist: number; ambiguous: number; noArtist: number; noRecord: number; failed: number; artists: Map<string, number> }

async function measure(label: string, isbns: string[]): Promise<Tally | null> {
  const t: Tally = { n: 0, artist: 0, ambiguous: 0, noArtist: 0, noRecord: 0, failed: 0, artists: new Map() };
  let failedInRow = 0;
  for (const isbn of [...new Set(isbns)]) {
    const a = await askIsfdb(isbn);
    t.n += 1;
    if (!a.ok) {
      t.failed += 1;
      failedInRow += 1;
      if (failedInRow >= 8) {
        console.log(`${label}: stopped after 8 failures in a row (last: ${a.reason}); run again later, answers so far are cached`);
        return null;
      }
      continue;
    }
    failedInRow = 0;
    if (a.credit.kind === 'artist') {
      t.artist += 1;
      for (const name of a.credit.artists) t.artists.set(name, (t.artists.get(name) ?? 0) + 1);
    } else if (a.credit.kind === 'ambiguous') t.ambiguous += 1;
    else if (a.credit.kind === 'no-artist') t.noArtist += 1;
    else t.noRecord += 1;
  }
  const pct = (x: number) => `${x} (${Math.round((100 * x) / Math.max(1, t.n - t.failed))} %)`;
  const top = [...t.artists.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`${label}: ${t.n} ISBNs — artist ${pct(t.artist)}, ambiguous ${pct(t.ambiguous)}, record without artist ${pct(t.noArtist)}, unknown to ISFDB ${pct(t.noRecord)}, failed ${t.failed}${top ? ` — most named: ${top}` : ''}`);
  return t;
}

function listIsbns(file: string): string[] {
  return (JSON.parse(readFileSync(join(LISTS, file), 'utf8')) as Array<{ isbn: string }>).map(e => e.isbn);
}

async function main() {
  const lists: Array<[string, string]> = [
    ['SF Masterworks, numbered', 'sf-masterworks-numbered.json'],
    ['SF Masterworks, relaunch', 'sf-masterworks-relaunch.json'],
    ['Penguin Clothbound Classics', 'penguin-clothbound-classics.json'],
    ['edition suhrkamp 471–793', 'edition-suhrkamp-471.json'],
  ];
  for (const [label, file] of lists) {
    if (!existsSync(join(LISTS, file))) { console.log(`${label}: list missing, skipped`); continue; }
    if ((await measure(label, listIsbns(file))) === null) return;
  }
  const sample = await readerSample();
  console.log(`reader sample: ${sample.worksAsked} works, ${sample.worksSilent} without an Open Library answer, ${sample.isbns.length} covers with an ISBN`);
  await measure('reader sample (index works)', sample.isbns);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

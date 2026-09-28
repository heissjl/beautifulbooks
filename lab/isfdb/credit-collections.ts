/**
 * Cover credits from ISFDB for the collections that show them (ROADMAP 6.52;
 * Julian, 2026-09-25: „just for sf-related collections i want the cover
 * artist data displayed on the wall itself").
 *
 *   npx tsx lab/isfdb/credit-collections.ts sf-masterworks sf-masterworks-relaunch
 *
 * For each tile: find the ISBN of the printing whose image is on the wall —
 * `coverIsbn`, else the ISBN in `from`, else the Open Library edition of the
 * work that carries that very cover id — then ask ISFDB for that ISBN and
 * keep the credit only when `coverCredit` allows it (one agreed artist, no
 * picture agency). A tile whose printing cannot be pinned down gets no
 * credit: a name must never be carried to a cover it does not belong to.
 *
 * Marks each named collection `coverCredits: 'isfdb'` and writes
 * `data/collections.json` (or `COLLECTIONS_FILE`), reading it fresh just
 * before the write so the curation app's changes survive. ISFDB answers are
 * shared with `measure.ts` through `cache.json`; failures are retried on the
 * next run, never stored as "no artist" (N12).
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionPick, CollectionRecord } from '../../lib/collections';
import { coverCredit, parsePublications, repairCredit, type CoverCredit } from './parse';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT_FILE = process.env.COLLECTIONS_FILE ?? join(ROOT, 'data', 'collections.json');
const CACHE_FILE = join(import.meta.dirname, 'cache.json');
const OL_CACHE_FILE = join(import.meta.dirname, 'credit-ol-cache.json');
const PAUSE_MS = 2000;

type Answer = { ok: true; credit: CoverCredit } | { ok: false; reason: string };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const readJson = <T,>(file: string, fallback: T): T => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback);

const olCache = readJson<Record<string, Array<{ covers?: number[]; isbn_13?: string[]; isbn_10?: string[] }>>>(OL_CACHE_FILE, {});

async function isfdb(isbn: string): Promise<Answer> {
  const cache = readJson<Record<string, Answer>>(CACHE_FILE, {});
  const hit = cache[isbn];
  // Cached answers were parsed before names were repaired; repair them on the way out.
  if (hit?.ok) return { ok: true, credit: repairCredit(hit.credit) };
  let answer: Answer;
  try {
    const res = await fetch(`https://www.isfdb.org/cgi-bin/rest/getpub.cgi?${isbn}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'beautifulbooks-lab (cover credits, ROADMAP 6.52)' },
    });
    if (!res.ok) answer = { ok: false, reason: `HTTP ${res.status}` };
    else {
      const text = new TextDecoder('iso-8859-1').decode(await res.arrayBuffer());
      answer = text.includes('<ISFDB>') ? { ok: true, credit: coverCredit(parsePublications(text)) } : { ok: false, reason: 'not an ISFDB answer' };
    }
  } catch (err) {
    answer = { ok: false, reason: err instanceof Error ? err.name : String(err) };
  }
  const fresh = readJson<Record<string, Answer>>(CACHE_FILE, {});
  fresh[isbn] = answer;
  writeFileSync(CACHE_FILE, JSON.stringify(fresh));
  await sleep(PAUSE_MS);
  return answer;
}

/** The ISBN of the Open Library edition of `workId` that carries cover `coverNumber`. */
async function isbnOfCover(workId: string, coverNumber: number): Promise<string | null> {
  if (!olCache[workId]) {
    const all: Array<{ covers?: number[]; isbn_13?: string[]; isbn_10?: string[] }> = [];
    for (let offset = 0; offset < 1000; offset += 200) {
      try {
        const res = await fetch(`https://openlibrary.org/works/${workId}/editions.json?limit=200&offset=${offset}`, {
          signal: AbortSignal.timeout(40_000),
          headers: { 'user-agent': 'beautifulbooks-lab' },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { entries?: typeof all; size?: number };
        for (const e of body.entries ?? []) all.push({ covers: e.covers, isbn_13: e.isbn_13, isbn_10: e.isbn_10 });
        await sleep(800);
        if ((body.entries ?? []).length < 200) break;
      } catch {
        return null;
      }
    }
    olCache[workId] = all;
    writeFileSync(OL_CACHE_FILE, JSON.stringify(olCache));
  }
  const edition = olCache[workId].find(e => e.covers?.includes(coverNumber));
  const isbn = edition?.isbn_13?.[0] ?? edition?.isbn_10?.[0];
  return isbn ? isbn.replace(/[^0-9X]/gi, '') : null;
}

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) throw new Error('usage: credit-collections.ts <slug> [slug …]');
  const credits = new Map<string, Pick<CollectionPick, 'coverIsbn' | 'coverArtists' | 'isfdbRecord'>>();
  const start = readJson<{ collections: CollectionRecord[] }>(OUT_FILE, { collections: [] }).collections;

  for (const slug of slugs) {
    const c = start.find(x => x.slug === slug);
    if (!c) { console.log(`${slug}: no such collection`); continue; }
    const tally = { credited: 0, noIsbn: 0, none: 0, ambiguous: 0, garbled: 0, failed: 0 };
    for (const w of c.works) {
      const isbn = w.coverIsbn
        ?? (w.from?.startsWith('isbn:') ? w.from.slice(5) : null)
        ?? (await isbnOfCover(w.id, Number(w.coverId.slice(3))));
      if (!isbn) { tally.noIsbn += 1; continue; }
      const a = await isfdb(isbn);
      const key = `${slug}|${w.id}|${w.coverId}`;
      if (!a.ok) { tally.failed += 1; continue; }
      if (a.credit.kind === 'artist') {
        credits.set(key, { coverIsbn: isbn, coverArtists: a.credit.artists, isfdbRecord: a.credit.record });
        tally.credited += 1;
      } else {
        credits.set(key, { coverIsbn: isbn });
        if (a.credit.kind === 'ambiguous') tally.ambiguous += 1;
        else if (a.credit.kind === 'garbled') tally.garbled += 1;
        else tally.none += 1;
      }
    }
    console.log(`${slug}: ${c.works.length} tiles — credited ${tally.credited}, several artists ${tally.ambiguous}, none named ${tally.none}, name garbled by ISFDB ${tally.garbled}, printing not found ${tally.noIsbn}, ISFDB failed ${tally.failed}`);
  }

  // Fresh read just before writing: the curation app may have changed the file meanwhile.
  const file = readJson<{ curatedAt?: string; collections: CollectionRecord[] }>(OUT_FILE, { collections: [] });
  for (const c of file.collections) {
    if (!slugs.includes(c.slug)) continue;
    c.coverCredits = 'isfdb';
    c.works = c.works.map(w => {
      const found = credits.get(`${c.slug}|${w.id}|${w.coverId}`);
      if (!found) return w;
      const next: CollectionPick = { ...w, ...found };
      if (!found.coverArtists) { delete next.coverArtists; delete next.isfdbRecord; }
      return next;
    });
  }
  const tmp = `${OUT_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(file, null, 2)}\n`);
  renameSync(tmp, OUT_FILE);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

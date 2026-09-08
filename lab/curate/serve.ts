/**
 * The curation tool (ROADMAP 6.18): pick one cover, and confirm one year,
 * for each of the hundred works behind the home page.
 *
 *   npx tsx lab/curate/serve.ts        # then open http://localhost:4321
 *
 * Local only, never deployed. It writes `data/curated.json`, which is the
 * input for 6.17.
 *
 * Why it is fast: the covers come from `data/cover-index.json` — 10,362 of
 * them for these hundred works, already built (E18). Nothing is asked of
 * Open Library to *list* them; only the images themselves come over the
 * wire, and only for the work on screen. Google Books is never asked at all
 * (lab rule 6).
 *
 * The one thing it does fetch is the year list per work, once, cached in
 * `lab/curate/years.json`: `first_publish_year` alone is wrong for a third
 * of the books (6.16), so the field shows what the guard makes of it and
 * says when the two disagree.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { robustFirstPublishYear } from '../../lib/firstyear';

const ROOT = join(import.meta.dirname, '..', '..');
const INDEX_FILE = join(ROOT, 'data', 'cover-index.json');
const OUT_FILE = join(ROOT, 'data', 'curated.json');
const YEARS_FILE = join(import.meta.dirname, 'years.json');
const PORT = Number(process.env.PORT ?? 4321);

/** Works dropped by hand. 1984 is out on Julian's instruction (ROADMAP 6.17). */
const EXCLUDED = new Set(['OL1168083W']);

interface RawIndex {
  builtAt: string;
  works: Array<[id: string, title: string, author: string]>;
  covers: Array<[work: number, cover: string, ...rest: unknown[]]>;
}

export interface Pick {
  id: string;
  title: string;
  author: string;
  coverId: string;
  /** Checked by hand; absent means "not looked at yet". */
  firstPublished?: number;
  skipped?: boolean;
  pickedAt: string;
}

interface YearInfo {
  reported?: number;
  guarded?: number;
  years: number[];
}

const index = JSON.parse(readFileSync(INDEX_FILE, 'utf8')) as RawIndex;
const years: Record<string, YearInfo> = existsSync(YEARS_FILE)
  ? JSON.parse(readFileSync(YEARS_FILE, 'utf8'))
  : {};
const picks: Record<string, Pick> = existsSync(OUT_FILE)
  ? Object.fromEntries((JSON.parse(readFileSync(OUT_FILE, 'utf8')).works as Pick[]).map(p => [p.id, p]))
  : {};

/** Cover ids per work, in index order (which is Open Library's own order). */
const coversByWork = new Map<number, string[]>();
for (const [workIdx, coverId] of index.covers) {
  const list = coversByWork.get(workIdx);
  if (list) list.push(coverId);
  else coversByWork.set(workIdx, [coverId]);
}

const works = index.works
  .map(([id, title, author], i) => ({ id, title, author, covers: coversByWork.get(i) ?? [] }))
  .filter(w => !EXCLUDED.has(w.id));

function writeAtomically(file: string, content: string) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, file);
}

function savePicks() {
  const ordered = works.map(w => picks[w.id]).filter(Boolean);
  writeAtomically(OUT_FILE, `${JSON.stringify({ curatedAt: new Date().toISOString().slice(0, 10), works: ordered }, null, 2)}\n`);
}

/** One Open Library search, cached on disk. Never Google (lab rule 6). */
async function yearsFor(workId: string): Promise<YearInfo> {
  const cached = years[workId];
  if (cached) return cached;
  const url = `https://openlibrary.org/search.json?q=key:/works/${workId}&limit=1&fields=key,first_publish_year,publish_year`;
  let info: YearInfo = { years: [] };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = (await res.json()) as { docs?: Array<{ first_publish_year?: number; publish_year?: number[] }> };
    const doc = body.docs?.[0];
    if (doc) {
      const list = (doc.publish_year ?? []).slice().sort((a, b) => a - b);
      info = { reported: doc.first_publish_year, guarded: robustFirstPublishYear(doc.first_publish_year, list), years: list };
    }
  } catch {
    // The catalogue is allowed to be silent; the field then simply starts empty.
  }
  years[workId] = info;
  writeAtomically(YEARS_FILE, `${JSON.stringify(years, null, 1)}\n`);
  return info;
}

const HTML = readFileSync(join(import.meta.dirname, 'index.html'), 'utf8');

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  if (url.pathname === '/api/works') {
    send(200, {
      builtAt: index.builtAt,
      works: works.map(w => ({ ...w, pick: picks[w.id] ?? null })),
    });
    return;
  }

  if (url.pathname === '/api/years') {
    const id = url.searchParams.get('id') ?? '';
    send(200, await yearsFor(id));
    return;
  }

  if (url.pathname === '/api/pick' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Partial<Pick> & { id?: string };
    const work = works.find(w => w.id === body.id);
    if (!work) return send(400, { error: 'unknown work' });
    if (body.skipped) {
      picks[work.id] = { id: work.id, title: work.title, author: work.author, coverId: '', skipped: true, pickedAt: new Date().toISOString() };
    } else {
      if (!body.coverId) return send(400, { error: 'no cover' });
      picks[work.id] = {
        id: work.id,
        title: work.title,
        author: work.author,
        coverId: body.coverId,
        firstPublished: body.firstPublished,
        pickedAt: new Date().toISOString(),
      };
    }
    savePicks();
    send(200, { ok: true, done: Object.values(picks).filter(p => !p.skipped).length, total: works.length });
    return;
  }

  send(404, { error: 'not found' });
});

server.listen(PORT, () => {
  const done = Object.values(picks).filter(p => !p.skipped).length;
  console.log(`curate: ${works.length} works, ${done} already picked`);
  console.log(`open http://localhost:${PORT}`);
});

/**
 * The collection tool (ROADMAP 5.10): the second curation app, for thematic
 * collections rather than the home page.
 *
 *   npx tsx lab/collections/serve.ts     # then open http://localhost:4322
 *
 * Local only, never deployed. It writes `data/collections.json`, which the
 * website reads as it is (`lib/collections.ts`). Set `COLLECTIONS_FILE` to
 * point it elsewhere when testing against the running tool — the first
 * curation tool once had a test's picks land in Julian's own file.
 *
 * **Who belongs in a collection is Julian's list.** An author collection is
 * searched only inside the authors it names, by Open Library author key, and
 * the server refuses a work by anyone else (`upsertPick`). Adding an author
 * is a button Julian presses; nothing here proposes one.
 *
 * What goes over the wire, and only to Open Library (never Google, lab
 * rule 6): one author search when a name is looked up, one works search per
 * author or publisher, and one editions list per work whose covers are
 * opened. All three are cached beside this file, so a second start asks
 * nothing that it asked before.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionRecord } from '../../lib/collections';
import { toRecord, type Draft } from '../../lib/curate/drafts';
import {
  addAuthor,
  authorCandidates,
  inSeries,
  newCollection,
  removeAuthor,
  removePick,
  reorder,
  upsertPick,
  type Candidate,
  type SearchDoc,
} from '../../lib/collectionedit';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT_FILE = process.env.COLLECTIONS_FILE ?? join(ROOT, 'data', 'collections.json');
const INDEX_FILE = join(ROOT, 'data', 'cover-index.json');
const CACHE_FILE = join(import.meta.dirname, 'cache.json');
const HTML_FILE = join(import.meta.dirname, 'index.html');
const PORT = Number(process.env.PORT ?? 4322);

/**
 * Where friends' suggestions wait (ROADMAP 5.10a): the site that runs
 * `/suggest`, e.g. `http://localhost:3000` or the production address, and the
 * admin password it was deployed with. Without both, the tool has no
 * suggestions section. Asked only when the section is opened or a decision is
 * made — never in a loop, because repeated requests to production trip
 * Vercel's bot mitigation (CLAUDE.md).
 */
const SUGGEST_REMOTE = process.env.SUGGEST_REMOTE?.replace(/\/$/, '');
const SUGGEST_ADMIN = process.env.SUGGEST_ADMIN_PASSWORD;

async function remote(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${SUGGEST_REMOTE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${SUGGEST_ADMIN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(`${res.status} from ${SUGGEST_REMOTE}${path}: ${data.error ?? ''}`);
  return data;
}

/** Editions read per work when its covers are opened; the decade pages use the same cap. */
const MAX_EDITIONS = 600;
/** Works listed per author or publisher, most-printed first. */
const MAX_CANDIDATES = 40;

interface EditionCover {
  coverId: string;
  publisher?: string;
  year?: number;
}

interface Cache {
  authors: Record<string, unknown[]>;
  searches: Record<string, SearchDoc[]>;
  editions: Record<string, Array<{ covers: number[]; publishers?: string[]; year?: number }>>;
}

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback;
}

function writeAtomically(file: string, content: string) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, file);
}

let collections: CollectionRecord[] = readJson<{ collections: CollectionRecord[] }>(OUT_FILE, { collections: [] }).collections;
const cache: Cache = { authors: {}, searches: {}, editions: {}, ...readJson<Partial<Cache>>(CACHE_FILE, {}) };

function save() {
  writeAtomically(OUT_FILE, `${JSON.stringify({ curatedAt: new Date().toISOString().slice(0, 10), collections }, null, 2)}\n`);
}

function saveCache() {
  writeAtomically(CACHE_FILE, `${JSON.stringify(cache)}\n`);
}

/**
 * Covers the built index already knows, per work (E18). Used before asking
 * Open Library, and to fill in covers whose edition records the capped
 * editions list did not reach.
 */
const indexCovers = new Map<string, string[]>();
{
  const index = readJson<{ works: Array<[string, string, string]>; covers: Array<[number, string]> }>(INDEX_FILE, { works: [], covers: [] });
  for (const [workIdx, coverId] of index.covers) {
    const id = index.works[workIdx]?.[0];
    if (!id) continue;
    const list = indexCovers.get(id);
    if (list) list.push(coverId);
    else indexCovers.set(id, [coverId]);
  }
}

async function getJson<T>(url: string, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'beautifulbooks-lab-collections' } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return (await res.json()) as T;
}

async function findAuthors(q: string) {
  const key = q.toLowerCase().trim();
  if (cache.authors[key]) return cache.authors[key];
  const body = await getJson<{ docs: Array<Record<string, unknown>> }>(
    `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}&limit=8`,
  );
  const found = body.docs.map(d => ({
    key: d.key,
    name: d.name,
    works: d.work_count,
    topWork: d.top_work,
    born: d.birth_date,
  }));
  cache.authors[key] = found;
  saveCache();
  return found;
}

const SEARCH_FIELDS = 'key,title,author_key,author_name,edition_count,first_publish_year,cover_i';

async function search(query: string): Promise<SearchDoc[]> {
  if (cache.searches[query]) return cache.searches[query];
  const body = await getJson<{ docs: SearchDoc[] }>(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&sort=editions&limit=${MAX_CANDIDATES * 2}&fields=${SEARCH_FIELDS}`,
    45_000,
  );
  cache.searches[query] = body.docs;
  saveCache();
  return body.docs;
}

async function candidatesFor(c: CollectionRecord, source: string): Promise<Candidate[]> {
  if (c.kind === 'authors') {
    const author = (c.authors ?? []).find(a => a.name === source);
    if (!author) throw new Error(`unbekannte Autorin: ${source}`);
    const docs = (await Promise.all(author.keys.map(k => search(`author_key:${k}`)))).flat();
    return authorCandidates(docs, author)
      .sort((a, b) => b.editions - a.editions)
      .slice(0, MAX_CANDIDATES);
  }
  if (!(c.publishers ?? []).includes(source)) throw new Error(`unbekannter Verlag: ${source}`);
  const docs = await search(`publisher:"${source}"`);
  return docs.slice(0, MAX_CANDIDATES).map(d => ({
    id: d.key.replace('/works/', ''),
    title: d.title,
    author: d.author_name?.[0] ?? '',
    editions: d.edition_count ?? 0,
    firstPublished: d.first_publish_year,
    coverId: d.cover_i && d.cover_i > 0 ? `ol:${d.cover_i}` : undefined,
  }));
}

/** Edition records of a work, capped and cached: covers, publisher and year of each. */
async function editionsOf(workId: string) {
  if (cache.editions[workId]) return cache.editions[workId];
  const out: Cache['editions'][string] = [];
  for (let offset = 0; offset < MAX_EDITIONS; offset += 200) {
    const body = await getJson<{ entries?: Array<{ covers?: number[]; publishers?: string[]; publish_date?: string }>; size?: number }>(
      `https://openlibrary.org/works/${workId}/editions.json?limit=200&offset=${offset}`,
      45_000,
    );
    for (const e of body.entries ?? []) {
      const year = Number(e.publish_date?.match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1]);
      out.push({ covers: (e.covers ?? []).filter(x => x > 0), publishers: e.publishers, year: Number.isFinite(year) ? year : undefined });
    }
    if (!body.entries || body.entries.length < 200 || (body.size ?? 0) <= offset + 200) break;
  }
  cache.editions[workId] = out;
  saveCache();
  return out;
}

/**
 * The covers to choose from. For a series, only the covers of editions under
 * one of its confirmed publisher spellings — a Penguin Classics collection
 * must not offer a Folio Society jacket. For an author collection, every
 * cover the records carry, then whatever the index adds.
 */
async function coversFor(c: CollectionRecord, workId: string): Promise<EditionCover[]> {
  const editions = await editionsOf(workId);
  const out: EditionCover[] = [];
  const seen = new Set<string>();
  for (const e of editions) {
    if (c.kind === 'series' && !inSeries(e.publishers, c.publishers ?? [])) continue;
    for (const n of e.covers) {
      const coverId = `ol:${n}`;
      if (seen.has(coverId)) continue;
      seen.add(coverId);
      out.push({ coverId, publisher: e.publishers?.[0], year: e.year });
    }
  }
  if (c.kind === 'authors') {
    for (const coverId of indexCovers.get(workId) ?? []) {
      if (!coverId.startsWith('ol:') || seen.has(coverId)) continue;
      seen.add(coverId);
      out.push({ coverId });
    }
  }
  return out;
}

async function readBody<T>(req: import('node:http').IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T;
}

function replace(next: CollectionRecord) {
  collections = collections.map(c => (c.slug === next.slug ? next : c));
  save();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const find = (slug: string | null) => collections.find(c => c.slug === slug);

  try {
    if (url.pathname === '/') {
      // Read per request: a tool being changed while it runs.
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(readFileSync(HTML_FILE, 'utf8'));
      return;
    }

    if (url.pathname === '/api/collections') {
      collections = readJson<{ collections: CollectionRecord[] }>(OUT_FILE, { collections: [] }).collections;
      return send(200, { collections, remote: SUGGEST_REMOTE ?? null });
    }

    if (url.pathname === '/api/suggestions') {
      if (!SUGGEST_REMOTE || !SUGGEST_ADMIN) return send(200, { off: true });
      return send(200, await remote('/api/suggest'));
    }

    // Friends' drafts from /curate (ROADMAP 5.10b): read from the site, taken over by hand.
    if (url.pathname === '/api/drafts') {
      if (!SUGGEST_REMOTE || !SUGGEST_ADMIN) return send(200, { off: true });
      return send(200, await remote('/api/curate/drafts'));
    }

    if (url.pathname === '/api/import' && req.method === 'POST') {
      if (!SUGGEST_REMOTE || !SUGGEST_ADMIN) return send(400, { error: 'SUGGEST_REMOTE und SUGGEST_ADMIN_PASSWORD fehlen' });
      const { draft, mode } = await readBody<{ draft: Draft; mode: 'new' | 'replace' }>(req);
      collections = readJson<{ collections: CollectionRecord[] }>(OUT_FILE, { collections: [] }).collections;
      const record = toRecord(draft);
      const existing = collections.find(c => c.slug === record.slug);
      if (existing && mode === 'replace') {
        // The published flag stays Julian's: taking over a draft never publishes.
        collections = collections.map(c => (c === existing ? { ...record, published: existing.published } : c));
      } else {
        let slug = record.slug;
        for (let n = 2; collections.some(c => c.slug === slug); n++) slug = `${record.slug}-${n}`;
        collections = [...collections, { ...record, slug }];
      }
      save();
      await remote(`/api/curate/drafts/${draft.id}`, { op: 'imported' });
      // The file holds it now; a draft published from /curate for this address stops winning (5.10g).
      await remote('/api/curate/publish', { slug: draft.slug, clearDraft: true });
      return send(200, { collections });
    }

    if (url.pathname === '/api/suggestions/decide' && req.method === 'POST') {
      if (!SUGGEST_REMOTE || !SUGGEST_ADMIN) return send(400, { error: 'SUGGEST_REMOTE und SUGGEST_ADMIN_PASSWORD fehlen' });
      return send(200, await remote('/api/suggest/decide', await readBody(req)));
    }

    if (url.pathname === '/api/find-author') {
      const q = url.searchParams.get('q')?.trim() ?? '';
      if (q.length < 2) return send(400, { error: 'Name zu kurz' });
      return send(200, { found: await findAuthors(q) });
    }

    if (url.pathname === '/api/candidates') {
      const c = find(url.searchParams.get('slug'));
      if (!c) return send(404, { error: 'unbekannte Sammlung' });
      return send(200, { candidates: await candidatesFor(c, url.searchParams.get('source') ?? '') });
    }

    if (url.pathname === '/api/covers') {
      const c = find(url.searchParams.get('slug'));
      const id = url.searchParams.get('id') ?? '';
      if (!c) return send(404, { error: 'unbekannte Sammlung' });
      if (!/^OL\d+W$/.test(id)) return send(400, { error: 'bad id' });
      return send(200, { covers: await coversFor(c, id) });
    }

    if (req.method !== 'POST') return send(404, { error: 'not found' });
    // Read the file afresh before every change: something else may have written
    // it since the start (from-isbns.ts did on 2026-09-25), and a save from the
    // copy in memory would silently drop that.
    collections = readJson<{ collections: CollectionRecord[] }>(OUT_FILE, { collections: [] }).collections;
    const body = await readBody<Record<string, unknown>>(req);

    if (url.pathname === '/api/create') {
      const c = newCollection(body as { title: string; slug?: string; kind: 'authors' | 'series'; intro?: string }, collections);
      collections = [...collections, c];
      save();
      return send(200, { collection: c });
    }

    const c = find(typeof body.slug === 'string' ? body.slug : null);
    if (!c) return send(404, { error: 'unbekannte Sammlung' });

    switch (url.pathname) {
      case '/api/meta': {
        const next = { ...c };
        if (typeof body.title === 'string' && body.title.trim()) next.title = body.title.trim();
        if (typeof body.intro === 'string') next.intro = body.intro.trim();
        if (typeof body.published === 'boolean') next.published = body.published;
        replace(next);
        return send(200, { collection: next });
      }
      case '/api/author': {
        const next = body.remove
          ? removeAuthor(c, String(body.remove))
          : addAuthor(c, { name: String(body.name ?? ''), keys: (body.keys as string[]) ?? [] });
        replace(next);
        return send(200, { collection: next });
      }
      case '/api/publisher': {
        const name = String(body.name ?? body.remove ?? '').trim();
        if (!name) return send(400, { error: 'Name fehlt' });
        const list = c.publishers ?? [];
        const next = { ...c, publishers: body.remove ? list.filter(p => p !== name) : list.includes(name) ? list : [...list, name] };
        replace(next);
        return send(200, { collection: next });
      }
      case '/api/pick': {
        const w = body as { id?: string; title?: string; author?: string; coverId?: string; firstPublished?: number };
        if (!w.id || !/^OL\d+W$/.test(w.id) || !w.title || !w.coverId?.startsWith('ol:')) return send(400, { error: 'Werk oder Cover fehlt' });
        const next = upsertPick(c, {
          id: w.id,
          title: w.title,
          author: (w.author ?? '').normalize('NFC'),
          coverId: w.coverId,
          ...(w.firstPublished ? { firstPublished: w.firstPublished } : {}),
          addedAt: new Date().toISOString().slice(0, 10),
        });
        replace(next);
        return send(200, { collection: next });
      }
      case '/api/remove': {
        const next = removePick(c, String(body.id ?? ''));
        replace(next);
        return send(200, { collection: next });
      }
      case '/api/order': {
        if (!Array.isArray(body.ids)) return send(400, { error: 'keine Reihenfolge' });
        const next = reorder(c, body.ids as string[]);
        replace(next);
        return send(200, { collection: next });
      }
      case '/api/delete': {
        // Only an empty collection can go: a wall of choices is never one click away from gone.
        if (c.works.length > 0) return send(400, { error: 'Erst alle Werke entfernen' });
        collections = collections.filter(x => x !== c);
        save();
        return send(200, { ok: true });
      }
    }
    send(404, { error: 'not found' });
  } catch (err) {
    // A catalogue that times out is a failure, not an empty list (CLAUDE.md): say so,
    // and keep it apart from a request the rules refused.
    const message = err instanceof Error ? err.message : String(err);
    const upstream = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'TypeError' || / from https:/.test(message));
    send(upstream ? 502 : 400, { error: upstream ? `Open Library: ${message}` : message });
  }
});

server.listen(PORT, () => {
  console.log(`collections: ${collections.length} in ${OUT_FILE}`);
  console.log(`open http://localhost:${PORT}`);
});

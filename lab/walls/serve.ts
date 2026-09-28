/**
 * Your own cover wall, saved without an account (lab/walls, ROADMAP 5.13).
 *
 *   npx tsx lab/walls/serve.ts     # then open http://localhost:4325
 *
 * Who may change a wall is decided by the visitor id in the `bb_visitor`
 * cookie (E22, like taketest.xyz). The cookie is set when a browser makes its
 * first wall or pastes an id into the footer — never for a reader who only
 * looks. It is readable by the page, because the footer shows it.
 *
 * Local only, never deployed. Walls live in `lab/walls/walls.json`
 * (git-ignored; `WALLS_FILE` points elsewhere). Only Open Library is asked,
 * never Google (lab rule 6): one search per query, one editions page per work
 * whose covers are opened, both cached in memory for the run.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEditionsPage, getWork, searchWorks } from '../../lib/sources/openlibrary';
import { parseEditions, type OlEditionEntry } from '../../lib/sources/openlibrary-parse';
import { coversFromEditions, type PickableCover } from './covers';
import { applyOp, isVisitorId, isWallId, shoppingList, toPublic, WallError, type Wall, type WallOp } from '../../lib/walls/model';
import { isOwner, newVisitorId, newWall, newWallId, ownedBy } from '../../lib/walls/owner';

const PORT = Number(process.env.PORT ?? 4325);
const HERE = __dirname;
const FILE = process.env.WALLS_FILE ?? join(HERE, 'walls.json');

function load(): Record<string, Wall> {
  return existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Wall>) : {};
}
function save(walls: Record<string, Wall>): void {
  writeFileSync(`${FILE}.tmp`, JSON.stringify(walls, null, 2));
  renameSync(`${FILE}.tmp`, FILE);
}

const MAX_EDITIONS = 300;
const coverCache = new Map<string, PickableCover[]>();

async function coversOf(workId: string): Promise<PickableCover[]> {
  const hit = coverCache.get(workId);
  if (hit) return hit;
  const work = await getWork(workId);
  if (!work) return [];
  // Open Library lists the newest records first; three pages reach the older printings.
  const entries: OlEditionEntry[] = [];
  for (let offset = 0; offset < MAX_EDITIONS; offset += 100) {
    const page = await getEditionsPage(workId, offset);
    entries.push(...page.entries);
    if (offset + 100 >= page.size) break;
  }
  const covers = coversFromEditions(parseEditions(entries, work));
  coverCache.set(workId, covers);
  return covers;
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : String(body));
}

async function body(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new WallError('Too large.');
  }
  return raw ? JSON.parse(raw) : {};
}

const COOKIE = 'bb_visitor';
const TWO_YEARS = 60 * 60 * 24 * 730;

function visitorOf(req: IncomingMessage): string | null {
  const match = (req.headers.cookie ?? '').match(/(?:^|;\s*)bb_visitor=([^;]+)/);
  return match && isVisitorId(match[1]) ? match[1] : null;
}
function setVisitor(res: ServerResponse, visitor: string): void {
  res.setHeader('set-cookie', `${COOKIE}=${visitor}; Path=/; Max-Age=${TWO_YEARS}; SameSite=Lax`);
}
/** A write must come as JSON: a cross-site form cannot send that without a preflight. */
const isJson = (req: IncomingMessage) => (req.headers['content-type'] ?? '').startsWith('application/json');


createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    if (req.method === 'GET' && (path === '/' || /^\/w\/[a-z0-9]{10}$/.test(path))) {
      return send(res, 200, readFileSync(join(HERE, 'index.html'), 'utf8'), 'text/html');
    }
    if (req.method === 'GET' && path === '/api/search') {
      const q = (url.searchParams.get('q') ?? '').trim();
      if (q.length < 3) return send(res, 200, { works: [] });
      const works = await searchWorks(q, { limit: 12 });
      return send(res, 200, {
        works: works.map((w) => ({ id: w.id, title: w.title, author: w.authors[0], year: w.firstPublishYear, cover: w.coverUrls[0] })),
      });
    }
    const covers = path.match(/^\/api\/covers\/(OL\d+W)$/);
    if (req.method === 'GET' && covers) return send(res, 200, { covers: await coversOf(covers[1]) });

    if (path === '/api/me') {
      if (req.method === 'GET') {
        const visitor = visitorOf(req);
        return send(res, 200, { visitor, walls: ownedBy(Object.values(load()), visitor) });
      }
      if (req.method === 'POST' && isJson(req)) {
        // "Save" in the footer: this browser becomes the visitor whose id was pasted.
        const { visitor } = (await body(req)) as { visitor?: string };
        const id = typeof visitor === 'string' ? visitor.trim() : '';
        if (!isVisitorId(id)) return send(res, 400, { error: 'That is not an id from this page.' });
        setVisitor(res, id);
        return send(res, 200, { visitor: id, walls: ownedBy(Object.values(load()), id) });
      }
    }

    if (req.method === 'POST' && path === '/api/walls' && isJson(req)) {
      const { title } = (await body(req)) as { title?: string };
      let visitor = visitorOf(req);
      if (!visitor) {
        visitor = newVisitorId();
        setVisitor(res, visitor);
      }
      const walls = load();
      let id = newWallId();
      while (walls[id]) id = newWallId();
      walls[id] = newWall(id, visitor, title ?? '', new Date().toISOString());
      save(walls);
      return send(res, 201, { wall: toPublic(walls[id]), visitor });
    }

    const one = path.match(/^\/api\/walls\/([a-z0-9]{10})(\/list)?$/);
    if (one && isWallId(one[1])) {
      const walls = load();
      const wall = walls[one[1]];
      if (!wall) return send(res, 404, { error: 'No such wall.' });
      if (req.method === 'GET' && one[2]) return send(res, 200, shoppingList(toPublic(wall)), 'text/plain');
      if (req.method === 'GET') {
        return send(res, 200, { wall: toPublic(wall), canEdit: isOwner(wall, visitorOf(req)) });
      }
      if (req.method === 'POST' && isJson(req)) {
        if (!isOwner(wall, visitorOf(req))) return send(res, 403, { error: 'Only the browser that made this wall can change it.' });
        const { ops } = (await body(req)) as { ops?: WallOp[] };
        let next = wall;
        for (const op of (ops ?? []).slice(0, 50)) next = applyOp(next, op, new Date().toISOString());
        walls[wall.id] = next;
        save(walls);
        return send(res, 200, { wall: toPublic(next), canEdit: true });
      }
    }
    return send(res, 404, { error: 'Not found.' });
  } catch (err) {
    if (err instanceof WallError || err instanceof SyntaxError) return send(res, 400, { error: err.message });
    // A source that did not answer is not "no covers" (SPEC N12).
    return send(res, 502, { error: 'Open Library did not answer. Try again in a moment.' });
  }
})
  .on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EADDRINUSE') throw err;
    console.error(`Port ${PORT} is taken — another walls server is probably running. Stop it, or start with PORT=4326.`);
    process.exit(1);
  })
  .listen(PORT, () => console.log(`walls: http://localhost:${PORT}`));

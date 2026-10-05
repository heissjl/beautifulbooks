/**
 * „The books that inspired me" — the local prototype (lab/inspiration, ROADMAP 5.18).
 *
 *   npx tsx lab/inspiration/serve.ts     # then open http://localhost:4333
 *
 * Local only, never deployed. A board being made lives in the address
 * (`board.ts`); a shared one gets a short id (`links.ts`, a JSON file here,
 * a Redis of its own on the site). Only Open Library is asked, never Google
 * (lab rule 6, and the point of the experiment: a viral page must not spend
 * the quota the book pages' verdicts live on). Every Open Library request
 * is counted and printed, because "how many does one finished board cost"
 * is one of the measurements.
 */
import { createServer, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { coverUrlFor, coverIdFromSegment, coverRefFromUrl } from '../../lib/coverurl';
import { SITE_NAME } from '../../lib/seo';
import { fetchBytes } from '../../lib/sources/http';
import { getEditionsPage, getWork, searchWorks } from '../../lib/sources/openlibrary';
import { parseEditions, type OlEditionEntry } from '../../lib/sources/openlibrary-parse';
import { coversFromEditions } from '../walls/covers';
import { type Board, boardQuery, coverSegment, encodeBoard, isWorkId, parseBoard } from './board';
import type { PosterFormat } from './layout';
import { fileLinkStore, ID } from './links';
import { renderPoster } from './poster';
import { shareTargets, shareText } from './share';

const PORT = Number(process.env.PORT ?? 4333);
const HERE = __dirname;
/**
 * The live site, not SITE_URL: run locally, SITE_URL is localhost:3000, and a
 * poster saying so would lead nowhere (as lab/shelf does, INSPIRATION_SITE overrides).
 */
const SITE = (process.env.INSPIRATION_SITE ?? 'https://buyitscovers.com').replace(/\/$/, '');
/** The page's path on the site, and what the poster prints under the covers. */
const PATH = '/inspiration';
const ADDRESS = `${new URL(SITE).host}${PATH}`;
const links = fileLinkStore(process.env.INSPIRATION_LINKS ?? join(HERE, 'links.json'));

let olCalls = 0;
const counted = <T>(p: Promise<T>): Promise<T> => {
  olCalls++;
  return p;
};

const searchCache = new Map<string, unknown>();
const coverCache = new Map<string, unknown>();
const workCache = new Map<string, { title: string; author?: string } | null>();
const imageCache = new Map<string, Uint8Array | null>();

/** Title and first author of a work, for the shared page and the shopping list. */
async function workOf(workId: string) {
  if (workCache.has(workId)) return workCache.get(workId) ?? null;
  const work = await counted(getWork(workId));
  const brief = work ? { title: work.title, author: work.authors[0] } : null;
  workCache.set(workId, brief);
  return brief;
}

/**
 * One editions walk per work, as lab/walls does: three pages reach the older printings.
 * `checked` of `total` goes with the covers, so the window can say what it has not looked at —
 * The Great Gatsby has 1,180 editions on record and three pages are 300 of them.
 */
async function coversOf(workId: string) {
  const hit = coverCache.get(workId);
  if (hit) return hit;
  const work = await counted(getWork(workId));
  if (!work) return { covers: [], checked: 0, total: 0 };
  workCache.set(workId, { title: work.title, author: work.authors[0] });
  const entries: OlEditionEntry[] = [];
  let total = 0;
  for (let offset = 0; offset < 300; offset += 100) {
    const page = await counted(getEditionsPage(workId, offset));
    entries.push(...page.entries);
    total = page.size;
    if (offset + 100 >= page.size) break;
  }
  const covers = coversFromEditions(parseEditions(entries, work)).map(c => ({
    coverId: `ol:${c.coverId}`,
    year: c.year,
    publisher: c.printings[0]?.publisher,
  }));
  const answer = { covers, checked: entries.length, total };
  coverCache.set(workId, answer);
  return answer;
}

async function loadCover(coverId: string): Promise<Uint8Array | null> {
  if (imageCache.has(coverId)) return imageCache.get(coverId) ?? null;
  const url = coverUrlFor(coverId, 'L');
  const bytes = url ? await counted(fetchBytes(url, { timeoutMs: 10_000, revalidate: 0 })).catch(() => null) : null;
  imageCache.set(coverId, bytes);
  return bytes;
}

/** The board with titles, the links a shared page needs, and the share texts. */
async function describe(board: Board, id: string | null) {
  const books = await Promise.all(board.slots.map(async s => {
    if (!s) return null;
    const w = await workOf(s.workId).catch(() => null);
    return {
      ...s,
      title: w?.title ?? null,
      author: w?.author ?? null,
      // The book page with this cover selected: its shops, its verdict (SPEC F9.3 route, ROADMAP 6.20).
      bookHref: `${SITE}/book/${s.workId}/cover/${coverSegment(s.coverId)}`,
    };
  }));
  const link = id ? `${SITE}${PATH}/${id}` : null;
  return {
    books,
    by: board.by,
    id,
    link,
    share: link ? shareTargets(link, board.by) : [],
    text: shareText(board.by),
    // The funnel into a collection of one's own (SPEC F9): the site reads the fragment on /create. Not built there yet.
    collectionHref: `${SITE}/create#inspiration=${encodeBoard(board)}`,
    posterQuery: boardQuery(board),
  };
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : String(body));
}

/** board.ts for the browser: the same module, types stripped, so the page and the server cannot drift. */
const boardJs = ts.transpileModule(readFileSync(join(HERE, 'board.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;

function page(): string {
  return readFileSync(join(HERE, 'index.html'), 'utf8')
    .replaceAll('{{SITE_NAME}}', SITE_NAME)
    // The brand is set in italics wherever prose names it (Julian, 2026-10-05), as the wordmark is.
    .replaceAll('{{BRAND}}', `<i class="brand">${SITE_NAME}</i>`)
    .replaceAll('{{SITE}}', SITE)
    .replaceAll('{{PATH}}', PATH);
}

async function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4_000) throw new SyntaxError('Too large.');
  }
  return raw ? JSON.parse(raw) : {};
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const before = olCalls;
  try {
    if (path === '/' || path === PATH || new RegExp(`^${PATH}/[a-z2-7]{8}$`).test(path)) {
      return send(res, 200, page(), 'text/html');
    }
    if (path === '/board.js') return send(res, 200, boardJs, 'text/javascript');

    if (req.method === 'POST' && path === '/api/link') {
      if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { error: 'Send JSON.' });
      const body = (await readBody(req)) as { q?: string };
      const board = parseBoard(new URLSearchParams(typeof body.q === 'string' ? body.q : ''));
      const id = await links.put(board);
      return send(res, 201, await describe(board, id));
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'GET only.' });

    // The board behind a short id, or behind the address of one being made.
    const link = path.match(/^\/api\/link\/([a-z2-7]{8})$/);
    if (link && ID.test(link[1])) {
      const board = await links.get(link[1]);
      // Not "no such board": the file may have been lost, and the link was once real.
      if (!board) return send(res, 404, { error: 'This link’s board is not on record here.' });
      return send(res, 200, await describe(board, link[1]));
    }
    if (path === '/api/board') return send(res, 200, await describe(parseBoard(url.searchParams), null));

    if (path === '/api/search') {
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      if (q.length < 3) return send(res, 200, { works: [] });
      if (!searchCache.has(q)) {
        const works = await counted(searchWorks(q, { limit: 10 }));
        searchCache.set(q, works.map(w => ({
          id: w.id,
          title: w.title,
          author: w.authors[0],
          year: w.firstPublishYear,
          // The work's best-known cover is the default; the edition is a second step.
          coverId: w.coverUrls.map(u => coverRefFromUrl(u)?.coverId).find(Boolean) ?? null,
        })));
      }
      return send(res, 200, { works: searchCache.get(q) });
    }
    const covers = path.match(/^\/api\/covers\/(OL\d+W)$/);
    if (covers && isWorkId(covers[1])) return send(res, 200, await coversOf(covers[1]));

    // Like the site's /img/ route: the path carries an id, never a URL.
    const img = path.match(/^\/img\/(S|M|L)\/([^/]+)$/);
    if (img) {
      const id = coverIdFromSegment(img[2]);
      const target = id ? coverUrlFor(id, img[1] as 'S' | 'M' | 'L') : null;
      if (!target) return send(res, 400, { error: 'Not a cover id.' });
      res.writeHead(302, { location: target });
      return res.end();
    }

    if (path === '/poster.png') {
      const format: PosterFormat = url.searchParams.get('format') === 'feed' ? 'feed' : 'story';
      const board = parseBoard(url.searchParams);
      const title = board.by ? `The books that inspired ${board.by}` : 'The books that inspired me';
      const png = await renderPoster(board, format, { title, site: SITE_NAME, address: ADDRESS }, loadCover);
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      return res.end(png);
    }
    return send(res, 404, { error: 'Not found.' });
  } catch (err) {
    if (err instanceof SyntaxError) return send(res, 400, { error: err.message });
    if (err instanceof Error && /empty board/.test(err.message)) return send(res, 400, { error: err.message });
    // A source that did not answer is not "no books" (SPEC N12).
    return send(res, 502, { error: 'Open Library did not answer. Try again in a moment.' });
  } finally {
    if (olCalls > before) console.log(`${path}: ${olCalls - before} Open Library request(s), ${olCalls} since start`);
  }
})
  .on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EADDRINUSE') throw err;
    console.error(`Port ${PORT} is taken. Start with PORT=4334.`);
    process.exit(1);
  })
  .listen(PORT, () => console.log(`inspiration: http://localhost:${PORT}${PATH}`));

/**
 * "The 9 books that made me" — the local prototype (lab/nine, ROADMAP 5.18).
 *
 *   npx tsx lab/nine/serve.ts     # then open http://localhost:4333
 *
 * Local only, never deployed. The board lives in the address (`board.ts`), so
 * the server stores nothing. Only Open Library is asked, never Google (lab
 * rule 6, and the point of the experiment: a viral page must not spend the
 * quota the book pages' verdicts live on). Every Open Library request is
 * counted and printed, because "how many does one finished board cost" is
 * one of the measurements.
 */
import { createServer, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverUrlFor, coverIdFromSegment, coverRefFromUrl } from '../../lib/coverurl';
import { SITE_NAME, SITE_URL } from '../../lib/seo';
import { fetchBytes } from '../../lib/sources/http';
import { getEditionsPage, getWork, searchWorks } from '../../lib/sources/openlibrary';
import { parseEditions, type OlEditionEntry } from '../../lib/sources/openlibrary-parse';
import { coversFromEditions } from '../walls/covers';
import { isWorkId, parseBoard } from './board';
import type { PosterFormat } from './layout';
import { renderPoster } from './poster';

const PORT = Number(process.env.PORT ?? 4333);
const HERE = __dirname;
/** What the poster prints as the address: the site's host and the page's path. */
const ADDRESS = `${new URL(SITE_URL).host}/9`;
const TITLE = 'The 9 books that made me';

let olCalls = 0;
const counted = <T>(p: Promise<T>): Promise<T> => {
  olCalls++;
  return p;
};

const searchCache = new Map<string, unknown>();
const coverCache = new Map<string, unknown>();
const imageCache = new Map<string, Uint8Array | null>();

/** One editions walk per work, as lab/walls does: three pages reach the older printings. */
async function coversOf(workId: string) {
  const hit = coverCache.get(workId);
  if (hit) return hit;
  const work = await counted(getWork(workId));
  if (!work) return [];
  const entries: OlEditionEntry[] = [];
  for (let offset = 0; offset < 300; offset += 100) {
    const page = await counted(getEditionsPage(workId, offset));
    entries.push(...page.entries);
    if (offset + 100 >= page.size) break;
  }
  const covers = coversFromEditions(parseEditions(entries, work)).map(c => ({
    coverId: `ol:${c.coverId}`,
    year: c.year,
    publisher: c.printings[0]?.publisher,
  }));
  coverCache.set(workId, covers);
  return covers;
}

async function loadCover(coverId: string): Promise<Uint8Array | null> {
  if (imageCache.has(coverId)) return imageCache.get(coverId) ?? null;
  const url = coverUrlFor(coverId, 'L');
  const bytes = url ? await counted(fetchBytes(url, { timeoutMs: 10_000, revalidate: 0 })).catch(() => null) : null;
  imageCache.set(coverId, bytes);
  return bytes;
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : String(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const before = olCalls;
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'GET only.' });
    if (path === '/') {
      const html = readFileSync(join(HERE, 'index.html'), 'utf8').replaceAll('{{SITE_NAME}}', SITE_NAME).replaceAll('{{SITE_URL}}', SITE_URL);
      return send(res, 200, html, 'text/html');
    }
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
    if (covers && isWorkId(covers[1])) return send(res, 200, { covers: await coversOf(covers[1]) });

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
      const png = await renderPoster(board, format, { title: TITLE, site: SITE_NAME, address: ADDRESS }, loadCover);
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      return res.end(png);
    }
    return send(res, 404, { error: 'Not found.' });
  } catch {
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
  .listen(PORT, () => console.log(`nine: http://localhost:${PORT}`));

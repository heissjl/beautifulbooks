/**
 * The local MVP of the record page (ROADMAP 5.16a, PLAN-5.16a): any album,
 * searched at MusicBrainz, its page built when it is opened.
 *
 *   npx tsx lab/vinyl/serve.ts     # then open http://127.0.0.1:4342
 *
 * Local only, never deployed; binds 127.0.0.1. Asks MusicBrainz, the Cover
 * Art Archive, Wikidata and Wikipedia — never Google Books (lab rule 6).
 * Everything it fetched is kept under `out/` (git-ignored); a finished album
 * is one file in `out/albums/`, and opening it again asks nothing.
 *
 *   GET /                         the page (app.html)
 *   GET /api/search?q=            ranked release groups (rank.ts)
 *   GET /api/album/<mbid>[?retry=1]  the album as far as it is loaded (album.ts)
 *   GET /img/<key>                a front thumbnail from the cache
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAlbums, type Albums } from './album';
import { mbQuery, rankGroups, type MbReleaseGroup } from './rank';
import { createSources, MB, type Sources } from './sources';

const DIR = import.meta.dirname;
const OUT = join(DIR, 'out');
const PORT = Number(process.env.PORT ?? 4342);

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The request handler, apart from the listening, so a test can give it sources without network. */
export function createHandler(sources: Sources, albums: Albums) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    try {
      if (url.pathname === '/' || url.pathname.startsWith('/album/')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(readFileSync(join(DIR, 'app.html')));
        return;
      }
      if (url.pathname === '/api/search') {
        const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
        if (!q) return send(400, { error: 'Type an album or an artist.' });
        try {
          const found = await sources.json<{ 'release-groups': MbReleaseGroup[] }>(
            `${MB}/release-group?query=${encodeURIComponent(mbQuery(q))}&limit=25&fmt=json`, 'musicbrainz');
          return send(200, { query: q, hits: rankGroups(found?.['release-groups'] ?? [], q) });
        } catch (e) {
          // A source that did not answer is not "no albums found" (CLAUDE.md, SPEC N12).
          return send(502, { error: `MusicBrainz did not answer the search (${(e as Error).message}).` });
        }
      }
      const album = url.pathname.match(/^\/api\/album\/([^/]+)$/);
      if (album) {
        if (!MBID.test(album[1])) return send(400, { error: 'Not a MusicBrainz id.' });
        return send(200, albums.snapshot(album[1], url.searchParams.get('retry') === '1'));
      }
      const img = url.pathname.match(/^\/img\/([0-9a-f]{40})$/);
      if (img) {
        const file = join(sources.imgDir, img[1]);
        if (!existsSync(file)) return send(404, { error: 'not cached' });
        const bytes = readFileSync(file);
        const png = bytes[0] === 0x89 && bytes[1] === 0x50;
        res.writeHead(200, { 'Content-Type': png ? 'image/png' : 'image/jpeg', 'Cache-Control': 'max-age=86400' });
        res.end(bytes);
        return;
      }
      send(404, { error: 'not found' });
    } catch (e) {
      send(500, { error: (e as Error).message });
    }
  };
}

if (process.argv[1] && /serve\.ts$/.test(process.argv[1])) {
  const sources = createSources({ cacheDir: join(OUT, 'mvp-cache') });
  createServer(createHandler(sources, createAlbums({ sources, dir: OUT }))).listen(PORT, '127.0.0.1', () => {
    console.log(`Beautiful Records, local MVP: http://127.0.0.1:${PORT}`);
  });
}

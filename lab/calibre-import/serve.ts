/**
 * The Calibre library as a collection on the site: look, tick, upload
 * (lab/calibre-import, ROADMAP 5.17).
 *
 *   npx tsx lab/calibre-import/measure.ts          # first: ask the catalogue (once, cached)
 *   npx tsx lab/calibre-import/serve.ts            # then: the review page, uploads to npm run dev
 *   npx tsx lab/calibre-import/serve.ts --base https://buyitscovers.com
 *
 * One row per book: the Calibre cover and title on the left, the work the
 * catalogue found on the right, and why. Matches are ticked, suggestions are
 * not; a row can be corrected with a search of its own. "Create the
 * collection" sends the ticked rows to the site in one request and writes the
 * map that lets `lab/calibre` find each book again (`lab/calibre/map.ts`).
 *
 * Local only, never deployed: binds 127.0.0.1 and takes requests only with
 * the token printed at start. Calibre is read and never written here. The
 * catalogue is Open Library, never Google (lab rule 6).
 *
 * The upload goes to `--base`, by default the dev server — the site itself is
 * named explicitly, once, by Julian. The visitor id comes from `BB_VISITOR`
 * (see `upload.ts`) and is never shown, logged or stored by this tool.
 * `--test-visitor` makes a throwaway id for a dev server and prints the link
 * that hands it to the browser. `--as-test` uploads as the test visitor
 * (`BB_TEST_VISITOR`): tests on the live site go there, never among Julian's
 * own collections.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverIdFromUrl } from '../../lib/bookmatch';
import type { WorkSummary } from '../../lib/model';
import { cleanTitle } from '../../lib/walls/model';
import { newVisitorId } from '../../lib/walls/owner';
import { tileFromWork } from '../../lib/walls/photo';
import { hostAllowed, makeToken, originAllowed, tokenMatches } from '../../scripts/cockpit/guard';
import { coverFile, findLibrary, readLibrary } from '../calibre/library';
import { writeMap } from '../calibre/map';
import { defaultBackupRoot, libraryKey } from '../calibre/safety';
import { tally, tilesOf, type Assignment } from './assign';
import { Catalogue, DiskCache, stateDir } from './lookup';
import { included, rowsOf, type Decisions } from './review';
import { DEFAULT_TITLE, isLocalBase, TEST_VISITOR_VAR, uploadWall, UploadError, visitorFromEnv, VISITOR_VAR } from './upload';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const PORT = Number(flag('port') ?? process.env.PORT ?? 4328);
const BASE = (flag('base') ?? 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = makeToken();

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  const payload = Buffer.isBuffer(body) ? body : type === 'application/json' ? JSON.stringify(body) : String(body);
  const image = type.startsWith('image/');
  res.writeHead(status, { 'content-type': image ? type : `${type}; charset=utf-8`, 'cache-control': image ? 'private, max-age=3600' : 'no-store' });
  res.end(payload);
}

async function jsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new SyntaxError('Too large.');
  }
  const parsed: unknown = raw ? JSON.parse(raw) : {};
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

function writeJson(file: string, value: unknown): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 1));
  renameSync(tmp, file);
}

interface UploadRecord {
  wallId: string;
  base: string;
  at: string;
  tiles: number;
  books: number;
}

async function main(): Promise<void> {
  const library = findLibrary(flag('library'));
  const books = readLibrary(library);
  const dir = stateDir(library);
  mkdirSync(dir, { recursive: true });
  const measured = join(dir, 'assignments.json');
  if (!existsSync(measured)) throw new Error('Nothing measured yet for this library. Run first:  npx tsx lab/calibre-import/measure.ts');
  const { assignments, measuredAt } = JSON.parse(readFileSync(measured, 'utf8')) as { assignments: Assignment[]; measuredAt: string };
  const decisionsFile = join(dir, 'decisions.json');
  const decisions: Decisions = existsSync(decisionsFile) ? (JSON.parse(readFileSync(decisionsFile, 'utf8')) as Decisions) : {};
  const uploadsFile = join(dir, 'uploads.json');
  const uploads: UploadRecord[] = existsSync(uploadsFile) ? (JSON.parse(readFileSync(uploadsFile, 'utf8')) as UploadRecord[]) : [];
  const cache = new DiskCache(join(dir, 'cache.json'));
  const catalogue = new Catalogue(cache);

  /* The id never leaves this variable except as the cookie of the one upload request. */
  const AS_TEST = args.includes('--as-test');
  const visitorVar = AS_TEST ? TEST_VISITOR_VAR : VISITOR_VAR;
  let visitor = visitorFromEnv(process.env, process.cwd(), visitorVar);
  let visitorNote = `${visitorVar} is ${visitor ? 'set' : 'not set'}${AS_TEST ? ' — the test visitor, not Julian’s own collections' : ''}`;
  if (args.includes('--test-visitor')) {
    if (!isLocalBase(BASE)) throw new Error('--test-visitor is for a dev server only. For the site, set BB_VISITOR to the ID shown on /create ("Your ID").');
    visitor = newVisitorId();
    visitorNote = 'a throwaway ID for this run';
    // A throwaway on a dev server, printed so the browser can take it over (5.13l); a real id is never printed.
    console.log(`test id: open ${BASE}/create#id=${visitor} once, so the browser owns what this run creates`);
  }

  const TITLE = AS_TEST ? `${DEFAULT_TITLE} (test)` : DEFAULT_TITLE;

  /* Works a search of this run returned: a row may only be given one of these, never an id from the page. */
  const offered = new Map<string, WorkSummary>();

  const rows = () => rowsOf(books, assignments, decisions);
  const state = () => {
    const all = rows();
    const { tiles } = tilesOf(included(all));
    return {
      library: { path: library, books: books.length },
      measuredAt,
      tally: tally(assignments),
      rows: all,
      ticked: { books: included(all).length, tiles: tiles.length },
      upload: { base: BASE, local: isLocalBase(BASE), ready: !!visitor, visitorNote, title: TITLE, past: uploads },
    };
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    const path = url.pathname;
    try {
      if (!hostAllowed(req.headers.host, PORT)) return send(res, 403, { error: 'Wrong host.' });
      if (req.method === 'GET' && path === '/') return send(res, 200, readFileSync(join(__dirname, 'index.html'), 'utf8'), 'text/html');
      const given = req.headers['x-token'] ?? url.searchParams.get('t');
      if (!tokenMatches(typeof given === 'string' ? given : null, TOKEN)) return send(res, 403, { error: 'Open the address the terminal printed — it carries the token.' });

      if (req.method === 'GET' && path === '/api/state') return send(res, 200, state());

      const old = /^\/old\/(\d{1,9})$/.exec(path);
      if (req.method === 'GET' && old) {
        // The folder comes from the database by the book's number, never from the request.
        const book = books.find((b) => b.id === Number(old[1]));
        const file = book ? coverFile(library, book) : null;
        if (!file || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: 'No cover.' });
        return send(res, 200, readFileSync(file), 'image/jpeg');
      }

      if (req.method === 'GET' && path === '/api/search') {
        const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
        if (q.length < 3) return send(res, 400, { error: 'Type at least three letters.' });
        let works: WorkSummary[];
        try {
          works = await catalogue.find(q);
          cache.flush();
        } catch {
          // Silence is not "no such book" (SPEC N12).
          return send(res, 503, { error: 'Open Library did not answer. Try again in a moment.' });
        }
        const top = works.slice(0, 8).filter((w) => tileFromWork(w));
        for (const w of top) offered.set(w.id, w);
        return send(res, 200, { works: top.map((w) => ({ id: w.id, title: w.title, authors: w.authors.slice(0, 2), year: w.firstPublishYear, coverId: coverIdFromUrl(w.coverUrls[0]) })) });
      }

      if (req.method === 'POST' && ['/api/decide', '/api/choose', '/api/upload'].includes(path)) {
        if (!originAllowed(req.headers.origin, PORT)) return send(res, 403, { error: 'Wrong origin.' });
        if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { error: 'Send JSON.' });
        const body = await jsonBody(req);

        if (path === '/api/upload') {
          if (!visitor) {
            return send(res, 409, {
              error: isLocalBase(BASE)
                ? 'No visitor ID. Start the tool with --test-visitor for a dev server, or set BB_VISITOR.'
                : `No visitor ID. Put ${visitorVar}=<ID> into the main folder’s .env.local${AS_TEST ? '' : ' — your ID is on /create under "Your ID"'}.`,
            });
          }
          const chosen = included(rows());
          const { tiles, bookWorks } = tilesOf(chosen);
          try {
            const up = await uploadWall({ base: BASE, visitor, title: cleanTitle(body.title) || TITLE, tiles });
            const mapFile = writeMap(defaultBackupRoot(), { wall: up.wallId, library: libraryKey(library), createdAt: new Date().toISOString(), books: bookWorks });
            uploads.push({ wallId: up.wallId, base: BASE, at: new Date().toISOString(), tiles: up.tiles, books: bookWorks.length });
            writeJson(uploadsFile, uploads);
            console.log(`created: ${up.editUrl} — ${up.tiles} tiles from ${bookWorks.length} books; map in ${mapFile}`);
            return send(res, 200, { ok: true, editUrl: up.editUrl, tiles: up.tiles, books: bookWorks.length, state: state() });
          } catch (err) {
            if (err instanceof UploadError) return send(res, 502, { error: err.message });
            throw err;
          }
        }

        const book = books.find((b) => b.id === body.bookId);
        if (!book) return send(res, 404, { error: 'No such book in the library.' });
        const key = String(book.id);
        if (path === '/api/decide') {
          if (typeof body.include !== 'boolean') return send(res, 400, { error: 'include must be true or false.' });
          decisions[key] = { ...decisions[key], include: body.include };
        } else {
          // `null` takes a hand-picked work back.
          if (body.workId === null) {
            delete decisions[key];
          } else {
            const work = typeof body.workId === 'string' ? offered.get(body.workId) : undefined;
            const tile = work ? tileFromWork(work) : undefined;
            if (!tile) return send(res, 404, { error: 'That work is not among the results of a search in this run.' });
            decisions[key] = { include: true, tile };
          }
        }
        writeJson(decisionsFile, decisions);
        return send(res, 200, { ok: true, state: state() });
      }
      return send(res, 404, { error: 'Not found.' });
    } catch (err) {
      if (err instanceof SyntaxError) return send(res, 400, { error: err.message });
      console.error(`failed: ${path}: ${(err as Error).message}`);
      return send(res, 500, { error: 'The tool failed on this request; the terminal says more.' });
    }
  });

  server
    .on('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE') throw err;
      console.error(`Port ${PORT} is taken — stop the other tool, or start with --port 4329.`);
      process.exit(1);
    })
    .listen(PORT, '127.0.0.1', () => {
      const t = tally(assignments);
      console.log(`calibre-import: ${books.length} books, ${t.match} with a work, ${t.suggestion} suggestions, ${t.none} not found, ${t.failed} without an answer`);
      console.log(`library: ${library}`);
      console.log(`upload:  ${BASE} (${visitorNote})`);
      console.log(`open:    http://127.0.0.1:${PORT}/?t=${TOKEN}`);
    });
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});

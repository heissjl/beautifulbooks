/**
 * The Calibre library as a wall of covers, each one replaceable from the catalogue the site shows (lab/calibre, ROADMAP 5.16a).
 *
 *   npx tsx lab/calibre/app.ts            # look only: browse, find works, compare covers — nothing can be written
 *   npx tsx lab/calibre/app.ts --write    # „Use this cover" writes, one book per click
 *
 * Julian, 2026-10-03: „lass uns daraus eine lokale app bauen mit gui die mir
 * meine calibre cover anzeigt und dann die website benutzt, damit ich gezielt
 * cover ersetzen kann". Library first: the page shows every book with the
 * cover it has; a click finds the work (`find.ts`), lays out the work's covers
 * as the site's book page would know them, and a second click compares one
 * with the cover in Calibre.
 *
 * „Uses the website" means its code and its catalogue, run here: the search
 * is `lib/search.ts`, the editions are read as `lib/sources/openlibrary.ts`
 * reads them. The live site is not called — its rate limits and its Google
 * quota belong to its visitors — and Google Books is never asked (lab rule 6).
 *
 * `--library <folder>` points at another library (a rehearsal copy).
 * `--port auto` takes any free port and `--exit-with-parent` ends the server
 * when its standard input closes — both for the macOS app (`macos/`), which
 * starts this file and must not leave a server behind when it quits. Local
 * only: 127.0.0.1, a token per run, and every write goes through `safety.ts`
 * with all its guards. A request names a book number and a cover id, both
 * checked; never a path, an address or a command.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getEditionsPage, getWork, isWorkId, makeToken, parseEditions, type Work } from './site';
import { pickCovers } from './covers';
import { CoverDownloads, CoverSizes } from './download';
import { findWorks, WorkMap } from './find';
import { jsonBody, refused, send } from './http';
import { imageFacts, imageSizeFast, isSmaller, type ImageFacts } from './image';
import { coverFile, findLibrary, readLibrary, type CalibreBook } from './library';
import { findSyncScript, pocketbookStatus, readSyncConfig, runSync } from './pocketbook';
import { CoverWriter, defaultBackupRoot, findCalibredb, undoStacks } from './safety';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const WRITE = args.includes('--write');
// `auto`: the system picks a free port; the real number is known once the server listens.
let PORT = flag('port') === 'auto' ? 0 : Number(flag('port') ?? process.env.PORT ?? 4329);
const ROOT = join(__dirname, '../..');
const SITE = 'https://buyitscovers.com';
const TOKEN = makeToken();
const COVER_ID = /^(ol:\d{1,12}|gb:[A-Za-z0-9_-]{1,40})$/;
/** Open Library hands out 100 editions a page; ten pages reach the older printings of a much-printed book. */
const MAX_OFFSET = 900;

const library = findLibrary(flag('library'));
const writer = new CoverWriter({ library, calibredb: findCalibredb(), backupRoot: defaultBackupRoot() });
const works = new WorkMap(join(writer.root, 'works.json'));
const downloads = new CoverDownloads(SITE);
// Cover ids are the catalogue's, not a library's: one file of sizes for every library.
const coverSizes = new CoverSizes(join(defaultBackupRoot(), 'cover-sizes.json'), SITE);
let books = readLibrary(library);

/*
 * The size of every cover in Calibre, from the file header; read again only
 * when the file changed. The file's change time is also the picture's version
 * in the page's address: the wall must show the cover the book has *now*,
 * whoever changed it — this app, an undo, or Calibre itself (Julian,
 * 2026-10-03: „in the general preview show always the cover that is currently used").
 */
const sizes = new Map<number, { v: number; size: { width: number; height: number } | null }>();
function coverNow(book: CalibreBook): { v: number; size: { width: number; height: number } | null } | null {
  const file = coverFile(library, book);
  if (!existsSync(file)) return null;
  const v = Math.round(statSync(file).mtimeMs);
  const known = sizes.get(book.id);
  if (known && known.v === v) return known;
  const fresh = { v, size: imageSizeFast(readFileSync(file)) };
  sizes.set(book.id, fresh);
  return fresh;
}

function oldFacts(book: CalibreBook): ImageFacts | { missing: string } {
  const file = coverFile(library, book);
  if (!existsSync(file)) return { missing: book.hasCover ? 'The cover file is not on this Mac (iCloud).' : 'No cover yet.' };
  return imageFacts(readFileSync(file)) ?? { missing: 'The current cover does not decode.' };
}

function state() {
  // Read anew every time: a book added or a cover changed in Calibre shows up on the next look.
  try {
    books = readLibrary(library);
  } catch {
    // Calibre may be writing this very moment; the list from a moment ago is still the best answer.
  }
  const stacks = undoStacks(writer.journal());
  const remembered = works.all();
  return {
    mode: WRITE ? 'write' : 'preview',
    problems: WRITE ? writer.problems() : [],
    library: { path: library, books: books.length },
    backupRoot: writer.root,
    books: books.map((b) => {
      const stack = stacks.get(b.id);
      const cover = coverNow(b);
      return {
        id: b.id,
        title: b.title,
        authors: b.authors,
        isbns: b.isbns,
        languages: b.languages,
        formats: b.formats,
        hasCover: b.hasCover,
        size: cover?.size ?? null,
        v: cover?.v ?? 0,
        ...(remembered[b.id] ? { workId: remembered[b.id] } : {}),
        // The cover the tool last put there, while that write can still be taken back.
        ...(stack ? { applied: stack[stack.length - 1].coverId, canUndo: !!stack[stack.length - 1].backup } : {}),
      };
    }),
  };
}

/* Works and their edition pages, kept for the run: Open Library takes seconds for each. */
const workCache = new Map<string, Promise<Work | null>>();
const pageCache = new Map<string, Promise<{ covers: ReturnType<typeof pickCovers>; size: number }>>();
const forget = <T>(cache: Map<string, Promise<T>>, key: string, p: Promise<T>): Promise<T> => {
  // A source that did not answer is asked again next time, not remembered as empty (SPEC N12).
  p.catch(() => cache.delete(key));
  return p;
};
function workOf(id: string): Promise<Work | null> {
  return workCache.get(id) ?? forget(workCache, id, workCache.set(id, getWork(id)).get(id) as Promise<Work | null>);
}
function coverPage(workId: string, offset: number) {
  const key = `${workId}@${offset}`;
  const have = pageCache.get(key);
  if (have) return have;
  const p = (async () => {
    const work = await workOf(workId);
    if (!work) return { covers: [], size: 0 };
    const page = await getEditionsPage(workId, offset);
    return { covers: pickCovers(parseEditions(page.entries, work)), size: page.size };
  })();
  pageCache.set(key, p);
  return forget(pageCache, key, p);
}

let syncing = false;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  try {
    if (refused(req, res, url, PORT, TOKEN)) return;
    if (req.method === 'GET' && path === '/') return send(res, 200, readFileSync(join(__dirname, 'app.html'), 'utf8'), 'text/html');
    if (req.method === 'GET' && path === '/api/state') return send(res, 200, state());

    const bookPath = /^\/(?:api\/)?(old|find)\/(\d{1,9})$/.exec(path);
    if (req.method === 'GET' && bookPath) {
      const book = books.find((b) => b.id === Number(bookPath[2]));
      if (!book) return send(res, 404, { error: 'No such book.' });
      if (bookPath[1] === 'find') {
        const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
        return send(res, 200, await findWorks(book, SITE, works.get(book.id), q || undefined));
      }
      if (path.startsWith('/api/')) return send(res, 200, oldFacts(book));
      const file = coverFile(library, book);
      if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: 'No cover.' });
      return send(res, 200, readFileSync(file), 'image/jpeg');
    }

    const coversOf = /^\/api\/covers\/(OL\d+W)$/.exec(path);
    if (req.method === 'GET' && coversOf && isWorkId(coversOf[1])) {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET || offset % 100 !== 0) return send(res, 400, { error: 'Bad offset.' });
      try {
        const page = await coverPage(coversOf[1], offset);
        const next = offset + 100 < page.size && offset + 100 <= MAX_OFFSET ? offset + 100 : null;
        // Sizes already known ride along, so a work opened before sorts at once.
        const covers = page.covers.map((c) => ({ ...c, ...(coverSizes.peek(c.coverId) ? { size: coverSizes.peek(c.coverId) } : {}) }));
        return send(res, 200, { covers, editions: page.size, next });
      } catch {
        return send(res, 502, { error: 'Open Library did not answer. Try again in a moment.' });
      }
    }

    const coverId = url.searchParams.get('cover') ?? '';
    if (req.method === 'GET' && path === '/api/size') {
      if (!COVER_ID.test(coverId)) return send(res, 400, { error: 'Bad cover id.' });
      return send(res, 200, { size: await coverSizes.get(coverId) });
    }
    if (req.method === 'GET' && (path === '/api/new' || path === '/new')) {
      if (!COVER_ID.test(coverId)) return send(res, 400, { error: 'Bad cover id.' });
      const f = await downloads.get(coverId);
      if (f.check.ok) coverSizes.remember(coverId, f.check);
      if (path === '/api/new') return send(res, 200, f.check);
      if (!f.check.ok || !f.bytes) return send(res, 502, { error: f.check.ok ? 'No image.' : f.check.reason });
      return send(res, 200, f.bytes, `image/${f.check.format}`);
    }

    if (req.method === 'POST' && (path === '/api/work' || path === '/api/apply' || path === '/api/undo')) {
      const body = await jsonBody(req);
      const book = books.find((b) => b.id === body.bookId);
      if (!book) return send(res, 404, { error: 'No such book in the library.' });

      // Remembering which work a book is touches only the tool's own file, so it works without --write.
      if (path === '/api/work') {
        if (typeof body.workId !== 'string' || !isWorkId(body.workId) || !/^OL\d+W$/.test(body.workId)) return send(res, 400, { error: 'Bad work id.' });
        works.set(book.id, body.workId);
        return send(res, 200, { ok: true });
      }

      if (!WRITE) return send(res, 403, { error: 'This run only looks. Start it with --write to change the library.' });
      if (path === '/api/undo') {
        const result = writer.undo(book.id);
        if (result.ok) books = result.books;
        return send(res, result.ok ? 200 : 409, result.ok ? { ok: true, state: state() } : result);
      }

      if (typeof body.coverId !== 'string' || !COVER_ID.test(body.coverId)) return send(res, 400, { error: 'Bad cover id.' });
      const f = await downloads.get(body.coverId);
      if (!f.check.ok || !f.bytes) return send(res, 409, { error: f.check.ok ? 'No image.' : f.check.reason });
      const current = oldFacts(book);
      if (!('missing' in current) && isSmaller(f.check, current) && body.allowSmaller !== true) {
        return send(res, 409, { smaller: true, error: `The new cover (${f.check.width} × ${f.check.height}) has fewer pixels than the one the book has (${current.width} × ${current.height}).` });
      }
      const result = writer.apply(book.id, f.bytes, body.coverId);
      if (result.ok) books = result.books;
      return send(res, result.ok ? 200 : 409, result.ok ? { ok: true, state: state() } : result);
    }
    /* The PocketBook highlights sync: Julian's own script, started as it is (pocketbook.ts). */
    if (path === '/api/pocketbook') {
      const script = findSyncScript(ROOT);
      const status = pocketbookStatus(script, readSyncConfig(), existsSync);
      if (req.method === 'GET') return send(res, 200, { ...status, running: syncing });
      if (req.method === 'POST') {
        if (status.problems.length || !script) return send(res, 409, { error: status.problems.join(' ') });
        if (syncing) return send(res, 409, { error: 'A sync is already running.' });
        syncing = true;
        try {
          return send(res, 200, await runSync(script));
        } finally {
          syncing = false;
        }
      }
    }
    return send(res, 404, { error: 'Not found.' });
  } catch (err) {
    if (err instanceof SyntaxError) return send(res, 400, { error: err.message });
    return send(res, 500, { error: (err as Error).message });
  }
});

server
  .on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EADDRINUSE') throw err;
    console.error(`Port ${PORT} is taken — the app is probably running already. Stop it, or start with --port 4331.`);
    process.exit(1);
  })
  .listen(PORT, '127.0.0.1', () => {
    PORT = (server.address() as AddressInfo).port;
    console.log(`calibre: ${books.length} books, ${books.filter((b) => b.hasCover).length} with a cover`);
    console.log(`library: ${library}`);
    console.log(WRITE ? `mode:    WRITE — backups and journal in ${writer.root}` : 'mode:    look only (add --write to change the library)');
    for (const p of WRITE ? writer.problems() : []) console.log(`         ! ${p}`);
    console.log(`open:    http://127.0.0.1:${PORT}/?t=${TOKEN}`);
  });

// Started by the macOS app: when the app goes — quit, crash, force quit — its end of the pipe closes and the server goes with it.
if (args.includes('--exit-with-parent')) {
  process.stdin.resume();
  process.stdin.on('end', () => process.exit(0));
  process.stdin.on('close', () => process.exit(0));
}

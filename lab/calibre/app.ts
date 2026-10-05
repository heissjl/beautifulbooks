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
 * The catalogue is asked **through the website** (`catalogue.ts`): its search
 * and its work pages, in their Open-Library-only mode, answered from the
 * site's servers and kept a day at its CDN. When the website does not answer,
 * the same code runs here against Open Library directly — unless Open Library
 * is refusing this Mac, in which case the app waits. `--source direct` skips
 * the website; `--site <address>` names another one (a local `npm run dev`). Google Books is never asked, either way (lab rule 6). Only on
 * a click: nothing here walks the library by itself.
 *
 * What the catalogue answered is kept on this Mac for thirty days (`kept.ts`),
 * so a book opened before asks nobody — not after a restart either, and not
 * while Open Library refuses this Mac. The page says when what it shows is a
 * kept answer, and „Ask the catalogue again" sends `since=<now>`.
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
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isWorkId, makeToken } from './site';
import { readChoice, writeChoice } from './batch';
import { CatalogueError, directCatalogue, siteCatalogue, withFallback, type Catalogue } from './catalogue';
import { CoverDownloads, CoverSizes } from './download';
import { FileMap } from './filemap';
import { editionByIsbn, findWorks, refusedConnection, WorkMap, type IsbnEdition } from './find';
import { jsonBody, refused, send } from './http';
import { imageFacts, imageSizeFast, isSmaller, type ImageFacts } from './image';
import { AnswerStore, KEEP_DAYS, keptCatalogue, type AskOptions, type Served } from './kept';
import { coverFile, findLibrary, readLibrary, type CalibreBook } from './library';
import { findSyncScript, pocketbookStatus, readSyncConfig, runSync } from './pocketbook';
import { findReader, ReaderCovers } from './reader';
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
// `--site http://localhost:3000` asks a local `npm run dev` instead of the live site.
const SITE = (flag('site') ?? 'https://buyitscovers.com').replace(/\/$/, '');
const TOKEN = makeToken();
const COVER_ID = /^(ol:\d{1,12}|gb:[A-Za-z0-9_-]{1,40})$/;
/** Open Library hands out 100 editions a page; ten pages reach the older printings of a much-printed book. */
const MAX_OFFSET = 900;

const library = findLibrary(flag('library'));
const writer = new CoverWriter({ library, calibredb: findCalibredb(), backupRoot: defaultBackupRoot() });
const works = new WorkMap(join(writer.root, 'works.json'));
/*
 * Book number -> the cover Julian marked as sent to the reader. A new cover is
 * in Calibre at once but on the reader only when the book is sent again
 * (README: „Kommt das neue Cover von selbst auf den Reader?"), so every
 * changed book is a thing still to do in Calibre until he says it is done
 * (Julian, 2026-10-04: „stell die geänderten werke vorne in der übersicht
 * heraus, damit ich weiß welche ich in calibre ändern muss"). The mark names
 * the cover: a book changed again is to send again.
 */
const sent = new FileMap(join(writer.root, 'sent.json'));
// Book number -> a cover chosen for it and not written yet: the batch (`batch.ts`).
const chosen = new FileMap(join(writer.root, 'chosen.json'));
/*
 * The connected PocketBook, when there is one (`reader.ts`, ROADMAP 5.16c).
 * Its shelves show pictures of their own, which neither Calibre's sending nor
 * anything else renews; the app can write them — the cover from Calibre as
 * the reader's picture of the book, in the library and on the home screen.
 * Looked for anew each time: the reader comes and goes.
 */
const readerNow = (): { root: string; covers: ReaderCovers } | null => {
  const root = findReader();
  return root ? { root, covers: new ReaderCovers(root, join(writer.root, 'reader')) } : null;
};
/*
 * How long each full image took, one line per download, beside the backups:
 * the image host is quick most of the time and very slow now and then
 * (download.ts), and only a note taken in the slow moment says which.
 */
/*
 * Which of Calibre's books are on the reader. Looking costs one question per
 * file over USB, and the answer only changes when Calibre sends or removes a
 * book — which rewrites its list there. So: once per state of that list.
 */
let shelf: { key: string; ids: Set<number> } | null = null;
function booksOnShelf(reader: { root: string; covers: ReaderCovers }): Set<number> {
  const key = `${reader.root}:${statSync(join(reader.root, 'metadata.calibre')).mtimeMs}`;
  if (shelf?.key !== key) shelf = { key, ids: reader.covers.present() };
  return shelf.ids;
}

const downloadTimes = join(defaultBackupRoot(), 'download-times.jsonl');
const downloads = new CoverDownloads(SITE, {
  note: (n) => {
    try {
      appendFileSync(downloadTimes, `${JSON.stringify({ at: new Date().toISOString(), ...n })}\n`);
    } catch {
      // A note that could not be written costs a measurement, not a cover.
    }
  },
});
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
  const reader = readerNow();
  let onShelf = new Set<number>();
  let readerCover = new Map<number, string>();
  try {
    if (reader) {
      onShelf = booksOnShelf(reader);
      readerCover = reader.covers.lastPut();
    }
  } catch {
    // Its list did not read — unplugged this moment, or Calibre is writing it: then nothing is said about any book.
  }
  return {
    mode: WRITE ? 'write' : 'preview',
    // The reader's name when it is connected; per changed book below, whether it is on it.
    reader: reader ? { name: basename(reader.root) } : null,
    catalogue: SOURCE,
    problems: WRITE ? writer.problems() : [],
    library: { path: library, books: books.length },
    backupRoot: writer.root,
    books: books.map((b) => {
      const stack = stacks.get(b.id);
      const cover = coverNow(b);
      const choice = readChoice(chosen.get(b.id));
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
        // Chosen for this book and waiting in the batch; nothing is written yet.
        ...(choice ? { chosen: choice.coverId, ...(choice.smaller ? { chosenSmaller: true } : {}) } : {}),
        // The cover the tool last put there, while that write can still be taken back.
        ...(stack ? { applied: stack[stack.length - 1].coverId, appliedAt: stack[stack.length - 1].at, canUndo: !!stack[stack.length - 1].backup, sent: sent.get(b.id) === stack[stack.length - 1].coverId } : {}),
        // On the connected reader; the cover whose pictures this app wrote there; and whether that is the cover the book has now.
        ...(onShelf.has(b.id)
          ? { onReader: true, ...(readerCover.has(b.id) ? { readerCover: readerCover.get(b.id) } : {}), ...(stack ? { readerHas: readerCover.get(b.id) === stack[stack.length - 1].coverId } : {}) }
          : {}),
      };
    }),
  };
}

let syncing = false;

/*
 * When Open Library refuses the connection, the app stops asking for a
 * quarter of an hour: the refusal is the Internet Archive's answer to too many
 * requests from this address, and asking on would only keep the door shut.
 */
const PAUSE_MS = 15 * 60_000;
let pausedUntil = 0;
const paused = (): { error: string; pausedUntil: number } | null =>
  Date.now() < pausedUntil
    ? {
        pausedUntil,
        error:
          'Open Library is refusing connections from this Mac — most likely a temporary block after too many requests in a short time. ' +
          `The app has stopped asking until ${new Date(pausedUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} so the block is not prolonged. ` +
          'Your library and the covers in Calibre are not affected.',
      }
    : null;

/* Through the website first; Open Library directly when the website fails and Open Library is not refusing this Mac. */
const SOURCE = flag('source') === 'direct' ? 'direct' : 'site';
const direct = directCatalogue();
// Asked directly, the pause is the catalogue's answer — in its own words, so a kept answer can still stand in for it.
const unlessPaused = <T>(ask: () => Promise<T>): Promise<T> => {
  const pause = paused();
  return pause ? Promise.reject(new CatalogueError(pause.error)) : ask();
};
const source: Catalogue =
  SOURCE === 'site'
    ? withFallback(siteCatalogue(SITE), direct, () => !paused())
    : { search: (q) => unlessPaused(() => direct.search(q)), page: (id, offset) => unlessPaused(() => direct.page(id, offset)) };

// The catalogue's answers are the catalogue's, not a library's: one store for every library, like the sizes.
const answers = new AnswerStore(join(defaultBackupRoot(), 'catalogue'));

/** The catalogue for one request: what the store has, and a note of what came out of it. */
function asking(url: URL) {
  const since = Number(url.searchParams.get('since') ?? 0);
  const served: Served[] = [];
  const options: AskOptions = { ...(Number.isSafeInteger(since) && since > 0 ? { notBefore: since } : {}), served: (s) => served.push(s) };
  return {
    options,
    catalogue: keptCatalogue(answers, source, options),
    /** Open Library shut the door behind an answer that was served from the store all the same. */
    refused: () => served.some((s) => refusedConnection(s.error)),
    /** For the page: the oldest answer that was not asked for just now, and whether the catalogue was silent. */
    kept: (): { kept?: { at: number; unanswered?: true } } =>
      served.length ? { kept: { at: Math.min(...served.map((s) => s.at)), ...(served.some((s) => s.error !== undefined) ? { unanswered: true as const } : {}) } } : {},
  };
}

/** The covers Open Library lists under an ISBN. While it refuses this Mac only the store is looked at; undefined says "not asked". */
async function isbnEdition(isbn: string, options: AskOptions): Promise<IsbnEdition | null | undefined> {
  if (!paused()) return answers.answer('isbn', isbn, () => editionByIsbn(isbn, SITE), options);
  const have = answers.read<IsbnEdition | null>('isbn', isbn);
  if (have) options.served?.({ at: have.at });
  return have?.value;
}

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
        const ask = asking(url);
        const found = await findWorks(book, ask.catalogue, { remembered: works.get(book.id), query: q || undefined, edition: (isbn) => isbnEdition(isbn, ask.options) });
        if (found.refused || ask.refused()) pausedUntil = Date.now() + PAUSE_MS;
        // Refused and nothing to show — nothing kept either: say why, once, instead of an empty list.
        if ((found.refused || (SOURCE === 'direct' && paused())) && found.hits.length === 0) return send(res, 503, paused());
        return send(res, 200, { ...found, ...ask.kept() });
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
      const ask = asking(url);
      try {
        const page = await ask.catalogue.page(coversOf[1], offset);
        if (ask.refused()) pausedUntil = Date.now() + PAUSE_MS;
        if (!page) return send(res, 404, { error: 'The catalogue does not know this work.' });
        const next = page.next !== null && page.next <= MAX_OFFSET ? page.next : null;
        // Sizes already known ride along, so a work opened before sorts at once.
        const covers = page.covers.map((c) => ({ ...c, ...(coverSizes.peek(c.coverId) ? { size: coverSizes.peek(c.coverId) } : {}) }));
        return send(res, 200, { covers, editions: page.editions, next, ...ask.kept() });
      } catch (err) {
        if (refusedConnection(err)) pausedUntil = Date.now() + PAUSE_MS;
        if (paused() && (SOURCE === 'direct' || refusedConnection(err))) return send(res, 503, paused());
        if (err instanceof CatalogueError) return send(res, 502, { error: err.message });
        return send(res, 502, { error: 'The catalogue did not answer. Try again in a moment.' });
      }
    }

    const coverId = url.searchParams.get('cover') ?? '';
    if (req.method === 'GET' && path === '/api/size') {
      if (!COVER_ID.test(coverId)) return send(res, 400, { error: 'Bad cover id.' });
      return send(res, 200, { size: await coverSizes.get(coverId) });
    }
    if (req.method === 'GET' && (path === '/api/new' || path === '/new')) {
      if (!COVER_ID.test(coverId)) return send(res, 400, { error: 'Bad cover id.' });
      // The pointer rests on this cover: fetch it when there is room, and do not make the page wait.
      if (path === '/api/new' && url.searchParams.get('ahead') === '1') {
        downloads.warm(coverId);
        return send(res, 202, {});
      }
      const f = await downloads.get(coverId);
      if (f.check.ok) coverSizes.remember(coverId, f.check);
      if (path === '/api/new') return send(res, 200, f.check);
      if (!f.check.ok || !f.bytes) return send(res, 502, { error: f.check.ok ? 'No image.' : f.check.reason });
      return send(res, 200, f.bytes, `image/${f.check.format}`);
    }

    if (req.method === 'POST' && (path === '/api/work' || path === '/api/chosen' || path === '/api/sent' || path === '/api/reader' || path === '/api/apply' || path === '/api/undo')) {
      const body = await jsonBody(req);
      const book = books.find((b) => b.id === body.bookId);
      if (!book) return send(res, 404, { error: 'No such book in the library.' });

      // Remembering which work a book is touches only the tool's own file, so it works without --write.
      if (path === '/api/work') {
        if (typeof body.workId !== 'string' || !isWorkId(body.workId) || !/^OL\d+W$/.test(body.workId)) return send(res, 400, { error: 'Bad work id.' });
        works.set(book.id, body.workId);
        return send(res, 200, { ok: true });
      }

      // So does the batch: a cover chosen is a note in the tool's own file. `coverId: null` takes the book out again.
      if (path === '/api/chosen') {
        if (body.coverId === null) chosen.delete(book.id);
        else if (typeof body.coverId === 'string' && COVER_ID.test(body.coverId)) chosen.set(book.id, writeChoice({ coverId: body.coverId, ...(body.smaller === true ? { smaller: true as const } : {}) }));
        else return send(res, 400, { error: 'Bad cover id.' });
        return send(res, 200, { ok: true, state: state() });
      }

      // So does the mark „sent to the reader": it says what Julian did in Calibre, and changes nothing there.
      if (path === '/api/sent') {
        const top = undoStacks(writer.journal()).get(book.id)?.at(-1);
        if (!top) return send(res, 409, { error: 'This book’s cover was not changed here.' });
        if (body.sent === false) sent.delete(book.id);
        else sent.set(book.id, top.coverId);
        return send(res, 200, { ok: true, state: state() });
      }

      if (!WRITE) return send(res, 403, { error: 'This run only looks. Start it with --write to change the library.' });

      /* The cover Calibre has, as the reader's pictures of this book — or the reader's own pictures back. Never the book file. */
      if (path === '/api/reader') {
        const reader = readerNow();
        if (!reader) return send(res, 409, { error: 'The PocketBook is not connected.' });
        if (body.back === true) {
          const result = reader.covers.back(book.id);
          if (result.ok) sent.delete(book.id);
          return send(res, result.ok ? 200 : 409, result.ok ? { ok: true, pictures: result.pictures.length, state: state() } : result);
        }
        const top = undoStacks(writer.journal()).get(book.id)?.at(-1);
        // A cover from the catalogue straight onto the reader's shelves: Calibre keeps the cover it has (Julian, 2026-10-05:
        // „i want to decide whether to write to calibre or pocketbook").
        if (body.coverId !== undefined) {
          if (typeof body.coverId !== 'string' || !COVER_ID.test(body.coverId)) return send(res, 400, { error: 'Bad cover id.' });
          const f = await downloads.get(body.coverId);
          if (!f.check.ok || !f.bytes) return send(res, 409, { error: f.check.ok ? 'No image.' : f.check.reason });
          const result = reader.covers.put(book.id, f.bytes, body.coverId);
          // The same cover Calibre has: then the book is as good as sent.
          if (result.ok && top?.coverId === body.coverId) sent.set(book.id, body.coverId);
          return send(res, result.ok ? 200 : 409, result.ok ? { ok: true, pictures: result.pictures.length, state: state() } : result);
        }
        if (!top) return send(res, 409, { error: 'This book’s cover was not changed here.' });
        const file = coverFile(library, book);
        if (!existsSync(file)) return send(res, 409, { error: 'The cover file is not on this Mac (iCloud).' });
        const result = reader.covers.put(book.id, readFileSync(file), top.coverId);
        // On the reader's shelves now: that is what „sent" was waiting for.
        if (result.ok) sent.set(book.id, top.coverId);
        return send(res, result.ok ? 200 : 409, result.ok ? { ok: true, pictures: result.pictures.length, state: state() } : result);
      }

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
      // Calibre has a cover from here now: whatever waited in the batch for this book is settled.
      if (result.ok) chosen.delete(book.id);
      // The reader's shelves got this very cover before Calibre did (the batch, written to the PocketBook first): nothing is left to send.
      // The record of that is on this Mac, so this holds with the reader unplugged too.
      if (result.ok && new ReaderCovers(readerNow()?.root ?? '', join(writer.root, 'reader')).lastPut().get(book.id) === body.coverId) sent.set(book.id, body.coverId);
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
    console.log(`asks:    ${SOURCE === 'site' ? `${SITE} (Open Library directly when it does not answer)` : 'Open Library directly'}`);
    console.log(`keeps:   the catalogue's answers for ${KEEP_DAYS} days in ${answers.dir}`);
    console.log(`open:    http://127.0.0.1:${PORT}/?t=${TOKEN}`);
  });

// Started by the macOS app: when the app goes — quit, crash, force quit — its end of the pipe closes and the server goes with it.
if (args.includes('--exit-with-parent')) {
  process.stdin.resume();
  process.stdin.on('end', () => process.exit(0));
  process.stdin.on('close', () => process.exit(0));
}

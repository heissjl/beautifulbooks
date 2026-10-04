/**
 * Covers chosen on the site, into Julian's own Calibre library (lab/calibre, ROADMAP 5.16).
 *
 *   npx tsx lab/calibre/serve.ts <collection>            # look only, nothing can be written
 *   npx tsx lab/calibre/serve.ts <collection> --write    # the buttons write, one book per click
 *
 * `<collection>` is the address or id of a collection of one's own
 * (`https://buyitscovers.com/c/<id>`) or the slug of a curated one
 * (`sf-masterworks`). `--library <folder>` points at another library — a
 * rehearsal copy from `rehearsal.ts`, for the first run. `--base <url>` reads
 * a reader's collection from another address (`http://localhost:3000`).
 * `--map <file>` names the import's map (5.17) when it was made for another
 * library with the same book numbers, i.e. for the original of a rehearsal copy.
 *
 * Local only, never deployed: binds 127.0.0.1 and takes requests only with
 * the token printed at start. The page asks nothing outside this server. What
 * is written, and what guards it, is `safety.ts`; the server itself never
 * takes a path, an address or a command from a request — a row number and a
 * book number, both checked against what it loaded.
 *
 * Open Library and Google are asked for image files only, one per cover and
 * at most two at a time; no Google Books API request is made (lab rule 6).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { userAgent } from '../../lib/seo';
import { hostAllowed, makeToken, originAllowed, tokenMatches } from '../../scripts/cockpit/guard';
import { checkCover, imageFacts, isSmaller, type CoverCheck, type ImageFacts } from './image';
import { coverFile, findLibrary, readLibrary, type CalibreBook } from './library';
import { booksByWork, loadMap, mapFile } from './map';
import { matchPicks, type Mapped } from './match';
import { CoverWriter, defaultBackupRoot, findCalibredb, libraryKey, undoStacks } from './safety';
import { imageUrls, loadSource, type Source } from './source';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const WRITE = args.includes('--write');
const PORT = Number(flag('port') ?? process.env.PORT ?? 4327);
const BASE = (flag('base') ?? 'https://buyitscovers.com').replace(/\/$/, '');
const VALUE_FLAGS = new Set(['--library', '--base', '--port', '--map']);
const sourceArg = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1] ?? ''));
const ROOT = join(__dirname, '../..');
const TOKEN = makeToken();

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  const payload = Buffer.isBuffer(body) ? body : type === 'application/json' ? JSON.stringify(body) : String(body);
  // Pictures do not change within a run (the page versions the address after a write); everything else is never cached.
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

async function main(): Promise<void> {
  if (!sourceArg) {
    console.error('Usage: npx tsx lab/calibre/serve.ts <collection address, id or curated slug> [--write] [--library <folder>]');
    process.exit(1);
  }
  const library = findLibrary(flag('library'));
  const writer = new CoverWriter({ library, calibredb: findCalibredb(), backupRoot: defaultBackupRoot() });
  let books = readLibrary(library);
  const source: Source = await loadSource(sourceArg, ROOT, BASE);

  /*
   * The import's map (5.17): which book each tile was made from. Looked up
   * for this collection and this library; `--map <file>` names one made for
   * another library — a rehearsal copy has the numbers of its original.
   */
  let mapped: Mapped = new Map();
  let mapNote = '';
  if (source.kind === 'wall') {
    const given = flag('map');
    const found = loadMap(given ?? mapFile(defaultBackupRoot(), source.ref), source.ref, given ? null : libraryKey(library));
    if ('map' in found) {
      mapped = booksByWork(found.map);
      mapNote = `${found.map.books.length} books mapped by the import${given ? ' (map named by hand)' : ''}`;
    } else if (given) throw new Error(`--map: ${found.none}`);
    else mapNote = found.none;
  }

  /* The new images: fetched once, checked, kept in memory for the run. */
  type Fetched = { check: CoverCheck; bytes?: Buffer };
  const fetched = new Map<number, Promise<Fetched>>();
  let active = 0;
  const waiting: (() => void)[] = [];
  const slot = async (): Promise<void> => {
    if (active >= 2) await new Promise<void>((go) => waiting.push(go));
    active++;
  };
  const release = (): void => {
    active--;
    waiting.shift()?.();
  };
  const download = async (index: number): Promise<Fetched> => {
    await slot();
    try {
      let last = 'No address for this cover.';
      for (const url of imageUrls(source.picks[index].coverId)) {
        try {
          const res = await fetch(url, { headers: { 'user-agent': userAgent(BASE) }, signal: AbortSignal.timeout(45_000) });
          if (!res.ok) {
            last = `The image source answered ${res.status}.`;
            continue;
          }
          const bytes = Buffer.from(await res.arrayBuffer());
          const check = checkCover(bytes);
          if (check.ok) return { check, bytes };
          last = check.reason;
        } catch {
          // A source that did not answer is not "no cover" (SPEC N12).
          last = 'The image source did not answer in time. Reload to try again.';
        }
      }
      return { check: { ok: false, reason: last } };
    } finally {
      release();
    }
  };
  const newImage = (index: number): Promise<Fetched> => {
    let p = fetched.get(index);
    if (!p) {
      p = download(index).then((f) => {
        // A failed download is not remembered: the next look tries again.
        if (!f.check.ok) fetched.delete(index);
        return f;
      });
      fetched.set(index, p);
    }
    return p;
  };

  const oldFacts = (book: CalibreBook): ImageFacts | { missing: string } => {
    const file = coverFile(library, book);
    if (!existsSync(file)) return { missing: book.hasCover ? 'The cover file is not on this Mac (iCloud).' : 'No cover yet.' };
    return imageFacts(readFileSync(file)) ?? { missing: 'The current cover does not decode.' };
  };

  const state = () => {
    const matches = matchPicks(source.picks, books, mapped);
    const stacks = undoStacks(writer.journal());
    return {
      mode: WRITE ? 'write' : 'preview',
      problems: WRITE ? writer.problems() : [],
      library: { path: library, books: books.length, withIsbn: books.filter((b) => b.isbns.length).length },
      backupRoot: writer.root,
      source: { kind: source.kind, ref: source.ref, title: source.title, skipped: source.skipped },
      rows: source.picks.map((pick, index) => ({ index, pick, ...matches[index] })),
      books: books.map((b) => ({ id: b.id, title: b.title, authors: b.authors, hasCover: b.hasCover })),
      // Per book: the cover the tool last put there, if that write can still be taken back.
      applied: Object.fromEntries([...stacks].map(([id, stack]) => [id, { coverId: stack[stack.length - 1].coverId, canUndo: !!stack[stack.length - 1].backup }])),
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

      const fresh = /^\/api\/new\/(\d{1,4})$/.exec(path);
      const freshImage = /^\/new\/(\d{1,4})$/.exec(path);
      const index = Number((fresh ?? freshImage)?.[1] ?? -1);
      if (req.method === 'GET' && (fresh || freshImage)) {
        if (!source.picks[index]) return send(res, 404, { error: 'No such row.' });
        const f = await newImage(index);
        if (fresh) return send(res, 200, f.check);
        if (!f.check.ok || !f.bytes) return send(res, 502, { error: f.check.ok ? 'No image.' : f.check.reason });
        return send(res, 200, f.bytes, `image/${f.check.format}`);
      }

      const old = /^\/api\/old\/(\d{1,9})$/.exec(path);
      const oldImage = /^\/old\/(\d{1,9})$/.exec(path);
      if (req.method === 'GET' && (old || oldImage)) {
        const book = books.find((b) => b.id === Number((old ?? oldImage)?.[1]));
        if (!book) return send(res, 404, { error: 'No such book.' });
        if (old) return send(res, 200, oldFacts(book));
        const file = coverFile(library, book);
        if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: 'No cover.' });
        return send(res, 200, readFileSync(file), 'image/jpeg');
      }

      if (req.method === 'POST' && (path === '/api/apply' || path === '/api/undo')) {
        if (!originAllowed(req.headers.origin, PORT)) return send(res, 403, { error: 'Wrong origin.' });
        if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { error: 'Send JSON.' });
        if (!WRITE) return send(res, 403, { error: 'This run only looks. Start it with --write to change the library.' });
        const body = await jsonBody(req);
        const book = books.find((b) => b.id === body.bookId);
        if (!book) return send(res, 404, { error: 'No such book in the library.' });

        if (path === '/api/undo') {
          const result = writer.undo(book.id);
          if (result.ok) books = result.books;
          return send(res, result.ok ? 200 : 409, result.ok ? { ok: true, state: state() } : result);
        }

        const row = typeof body.index === 'number' ? source.picks[body.index] : undefined;
        if (!row) return send(res, 404, { error: 'No such row.' });
        const f = await newImage(body.index as number);
        if (!f.check.ok || !f.bytes) return send(res, 409, { error: f.check.ok ? 'No image.' : f.check.reason });
        const current = oldFacts(book);
        if (!('missing' in current) && isSmaller(f.check, current) && body.allowSmaller !== true) {
          return send(res, 409, { smaller: true, error: `The new cover (${f.check.width} × ${f.check.height}) has fewer pixels than the one the book has (${current.width} × ${current.height}).` });
        }
        const result = writer.apply(book.id, f.bytes, row.coverId);
        if (result.ok) books = result.books;
        return send(res, result.ok ? 200 : 409, result.ok ? { ok: true, state: state() } : result);
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
      console.error(`Port ${PORT} is taken — another calibre tool is probably running. Stop it, or start with --port 4328.`);
      process.exit(1);
    })
    .listen(PORT, '127.0.0.1', () => {
      const sure = matchPicks(source.picks, books, mapped).filter((m) => m.sure !== undefined).length;
      console.log(`calibre: „${source.title}" — ${source.picks.length} covers, ${sure} with a sure match among ${books.length} books`);
      console.log(`library: ${library}`);
      if (mapNote) console.log(`map:     ${mapNote}`);
      console.log(WRITE ? `mode:    WRITE — backups and journal in ${writer.root}` : 'mode:    look only (add --write to change the library)');
      for (const p of WRITE ? writer.problems() : []) console.log(`         ! ${p}`);
      console.log(`open:    http://127.0.0.1:${PORT}/?t=${TOKEN}`);
    });
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});

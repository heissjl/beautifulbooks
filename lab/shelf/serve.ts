/**
 * The shelf prototype (ROADMAP 5.11): photo in, wall out, link to share.
 *
 *   set -a; source ../../../.env.local; set +a   # from the worktree, for ANTHROPIC_API_KEY
 *   npx tsx lab/shelf/serve.ts                    # then open http://127.0.0.1:4330
 *
 * Local only, bound to 127.0.0.1, never deployed. What leaves the machine:
 * the photo to Anthropic (once, in the request — never written, never
 * logged), and to Open Library one search per book plus, for a book shown
 * front-on, one editions page and its cover thumbnails. Never Google (lab
 * rule 6). A shared wall is rendered from the URL fragment in the browser,
 * so the list in a shared link never reaches this server.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { build } from 'esbuild';
import decodeHeic from 'heic-decode';
import jpeg from 'jpeg-js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decode, type RgbaImage } from '../../lib/imagehash';
import { Matcher, coverIdFromUrl } from './match';
import { FALLBACK_MODEL, PRIMARY_MODEL, hasApiKey, recognize, type RecognizedBook } from './recognize';

const HTML_FILE = join(import.meta.dirname, 'index.html');
const SAMPLE_FILE = join(import.meta.dirname, 'sample.json');
const PORT = Number(process.env.PORT ?? 4330);
/** Where a tile links: the site's own wall for that work and cover. */
const SITE = (process.env.SHELF_SITE ?? 'https://beautifulcovers.vercel.app').replace(/\/$/, '');
/** The browser scales the photo down first; anything larger is refused. */
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

const matcher = new Matcher();

/**
 * The model's answer per photo, keyed by the photo's SHA-256, until the
 * server stops: uploading the same photo again (to try a change in the
 * colour or edition step) costs no second model call. Only the hash and the
 * titles are kept, never the photo.
 */
const recognitions = new Map<string, Awaited<ReturnType<typeof recognize>>>();

/**
 * The colour step (ROADMAP 5.16) runs in the browser, on the photo the page
 * already holds: lab/colorsort/shelfcolors.ts, bundled once per start.
 */
let colorsJs: Promise<string> | null = null;
function colorsScript(): Promise<string> {
  colorsJs ??= build({
    entryPoints: [join(import.meta.dirname, '..', 'colorsort', 'shelfcolors.ts')],
    bundle: true, write: false, format: 'iife', target: 'es2022', minify: true,
  }).then(r => r.outputFiles[0].text, err => { colorsJs = null; throw err; });
  return colorsJs;
}

async function readBytes(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('Foto zu groß');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** NDJSON, one line per step, so the page can show progress while Open Library answers. */
function stream(res: ServerResponse) {
  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
  return (line: unknown) => res.write(`${JSON.stringify(line)}\n`);
}

async function matchAll(books: RecognizedBook[], photo: RgbaImage | null, emit: (line: unknown) => void) {
  const started = Date.now();
  const results = [];
  for (let i = 0; i < books.length; i++) {
    const result = await matcher.match(books[i], photo);
    results.push(result);
    emit({ type: 'match', index: i, result });
  }
  const matchMs = Date.now() - started;
  // Second pass (ROADMAP 5.16): the edition behind each spine. After the
  // works, so the wall stands first and covers change in place.
  let editions = 0, picked = 0;
  if (photo) {
    for (let i = 0; i < books.length; i++) {
      const r = results[i];
      if (!r.work || books[i].kind !== 'spine') continue;
      emit({ type: 'edition-start', index: i });
      try {
        const found = await matcher.spineEdition(books[i], r.work.id, photo, r.cover?.coverId ?? 0);
        if (!found) continue;
        editions++;
        if (found.cover.reason === 'spine-edition') picked++;
        emit({ type: 'edition', index: i, cover: found.cover, ranked: found.ranked.slice(0, 24), spine: found.spine });
      } catch (err) {
        emit({ type: 'edition', index: i, error: `Open Library: ${err instanceof Error ? err.message : String(err)}` });
      }
    }
  }
  emit({ type: 'done', matchMs, editionMs: Date.now() - started - matchMs, editions, picked });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  // One line per request — path, status, time, size; never the photo, never a title.
  const t0 = Date.now();
  res.on('finish', () => {
    if (url.pathname === '/api/log') return;
    console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - t0}ms ${req.headers['content-length'] ?? ''}${req.headers['content-type'] ? ` ${req.headers['content-type']}` : ''} ${(req.headers['user-agent'] ?? '').match(/(Safari|Chrome|Firefox)\/[\d.]+/g)?.join(' ') ?? ''}`);
  });
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  try {
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(readFileSync(HTML_FILE, 'utf8'));
      return;
    }

    if (url.pathname === '/colors.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(await colorsScript());
      return;
    }

    // iPhone photos are HEIC, which Chrome cannot decode (Safari can): the
    // page sends such a file here and gets a JPEG back. In memory only, like
    // the photo in /api/recognize — nothing is written.
    if (url.pathname === '/api/heic' && req.method === 'POST') {
      const bytes = await readBytes(req, 40 * 1024 * 1024);
      let image;
      try {
        image = await decodeHeic({ buffer: new Uint8Array(bytes) });
      } catch (err) {
        return send(400, { error: `HEIC ließ sich nicht lesen: ${err instanceof Error ? err.message : String(err)}` });
      }
      const out = jpeg.encode({ data: Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength), width: image.width, height: image.height }, 90);
      res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
      res.end(out.data);
      return;
    }

    // What went wrong in the page, so a failure in the reader's browser reaches this terminal.
    if (url.pathname === '/api/log' && req.method === 'POST') {
      const text = (await readBytes(req, 4000)).toString('utf8');
      console.log(`page: ${text.replace(/\s+/g, ' ').slice(0, 500)}`);
      res.writeHead(204); res.end();
      return;
    }

    if (url.pathname === '/api/status') {
      return send(200, { key: hasApiKey(), model: PRIMARY_MODEL, fallback: FALLBACK_MODEL, site: SITE });
    }

    if (url.pathname === '/api/sample' && req.method === 'POST') {
      const { books } = JSON.parse(readFileSync(SAMPLE_FILE, 'utf8')) as { books: RecognizedBook[] };
      const emit = stream(res);
      emit({ type: 'recognized', books, problems: [], model: 'sample.json', ms: 0 });
      await matchAll(books, null, emit);
      return res.end();
    }

    // Reading by rows (ROADMAP 5.16, first real photo 2026-09-29): the page
    // cuts the photo at the shelf boards it found and sends each row at full
    // resolution. /api/read only reads — one row, one model call, cached by
    // the crop's hash; /api/match then matches the combined list against the
    // whole (shrunk) photo, streamed as before.
    if (url.pathname === '/api/read' && req.method === 'POST') {
      if (!hasApiKey()) return send(400, { error: 'ANTHROPIC_API_KEY ist nicht gesetzt.' });
      const type = req.headers['content-type'];
      if (type !== 'image/jpeg' && type !== 'image/png') return send(400, { error: 'nur JPEG oder PNG' });
      const bytes = await readBytes(req, MAX_PHOTO_BYTES);
      const image = decode(bytes);
      if (!image) return send(400, { error: 'Bild ließ sich nicht lesen' });
      const key = createHash('sha256').update(bytes).digest('hex');
      const cached = recognitions.get(key);
      try {
        const run = cached ?? await recognize(bytes, type, { publisher: true, pixels: { width: image.width, height: image.height } });
        recognitions.set(key, run);
        return send(200, { ...run, cached: !!cached });
      } catch (err) {
        return send(502, { error: `Erkennung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    if (url.pathname === '/api/match' && req.method === 'POST') {
      const body = JSON.parse((await readBytes(req, MAX_PHOTO_BYTES * 2)).toString('utf8')) as {
        photo: string; books: RecognizedBook[]; meta: Record<string, unknown>;
      };
      const photo = decode(Buffer.from(body.photo, 'base64'));
      if (!photo) return send(400, { error: 'Foto ließ sich nicht lesen' });
      const emit = stream(res);
      emit({ type: 'recognized', books: body.books, problems: [], ...body.meta, photo: { width: photo.width, height: photo.height } });
      await matchAll(body.books, photo, emit);
      return res.end();
    }

    if (url.pathname === '/api/recognize' && req.method === 'POST') {
      if (!hasApiKey()) return send(400, { error: 'ANTHROPIC_API_KEY ist nicht gesetzt. Schlüssel in .env.local eintragen und den Server neu starten — oder die Beispielliste nehmen.' });
      const type = req.headers['content-type'];
      if (type !== 'image/jpeg' && type !== 'image/png') return send(400, { error: 'nur JPEG oder PNG' });
      // In memory only, for this request; never written anywhere.
      const bytes = await readBytes(req, MAX_PHOTO_BYTES);
      const photo = decode(bytes);
      if (!photo) return send(400, { error: 'Foto ließ sich nicht lesen' });
      const key = createHash('sha256').update(bytes).digest('hex');
      let run = recognitions.get(key);
      try {
        run ??= await recognize(bytes, type, { publisher: true, pixels: { width: photo.width, height: photo.height } });
        recognitions.set(key, run);
      } catch (err) {
        return send(502, { error: `Erkennung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}` });
      }
      const emit = stream(res);
      emit({
        type: 'recognized', books: run.books, problems: run.problems, model: run.model, ms: run.ms,
        inputTokens: run.inputTokens, outputTokens: run.outputTokens, photo: { width: photo.width, height: photo.height, bytes: bytes.length },
      });
      await matchAll(run.books, photo, emit);
      return res.end();
    }

    // "Search again" on a tile: the site's own search, Open Library only.
    if (url.pathname === '/api/search') {
      const q = url.searchParams.get('q')?.trim() ?? '';
      if (q.length < 3) return send(400, { error: 'mindestens drei Zeichen' });
      const works = await matcher.searchWorks(q);
      return send(200, {
        works: works.slice(0, 12).map(w => ({
          id: w.id, title: w.title, author: w.authors[0] ?? '', firstPublished: w.firstPublishYear,
          coverId: coverIdFromUrl(w.coverUrls[0]) ?? 0,
        })),
      });
    }

    // Other covers of a work, to pick the edition by hand: page 0, not hashed.
    if (url.pathname === '/api/covers') {
      const id = url.searchParams.get('id') ?? '';
      if (!/^OL\d+W$/.test(id)) return send(400, { error: 'bad id' });
      const covers = await matcher.workCovers(id, false);
      return send(200, { covers: covers.slice(0, 60).map(c => c.coverId) });
    }

    send(404, { error: 'not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (res.headersSent) {
      res.end(`${JSON.stringify({ type: 'error', error: message })}\n`);
      return;
    }
    const upstream = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'SourceUnavailableError' || / from https:/.test(message));
    send(upstream ? 502 : 400, { error: upstream ? `Open Library: ${message}` : message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`shelf: ${hasApiKey() ? `recognition with ${PRIMARY_MODEL}` : 'no ANTHROPIC_API_KEY — sample mode only'}`);
  console.log(`open http://127.0.0.1:${PORT}`);
});

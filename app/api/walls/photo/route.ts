import { NextRequest } from 'next/server';
import { hasApiKey, recognize, type RecognizedBook } from '@/lib/recognize';
import { matchPhotoBooksEach, photoRead, MAX_PHOTO_BOOKS, type PhotoMatch } from '@/lib/walls/photo';
import { preparePhoto } from '@/lib/photoprep';
import { json, openWalls } from '../guard';

/**
 * POST /api/walls/photo — a photo of books (JPEG or PNG, the browser has
 * already shrunk it) → the works on it, each with a tile to offer (ROADMAP
 * 5.13a, from the shelf lab 5.11). The photo goes to Anthropic once and is
 * never written or logged; the answer carries no copy of it.
 *
 * Since 5.11a the answer is a stream of JSON lines (Julian, 2026-09-30:
 * „zeigen des Fortschritts … Rücken für Rücken“), in this order:
 *   {"book": <read>, "i": n}    one per book, the moment the model has written it
 *   {"read": [<read>…]}         every book, placed with its neighbours known; capped at MAX_PHOTO_BOOKS
 *   {"i": n, "match": <match>}  one per book, the moment its catalogue search answers
 *   {"done": true}              or {"error": "…"} when the model or the store failed on the way
 * Errors before the first line answer as before, with a status.
 */
export const maxDuration = 120;

/** A photo as the phone took it, when the browser cannot shrink it (a private canvas, 5.11a); a shrunk one is under 2 MB. */
const MAX_BYTES = 12 * 1024 * 1024;

/** Photos read per day, all readers together — a spending cap, not a rate limit (5.11a; about 1–3 ct a photo). */
export const PHOTOS_PER_DAY = 300;

/** The product's own telemetry, like `bb.click`: counts and timings, nothing about the photo or the reader. */
function recordPhoto(event: Record<string, unknown>): void {
  try {
    console.info(`bb.photo ${JSON.stringify({ ...event, at: new Date().toISOString() })}`);
  } catch {
    // A log line is not worth breaking the answer over.
  }
}

export async function POST(request: NextRequest) {
  const open = openWalls(request, 'wallsPhoto');
  if ('response' in open) return open.response;

  if (!hasApiKey()) return json({ error: 'Reading photos needs a key this server does not have yet.' }, 503);
  const type = (request.headers.get('content-type') ?? '').split(';')[0];
  if (type !== 'image/jpeg' && type !== 'image/png') return json({ error: 'Send a JPEG or PNG.' }, 415);
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) return json({ error: 'The photo was empty.' }, 400);
  if (bytes.length > MAX_BYTES) return json({ error: 'The photo is too large.' }, 413);
  // Upright, shrunk, a plain JPEG without EXIF — whatever the browser sent (lib/photoprep.ts).
  const prepared = preparePhoto(bytes);
  if (!prepared) return json({ error: 'The photo could not be opened. Send a JPEG or PNG.' }, 415);

  // The day's cap is counted before the model is asked, so an attempt that fails still counts; that errs on the cheap side.
  let today = 0;
  try {
    today = await open.store.countPhoto(new Date().toISOString().slice(0, 10));
  } catch {
    // A silent store does not stop a reader; the cap is a budget, not a right.
  }
  if (today > PHOTOS_PER_DAY) {
    recordPhoto({ capped: true, today });
    return json({ error: 'Today’s photos are used up — the site reads a limited number a day. Tomorrow again.' }, 429);
  }

  const encoder = new TextEncoder();
  const started = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const line = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      let books: RecognizedBook[] = [];
      let model = '';
      let msModel = 0;
      let tokens = { in: 0, out: 0 };
      let problems = 0;
      try {
        const run = await recognize(prepared.bytes, 'image/jpeg', (book, i) => {
          if (i < MAX_PHOTO_BOOKS) line({ book: photoRead(book), i });
        });
        books = run.books.slice(0, MAX_PHOTO_BOOKS);
        model = run.model;
        msModel = run.ms;
        tokens = { in: run.inputTokens, out: run.outputTokens };
        problems = run.problems.length;
        line({ read: books.map(photoRead), problems, capped: run.books.length > MAX_PHOTO_BOOKS });
      } catch {
        // Never "no books": the model did not answer, which is something else (N12).
        recordPhoto({ failed: 'model', bytes: bytes.length, ms: Date.now() - started });
        line({ error: 'The photo could not be read just now. Try again in a moment.' });
        controller.close();
        return;
      }
      const searchStarted = Date.now();
      let matches: PhotoMatch[] = [];
      try {
        matches = await matchPhotoBooksEach(books, (i, match) => line({ i, match }));
      } catch {
        line({ error: 'The catalogue could not be asked just now. Try again in a moment.' });
        controller.close();
        return;
      }
      recordPhoto({
        bytes: bytes.length,
        sent: `${prepared.width}x${prepared.height}`,
        orientation: prepared.orientation,
        shrunk: prepared.shrunk,
        model,
        read: books.length,
        found: matches.filter((m) => m.tile && !m.unsure).length,
        maybe: matches.filter((m) => m.unsure).length,
        notFound: matches.filter((m) => !m.tile && !m.failed).length,
        failed: matches.filter((m) => m.failed).length,
        covers: books.filter((b) => b.kind === 'cover').length,
        problems,
        msModel,
        msSearch: Date.now() - searchStarted,
        tokensIn: tokens.in,
        tokensOut: tokens.out,
        today,
      });
      line({ done: true });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      // Keep proxies from holding the lines back until the end.
      'x-accel-buffering': 'no',
    },
  });
}

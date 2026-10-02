/**
 * Books in a photo, read by an image model (ROADMAP 5.11, Julian's default of
 * 2026-09-26: Claude over the Anthropic API).
 *
 * The photo goes to Anthropic once, as base64 in the request, and nowhere
 * else: it is never written to disk, never logged, and dropped when the
 * request ends. The key comes from `ANTHROPIC_API_KEY`; without it the caller
 * says so plainly instead of pretending the photo held no books.
 *
 * `parseRecognition` is pure and tested; it accepts a strict JSON answer and
 * also the ways an answer goes wrong (a code fence, prose around it, a bare
 * array, a box outside the picture) and says what it dropped.
 */
import Anthropic from '@anthropic-ai/sdk';

export const PRIMARY_MODEL = 'claude-sonnet-5';
export const FALLBACK_MODEL = 'claude-opus-5-5';

export type BookKind = 'spine' | 'cover';

export interface RecognizedBook {
  title: string;
  author: string;
  kind: BookKind;
  /** The shelf it stands on, 0 = top row, as the model counted them (5.11a). */
  row?: number;
  /** The horizontal centre of the spine or cover as a fraction of the picture width. */
  x?: number;
  /**
   * [x, y, w, h] as fractions of the picture — since 5.11a built by
   * `placeBooks` from the row and the centre, never read from the model: it
   * could not give a usable height or row on a dense shelf (measured
   * 2026-09-30, docs/plans/PLAN-5.11a-regalfoto-zuverlaessig.md).
   */
  box?: [number, number, number, number];
}

/** A shelf: top and bottom edge as fractions of the picture height. */
export type Row = [number, number];

export interface Recognition {
  books: RecognizedBook[];
  /** The shelves from top to bottom, as the model saw them. */
  rows: Row[];
  /** What was dropped or repaired while parsing, in words. */
  problems: string[];
}

export interface RecognitionRun extends Recognition {
  model: string;
  ms: number;
  inputTokens: number;
  outputTokens: number;
}

export function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

/**
 * The model is asked only for what it can do (5.11a, measured 2026-09-30 on
 * two real photos): the reading order, the shelf a book stands on, and the
 * horizontal centre of its spine. Boxes with a height per book were wrong on
 * every dense shelf, and they cost most of the answer — the answer was 5.6 of
 * the 6.6 cents a gallery wall cost — so the keys are short, the numbers are
 * whole percentages, and there is no confidence figure.
 */
const PROMPT = `This is a photo of books: a shelf of spines, a pile, or covers laid out.

First list the shelves (rows of books) from top to bottom: for each, its top and bottom edge as whole percentages of the picture height (0-100).
Then list every book whose title you can read, in reading order: row by row from the top, left to right within a row.

For each book give:
- t: the title as printed, without series names or "a novel"
- a: the author as printed; "" if not visible and you are not sure
- k: "cover" if the front cover faces the camera, "spine" if only the spine is visible
- r: the number of its row, 1 for the top row
- x: the horizontal centre of the spine (or of the cover) as a whole percentage of the picture width (0-100)

Leave out books whose title you cannot read; do not guess titles from colours or shapes.
Answer with JSON only: {"rows": [[top, bottom], ...], "books": [{"t": "...", "a": "...", "k": "spine", "r": 1, "x": 12}, ...]}.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rows', 'books'],
  properties: {
    rows: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
    books: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['t', 'a', 'k', 'r', 'x'],
        properties: {
          t: { type: 'string' },
          a: { type: 'string' },
          k: { type: 'string', enum: ['spine', 'cover'] },
          r: { type: 'integer' },
          x: { type: 'integer' },
        },
      },
    },
  },
} as const;

/** The first JSON value in a text: past a code fence or a sentence of prose. */
function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    // Prose around it: take from the first bracket to the matching last one.
  }
  const start = body.search(/[[{]/);
  if (start < 0) return undefined;
  const close = body[start] === '{' ? '}' : ']';
  const end = body.lastIndexOf(close);
  if (end <= start) return undefined;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** A whole percentage (or, from an older answer, a fraction) as a fraction 0..1; undefined when it is no number. */
function fraction(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return clamp01(raw > 1 ? raw / 100 : raw);
}

function parseRows(raw: unknown): Row[] {
  if (!Array.isArray(raw)) return [];
  const rows: Row[] = [];
  for (const r of raw) {
    if (!Array.isArray(r) || r.length !== 2) continue;
    const a = fraction(r[0]);
    const b = fraction(r[1]);
    if (a === undefined || b === undefined) continue;
    const [y0, y1] = a <= b ? [a, b] : [b, a];
    if (y1 - y0 >= 0.02) rows.push([y0, y1]);
  }
  return rows.sort((p, q) => p[0] - q[0]);
}

/** One book as the model wrote it (short keys since 5.11a; the old long keys still read). */
function parseBook(raw: unknown, i: number, problems: string[]): RecognizedBook | undefined {
  if (!raw || typeof raw !== 'object') { problems.push(`#${i + 1}: kein Objekt`); return undefined; }
  const r = raw as Record<string, unknown>;
  const titleRaw = r.t ?? r.title;
  const title = typeof titleRaw === 'string' ? titleRaw.replace(/\s+/g, ' ').trim() : '';
  if (!title) { problems.push(`#${i + 1}: ohne Titel`); return undefined; }
  const authorRaw = r.a ?? r.author;
  const author = typeof authorRaw === 'string' ? authorRaw.replace(/\s+/g, ' ').trim() : '';
  const kindRaw = r.k ?? r.kind;
  const kind: BookKind = kindRaw === 'cover' ? 'cover' : 'spine';
  if (kindRaw !== 'cover' && kindRaw !== 'spine') problems.push(`#${i + 1}: kind "${String(kindRaw)}" als spine gelesen`);
  const row = typeof r.r === 'number' && Number.isInteger(r.r) && r.r >= 1 ? r.r - 1 : undefined;
  if (r.r !== undefined && row === undefined) problems.push(`#${i + 1}: Reihe unbrauchbar`);
  const x = fraction(r.x);
  if (r.x !== undefined && x === undefined) problems.push(`#${i + 1}: Mitte unbrauchbar`);
  return { title, author, kind, ...(row !== undefined ? { row } : {}), ...(x !== undefined ? { x } : {}) };
}

export function parseRecognition(text: string): Recognition {
  const problems: string[] = [];
  const value = extractJson(text);
  if (value === undefined) return { books: [], rows: [], problems: ['Antwort war kein JSON'] };
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { books?: unknown }).books)
      ? (value as { books: unknown[] }).books
      : null;
  if (!list) return { books: [], rows: [], problems: ['JSON ohne Liste "books"'] };
  const rows = parseRows(value && typeof value === 'object' && !Array.isArray(value) ? (value as { rows?: unknown }).rows : undefined);

  const books: RecognizedBook[] = [];
  list.forEach((raw, i) => {
    const book = parseBook(raw, i, problems);
    if (book) books.push(book);
  });
  return { books: placeBooks(books, rows), rows, problems };
}

/**
 * The books in an answer that is still arriving (5.11a; Julian, 2026-09-30:
 * „the overlay spine by spine in the picture as it is being detected“). The
 * answer names the rows first and then one object per book, so every object
 * that has closed can be read before the rest exists. Pure: give it the whole
 * text so far, it returns the rows (once `"books"` has begun) and every
 * complete book; the caller remembers how many it has already passed on.
 */
export function scanPartial(text: string): { rows: Row[]; books: RecognizedBook[] } {
  const booksAt = text.indexOf('"books"');
  if (booksAt < 0) return { rows: [], books: [] };
  let rows: Row[] = [];
  const rowsAt = text.indexOf('"rows"');
  if (rowsAt >= 0 && rowsAt < booksAt) {
    const open = text.indexOf('[', rowsAt);
    const close = text.lastIndexOf(']', booksAt);
    if (open >= 0 && close > open) {
      try {
        rows = parseRows(JSON.parse(text.slice(open, close + 1)));
      } catch {
        rows = [];
      }
    }
  }
  const listAt = text.indexOf('[', booksAt);
  const books: RecognizedBook[] = [];
  if (listAt < 0) return { rows, books };
  // Balanced braces outside strings: each closed object is one book.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  const problems: string[] = [];
  for (let i = listAt + 1; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const book = parseBook(JSON.parse(text.slice(start, i + 1)), books.length, problems);
          if (book) books.push(book);
        } catch {
          // A broken object is dropped here; parseRecognition on the whole answer reports it.
        }
        start = -1;
      }
    } else if (c === ']' && depth === 0) break;
  }
  return { rows, books };
}

/** A spine marker is never narrower than this; a cover never narrower than COVER_MIN. */
const SPINE_MIN = 0.02;
const COVER_MIN = 0.1;

/**
 * Where each book stands, as a strip in its row (5.11a): the boundary
 * between two neighbours lies halfway between their centres, so nothing
 * overlaps. Neighbours are found by centre, not by the order the model
 * listed them in — on the gallery wall of 2026-09-30 one swapped pair per
 * row was usual, and the strip must still sit on its own book. A row whose
 * centres are missing is shared out evenly among its books in reading
 * order, which on a shelf of near-equal spines is close enough. A cover
 * lying flat gets a wider box in the same row. A book without a row, or
 * with one the model never listed, gets no box; without any rows the whole
 * picture is one row.
 */
export function placeBooks(books: readonly RecognizedBook[], rows: readonly Row[]): RecognizedBook[] {
  const shelves: Row[] = rows.length ? [...rows] : [[0, 1]];
  const out = books.map((b) => ({ ...b }));
  const byRow = new Map<number, number[]>();
  out.forEach((b, i) => {
    const row = rows.length ? b.row : 0;
    if (row === undefined || row >= shelves.length) return;
    byRow.set(row, [...(byRow.get(row) ?? []), i]);
  });
  for (const [row, idx] of byRow) {
    const [y0, y1] = shelves[row];
    const known = idx.every((i) => out[i].x !== undefined);
    // By centre when every book has one; the boundary to the nearest centre on either side.
    const sorted = known ? [...idx].sort((a, b) => (out[a].x as number) - (out[b].x as number)) : idx;
    sorted.forEach((i, k) => {
      let left: number;
      let right: number;
      if (known) {
        const x = out[i].x as number;
        const prev = k > 0 ? (out[sorted[k - 1]].x as number) : undefined;
        const next = k < sorted.length - 1 ? (out[sorted[k + 1]].x as number) : undefined;
        const halfPrev = prev !== undefined ? (x - prev) / 2 : undefined;
        const halfNext = next !== undefined ? (next - x) / 2 : undefined;
        const half = halfPrev !== undefined && halfNext !== undefined ? Math.min(halfPrev, halfNext) : (halfPrev ?? halfNext ?? SPINE_MIN);
        left = x - half;
        right = x + half;
      } else {
        left = k / sorted.length;
        right = (k + 1) / sorted.length;
      }
      const min = out[i].kind === 'cover' ? COVER_MIN : SPINE_MIN;
      if (right - left < min) {
        const mid = (left + right) / 2;
        left = mid - min / 2;
        right = mid + min / 2;
      }
      left = clamp01(left);
      right = clamp01(right);
      if (right - left < 0.005) return;
      out[i].box = [left, y0, right - left, y1 - y0];
    });
  }
  return out;
}

/**
 * Sends the photo to the model and parses its answer. Throws when there is no
 * key or the API fails; an empty `books` means the model answered and read
 * nothing — the two must not be confused (CLAUDE.md).
 *
 * The answer is streamed (5.11a): `onBook` gets every book as soon as its
 * object has closed, placed provisionally in its row (its neighbours are not
 * known yet); the returned books are placed again with the whole row known.
 */
export async function recognize(
  image: Buffer,
  mediaType: 'image/jpeg' | 'image/png',
  onBook?: (book: RecognizedBook, index: number) => void,
): Promise<RecognitionRun> {
  if (!hasApiKey()) throw new Error('ANTHROPIC_API_KEY ist nicht gesetzt');
  const client = new Anthropic();
  const data = image.toString('base64');

  const ask = async (model: string): Promise<Anthropic.Message> => {
    const stream = client.messages.stream({
      model,
      max_tokens: 8000,
      // effort high: on the gallery wall it read 41 books, medium 25–27 (2026-09-30); the slim answer halves the cost anyway.
      output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });
    if (onBook) {
      let sofar = '';
      let handed = 0;
      stream.on('text', (delta) => {
        sofar += delta;
        const partial = scanPartial(sofar);
        if (partial.books.length <= handed) return;
        const placed = placeBooks(partial.books, partial.rows);
        for (; handed < placed.length; handed++) onBook(placed[handed], handed);
      });
    }
    return stream.finalMessage();
  };

  const started = Date.now();
  let model = PRIMARY_MODEL;
  let response: Anthropic.Message;
  try {
    response = await ask(model);
  } catch (err) {
    // Only a model this account cannot use moves to the fallback; a bad key
    // or a rate limit would fail the same way there.
    if (!(err instanceof Anthropic.NotFoundError || err instanceof Anthropic.PermissionDeniedError)) throw err;
    model = FALLBACK_MODEL;
    response = await ask(model);
  }
  if (response.stop_reason === 'refusal') throw new Error(`${model} hat das Foto abgelehnt`);

  const text = response.content.map(b => (b.type === 'text' ? b.text : '')).join('');
  const parsed = parseRecognition(text);
  if (response.stop_reason === 'max_tokens') parsed.problems.push('Antwort abgeschnitten (max_tokens)');
  return {
    ...parsed,
    model,
    ms: Date.now() - started,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

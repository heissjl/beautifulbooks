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
  /**
   * The centre of the spine or cover, as fractions of the picture's width and
   * height — the model's estimate, good for a pin and nothing more. Until
   * 2026-10-01 the model gave a shelf row and a horizontal centre; on a pile
   * of books lying flat every book then shared one spot (Julian's photo of
   * two stacks: fifteen pins on six points). A point per book has no such
   * assumption about how books stand.
   */
  x?: number;
  y?: number;
  /** [x, y, w, h] as fractions of the picture: the book's outline. Nothing sets it yet — the model cannot draw one (PLAN-5.11a); it waits for a segmenter. */
  box?: [number, number, number, number];
}

export interface Recognition {
  books: RecognizedBook[];
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
 * The model is asked only for what it can do (5.11a, measured 2026-09-30 and
 * 2026-10-01): the reading order and a point on each book. Boxes with a
 * height per book were wrong on every dense shelf and cost most of the
 * answer, so the keys are short, the numbers are whole percentages, and
 * there is no confidence figure; rows of a shelf were dropped again because
 * books also lie in piles.
 */
const PROMPT = `This is a photo of books: a shelf of spines, a pile of books lying flat, or covers laid out.

List every book whose title you can read. Go through the picture in an order a person would: a shelf row by row from the top, left to right; a pile from top to bottom, one pile after another from the left.

For each book give:
- t: the title as printed, without series names or "a novel"
- a: the author as printed; "" if not visible and you are not sure
- k: "cover" if the front cover faces the camera, "spine" if only the spine is visible
- x: the horizontal centre of the spine (or of the cover) as a whole percentage of the picture width (0-100)
- y: its vertical centre as a whole percentage of the picture height (0-100)

Leave out books whose title you cannot read; do not guess titles from colours or shapes.
Answer with JSON only: {"books": [{"t": "...", "a": "...", "k": "spine", "x": 12, "y": 40}, ...]}.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['books'],
  properties: {
    books: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['t', 'a', 'k', 'x', 'y'],
        properties: {
          t: { type: 'string' },
          a: { type: 'string' },
          k: { type: 'string', enum: ['spine', 'cover'] },
          x: { type: 'integer' },
          y: { type: 'integer' },
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
  const x = fraction(r.x);
  if (r.x !== undefined && x === undefined) problems.push(`#${i + 1}: Mitte unbrauchbar`);
  const y = fraction(r.y);
  if (r.y !== undefined && y === undefined) problems.push(`#${i + 1}: Höhe unbrauchbar`);
  return { title, author, kind, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) };
}

export function parseRecognition(text: string): Recognition {
  const problems: string[] = [];
  const value = extractJson(text);
  if (value === undefined) return { books: [], problems: ['Antwort war kein JSON'] };
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { books?: unknown }).books)
      ? (value as { books: unknown[] }).books
      : null;
  if (!list) return { books: [], problems: ['JSON ohne Liste "books"'] };

  const books: RecognizedBook[] = [];
  list.forEach((raw, i) => {
    const book = parseBook(raw, i, problems);
    if (book) books.push(book);
  });
  return { books, problems };
}

/**
 * The books in an answer that is still arriving (5.11a; Julian, 2026-09-30:
 * „the overlay spine by spine in the picture as it is being detected“). The
 * answer is one object per book, so every object that has closed can be read
 * before the rest exists. Pure: give it the whole text so far, it returns
 * every complete book; the caller remembers how many it has already passed on.
 */
export function scanPartial(text: string): { books: RecognizedBook[] } {
  const booksAt = text.indexOf('"books"');
  if (booksAt < 0) return { books: [] };
  const listAt = text.indexOf('[', booksAt);
  const books: RecognizedBook[] = [];
  if (listAt < 0) return { books };
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
  return { books };
}

/**
 * Sends the photo to the model and parses its answer. Throws when there is no
 * key or the API fails; an empty `books` means the model answered and read
 * nothing — the two must not be confused (CLAUDE.md).
 *
 * The answer is streamed (5.11a): `onBook` gets every book as soon as its
 * object has closed.
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
      // effort medium. With the point prompt (2026-10-01) high thinks before it answers: the gallery wall cost
      // 3,100–5,200 answer tokens and 24–40 s for 42–47 books; medium reads 33–40 for 1,400–1,700 in 11–13 s.
      // (With the rows prompt of the day before it was the other way round, 25–27 against 38–41.)
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
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
        for (; handed < partial.books.length; handed++) onBook(partial.books[handed], handed);
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

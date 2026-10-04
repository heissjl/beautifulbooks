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
  /** The model read the title only in part and said so (the `unsure` variant, measured before it is used). */
  unsure?: true;
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
  /** The read was stopped at `stopAt` books: the caller has seen enough to decide to look closer. */
  stopped?: true;
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
/**
 * Variants of the read that are being measured against the test set before
 * any becomes the rule (lab/shelf/evaluate.ts --variant …; ROADMAP 5.11a):
 * `cut` tells the model to leave out a book the picture's edge cuts off;
 * `unsure` lets it give a half-read title and mark it, instead of the choice
 * between claiming it and leaving it out.
 */
export interface ReadVariant {
  cut?: boolean;
  unsure?: boolean;
}

function promptFor(v: ReadVariant): string {
  const fields = [
    '- t: the title as printed, without series names or "a novel"',
    '- a: the author as printed; "" if not visible and you are not sure',
    '- k: "cover" if the front cover faces the camera, "spine" if only the spine is visible',
    '- x: the horizontal centre of the spine (or of the cover) as a whole percentage of the picture width (0-100)',
    '- y: its vertical centre as a whole percentage of the picture height (0-100)',
    ...(v.unsure ? ['- u: false if you read the title clearly; true if you could read it only in part or are not sure of it'] : []),
  ];
  const rule = v.unsure
    ? 'A book whose title you can read only in part: give your best reading and set u to true. Do not guess titles from colours or shapes.'
    : 'Leave out books whose title you cannot read; do not guess titles from colours or shapes.';
  const cut = v.cut ? '\nLeave out a book that the edge of the picture cuts off so that its title is not whole.' : '';
  const example = v.unsure ? '{"t": "...", "a": "...", "k": "spine", "x": 12, "y": 40, "u": false}' : '{"t": "...", "a": "...", "k": "spine", "x": 12, "y": 40}';
  return `This is a photo of books: a shelf of spines, a pile of books lying flat, or covers laid out.

List every book whose title you can read. Go through the picture in an order a person would: a shelf row by row from the top, left to right; a pile from top to bottom, one pile after another from the left.

For each book give:
${fields.join('\n')}

${rule}${cut}
Answer with JSON only: {"books": [${example}, ...]}.`;
}

function schemaFor(v: ReadVariant) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['books'],
    properties: {
      books: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['t', 'a', 'k', 'x', 'y', ...(v.unsure ? ['u'] : [])],
          properties: {
            t: { type: 'string' },
            a: { type: 'string' },
            k: { type: 'string', enum: ['spine', 'cover'] },
            x: { type: 'integer' },
            y: { type: 'integer' },
            ...(v.unsure ? { u: { type: 'boolean' } } : {}),
          },
        },
      },
    },
  } as const;
}

/** The prompt as the site sends it, for the tests that hold it to its word. */
export const PROMPT = promptFor({});

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

/**
 * A whole percentage (or, from an older answer, a fraction) as a fraction of
 * the picture; undefined when it is no number. Not clamped at the top: on a
 * wide strip of thirty spines the model counts along rather than measures and
 * arrives at 150 "per cent" (measured 2026-10-03) — `settle` deals with that
 * once the whole answer is there.
 */
function fraction(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return Math.max(0, raw > 1 ? raw / 100 : raw);
}

/** Where the last book of an answer that overshot is put: near the edge, not on it. */
const FAR_EDGE = 0.97;

/**
 * Points inside the picture. An answer whose largest x (or y) lies beyond the
 * picture was counted, not measured; its books keep their order and their
 * spacing and are drawn back so that the last one stands at the edge. One
 * book of a partial answer can only be clamped.
 */
export function settle(books: readonly RecognizedBook[]): RecognizedBook[] {
  const scale = (key: 'x' | 'y') => {
    const max = Math.max(0, ...books.map((b) => b[key] ?? 0));
    return max > 1 ? FAR_EDGE / max : 1;
  };
  const sx = scale('x');
  const sy = scale('y');
  return books.map((b) => ({
    ...b,
    ...(b.x !== undefined ? { x: Math.min(1, b.x * sx) } : {}),
    ...(b.y !== undefined ? { y: Math.min(1, b.y * sy) } : {}),
  }));
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
  return { title, author, kind, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}), ...(r.u === true ? { unsure: true as const } : {}) };
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
  return { books: settle(books), problems };
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
          // A partial answer cannot be settled yet; a point beyond the picture waits at its edge.
          if (book) books.push({ ...book, ...(book.x !== undefined ? { x: Math.min(1, book.x) } : {}), ...(book.y !== undefined ? { y: Math.min(1, book.y) } : {}) });
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
 * object has closed, and with `stopAt` the read ends there — the books so far
 * come back with `stopped`.
 */
export async function recognize(
  image: Buffer,
  mediaType: 'image/jpeg' | 'image/png',
  onBook?: (book: RecognizedBook, index: number) => void,
  /** Stop reading once this many books have come (5.11a: a dense photo is then read again in pieces, and the rest of this answer would be paid for twice). */
  stopAt?: number,
  variant: ReadVariant = {},
): Promise<RecognitionRun> {
  if (!hasApiKey()) throw new Error('ANTHROPIC_API_KEY ist nicht gesetzt');
  const client = new Anthropic();
  const data = image.toString('base64');

  let sofar = '';
  let stopped = false;
  let usage = { input: 0, output: 0 };

  const ask = async (model: string): Promise<Anthropic.Message | null> => {
    sofar = '';
    const stream = client.messages.stream({
      model,
      max_tokens: 8000,
      // No thinking. Measured 2026-10-03 on three pieces of the gallery wall: with it 96 books for 6,762 answer
      // tokens in 14–20 s a piece, without it 95 for 4,133 in 10–13 s — it costs and reads nothing more.
      thinking: { type: 'disabled' },
      // effort medium. With the point prompt (2026-10-01) high cost the gallery wall 3,100–5,200 answer tokens
      // and 24–40 s for 42–47 books; medium reads 33–40 for 1,400–1,700 in 11–13 s.
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: schemaFor(variant) } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: promptFor(variant) },
        ],
      }],
    });
    let handed = 0;
    stream.on('text', (delta) => {
      if (stopped) return;
      sofar += delta;
      const partial = scanPartial(sofar);
      for (; handed < partial.books.length; handed++) onBook?.(partial.books[handed], handed);
      if (stopAt !== undefined && handed >= stopAt) {
        stopped = true;
        const now = stream.currentMessage?.usage;
        // The answer's tokens so far are not in the snapshot; four characters a token is the usual estimate.
        usage = { input: now?.input_tokens ?? 0, output: Math.round(sofar.length / 4) };
        stream.abort();
      }
    });
    try {
      return await stream.finalMessage();
    } catch (err) {
      if (stopped) return null;
      throw err;
    }
  };

  const started = Date.now();
  let model = PRIMARY_MODEL;
  let response: Anthropic.Message | null;
  try {
    response = await ask(model);
  } catch (err) {
    // Only a model this account cannot use moves to the fallback; a bad key
    // or a rate limit would fail the same way there.
    if (!(err instanceof Anthropic.NotFoundError || err instanceof Anthropic.PermissionDeniedError)) throw err;
    model = FALLBACK_MODEL;
    response = await ask(model);
  }
  if (!response) {
    return { books: scanPartial(sofar).books, problems: [], model, ms: Date.now() - started, inputTokens: usage.input, outputTokens: usage.output, stopped: true };
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

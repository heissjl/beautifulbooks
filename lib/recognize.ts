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
  /** [x, y, w, h] as fractions of the picture, clamped to 0..1. */
  box?: [number, number, number, number];
  /** 0..1, the model's own estimate. */
  confidence: number;
  /**
   * The publisher as printed, only when asked for (`RecognizeOptions`):
   * lab/shelf uses it to find the edition a spine belongs to (ROADMAP 5.16).
   */
  publisher?: string;
}

export interface RecognizeOptions {
  /** Also read the publisher's name or logo text. Off for the website. */
  publisher?: boolean;
  /**
   * Ask for boxes in pixels of this image instead of fractions (lab/shelf,
   * ROADMAP 5.16). Current models give image coordinates 1:1 in pixels; a
   * fraction is arithmetic the model does in its head, and on the first real
   * photo (2026-09-29) its fractional boxes came back evenly spaced and off
   * by half a shelf. `parseRecognition` turns pixels back into fractions, so
   * callers see the same `box` either way.
   */
  pixels?: { width: number; height: number };
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

const PROMPT = `This is a photo of books: a shelf of spines, a pile, or covers laid out.
List every book whose title you can read, in reading order (left to right, top to bottom).

For each book give:
- title: the title as printed, without series names or "a novel"
- author: the author as printed; "" if not visible and you are not sure
- kind: "cover" if the front cover faces the camera, "spine" if only the spine is visible
{BOX}
- confidence: 0..1, how sure you are of title and author together
{PUBLISHER}
Leave out books whose title you cannot read; do not guess titles from colours or shapes.
Answer with JSON only: {"books": [...]}.`;

const PUBLISHER_LINE = `- publisher: the publisher's name or imprint as printed on the book (on a spine usually at the foot, often as a logo with a word); "" if none is readable. Do not guess it from the design.
`;

const FRACTION_BOX = `- box: [x, y, w, h], the book's outline in the photo as fractions of the picture width and height (0..1), top-left origin`;

function promptFor(options: RecognizeOptions): string {
  const box = options.pixels
    ? `- box: [x0, y0, x1, y1], the book's outline in pixels of this image, which is ${options.pixels.width} × ${options.pixels.height} pixels; top-left origin, x0 < x1, y0 < y1. For a spine: its left and right edge, and its top and its foot where it stands on the shelf`
    : FRACTION_BOX;
  return PROMPT.replace('{BOX}', box).replace('{PUBLISHER}', options.publisher ? PUBLISHER_LINE : '');
}

function schemaFor(options: RecognizeOptions) {
  if (!options.publisher) return SCHEMA;
  const item = SCHEMA.properties.books.items;
  return {
    ...SCHEMA,
    properties: {
      books: {
        ...SCHEMA.properties.books,
        items: {
          ...item,
          required: [...item.required, 'publisher'],
          properties: { ...item.properties, publisher: { type: 'string' } },
        },
      },
    },
  };
}

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
        required: ['title', 'author', 'kind', 'box', 'confidence'],
        properties: {
          title: { type: 'string' },
          author: { type: 'string' },
          kind: { type: 'string', enum: ['spine', 'cover'] },
          box: { type: 'array', items: { type: 'number' } },
          confidence: { type: 'number' },
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

function parseBox(raw: unknown): RecognizedBook['box'] {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every(n => typeof n === 'number' && Number.isFinite(n))) return undefined;
  let [x, y, w, h] = raw as number[];
  // Some answers give pixels or percent; anything above 1 is not a fraction.
  if ([x, y, w, h].some(n => n > 1.0001)) return undefined;
  x = clamp01(x); y = clamp01(y);
  w = Math.min(clamp01(w), 1 - x); h = Math.min(clamp01(h), 1 - y);
  if (w <= 0.005 || h <= 0.005) return undefined;
  return [x, y, w, h];
}

/** Pixel corners [x0, y0, x1, y1] to the fraction box [x, y, w, h]; undefined when unusable. */
function pixelBox(raw: unknown, { width, height }: { width: number; height: number }): unknown {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every(n => typeof n === 'number' && Number.isFinite(n))) return undefined;
  const [x0, y0, x1, y1] = raw as number[];
  if (x1 <= x0 || y1 <= y0) return undefined;
  return [x0 / width, y0 / height, (x1 - x0) / width, (y1 - y0) / height];
}

export function parseRecognition(text: string, pixels?: { width: number; height: number }): Recognition {
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
    if (!raw || typeof raw !== 'object') { problems.push(`#${i + 1}: kein Objekt`); return; }
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === 'string' ? r.title.replace(/\s+/g, ' ').trim() : '';
    if (!title) { problems.push(`#${i + 1}: ohne Titel`); return; }
    const author = typeof r.author === 'string' ? r.author.replace(/\s+/g, ' ').trim() : '';
    const kind: BookKind = r.kind === 'cover' ? 'cover' : 'spine';
    if (r.kind !== 'cover' && r.kind !== 'spine') problems.push(`#${i + 1}: kind "${String(r.kind)}" als spine gelesen`);
    const box = parseBox(pixels ? pixelBox(r.box, pixels) : r.box);
    if (r.box !== undefined && !box) problems.push(`#${i + 1}: Ausschnitt unbrauchbar`);
    const confidence = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? clamp01(r.confidence) : 0.5;
    const publisher = typeof r.publisher === 'string' ? r.publisher.replace(/\s+/g, ' ').trim() : '';
    books.push({ title, author, kind, ...(box ? { box } : {}), confidence, ...(publisher ? { publisher } : {}) });
  });
  return { books, problems };
}

/**
 * Sends the photo to the model and parses its answer. Throws when there is no
 * key or the API fails; an empty `books` means the model answered and read
 * nothing — the two must not be confused (CLAUDE.md).
 */
export async function recognize(image: Buffer, mediaType: 'image/jpeg' | 'image/png', options: RecognizeOptions = {}): Promise<RecognitionRun> {
  if (!hasApiKey()) throw new Error('ANTHROPIC_API_KEY ist nicht gesetzt');
  const client = new Anthropic();
  const data = image.toString('base64');

  const ask = (model: string) => client.messages.create({
    model,
    max_tokens: 16000,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: schemaFor(options) } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
        { type: 'text', text: promptFor(options) },
      ],
    }],
  });

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
  const parsed = parseRecognition(text, options.pixels);
  if (response.stop_reason === 'max_tokens') parsed.problems.push('Antwort abgeschnitten (max_tokens)');
  return {
    ...parsed,
    model,
    ms: Date.now() - started,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

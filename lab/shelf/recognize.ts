/**
 * The shelf prototype's own read (ROADMAP 5.16). The site's reader in
 * lib/recognize.ts asks only for a point per book (5.11a); this lab needs
 * more from the same photo — each book's outline in pixels, its centre line
 * and thickness for a leaning or lying book, and the publisher at the foot of
 * the spine to find the edition. Until 2026-10-03 these were options of
 * lib/recognize.ts; when the site rewrote its prompt they moved here, so the
 * site's prompt and this one can change without each other.
 *
 * The photo goes to Anthropic once, as base64 in the request, and nowhere
 * else. `parseRecognition` is pure and tested.
 */
import Anthropic from '@anthropic-ai/sdk';
import { FALLBACK_MODEL, PRIMARY_MODEL, hasApiKey, type BookKind } from '../../lib/recognize';

export { FALLBACK_MODEL, PRIMARY_MODEL, hasApiKey, type BookKind };

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
  /**
   * With `RecognizeOptions.axis`: the line along the middle of the spine, end to end, and its
   * thickness, as [ax, ay, bx, by, t] with x and t as fractions of the width
   * and y of the height. Unlike `box` it describes a leaning or lying book.
   */
  axis?: [number, number, number, number, number];
}

export interface RecognizeOptions {
  /** Also read the publisher's name or logo text. */
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
  /**
   * Ask for each book's centre line and thickness instead of a box (needs
   * `pixels`). Julian, 2026-09-29: „teilweise liegen die bücher ja auch oder
   * sind schief im regal". `box` is then the rectangle around it.
   */
  axis?: boolean;
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

const PROMPT = `This is a photo of books: a shelf of spines, a pile, or covers laid out.
List every book whose title you can read, in reading order (left to right, top to bottom).

For each book give:
- title: the title as printed, without series names or "a novel"
- author: the author as printed; "" if not visible and you are not sure
{PUBLISHER}- kind: "cover" if the front cover faces the camera, "spine" if only the spine is visible
{BOX}
- confidence: 0..1, how sure you are of title and author together

Leave out books whose title you cannot read; do not guess titles from colours or shapes.
Answer with JSON only: {"books": [...]}.`;

const PUBLISHER_LINE = `- publisher: the publisher's name or imprint as printed on the book (on a spine usually at the foot, often as a logo with a word); "" if none is readable. Do not guess it from the design.
`;

const FRACTION_BOX = `- box: [x, y, w, h], the book's outline in the photo as fractions of the picture width and height (0..1), top-left origin`;

/**
 * The prompt for a set of options; without any, the fraction boxes the
 * prototype asked for before 2026-09-29. Exported for the tests.
 */
export function promptFor(options: RecognizeOptions): string {
  const box = options.pixels && options.axis
    ? `- axis: [x1, y1, x2, y2, t] in pixels of this image, which is ${options.pixels.width} × ${options.pixels.height} pixels, top-left origin: a line along the middle of the book's spine over its whole length, from one short end of the spine to the other (x1,y1 and x2,y2 are those two ends), and t the spine's width across that line in pixels. The line always runs along the long side: vertical for a book standing upright, slanted for one leaning, horizontal for one lying flat in a stack. For a front cover facing the camera: the line along its height, and t its width. Always five numbers.
- A book lying flat in a stack whose spine faces the camera is kind "spine", not "cover"`
    : options.pixels
    ? `- box: [x0, y0, x1, y1], the book's outline in pixels of this image, which is ${options.pixels.width} × ${options.pixels.height} pixels; top-left origin, x0 < x1, y0 < y1. For a spine: its left and right edge, and its top and its foot where it stands on the shelf`
    : FRACTION_BOX;
  return PROMPT.replace('{BOX}', box).replace('{PUBLISHER}', options.publisher ? PUBLISHER_LINE : '');
}

function schemaFor(options: RecognizeOptions) {
  if (!options.publisher && !options.axis) return SCHEMA;
  const item = SCHEMA.properties.books.items;
  const required: string[] = item.required.filter(k => !(options.axis && k === 'box'));
  const properties: Record<string, unknown> = { ...item.properties };
  if (options.axis) { delete properties.box; properties.axis = { type: 'array', items: { type: 'number' } }; required.push('axis'); }
  if (options.publisher) { properties.publisher = { type: 'string' }; required.push('publisher'); }
  // Right after the author, as in the prompt: the model fills fields in this order, and the
  // publisher came back for 3 of 58 books when it followed the geometry, 25 of 64 before.
  const order = ['title', 'author', 'publisher', 'kind', 'box', 'axis', 'confidence'];
  const ordered = Object.fromEntries(order.filter(k => k in properties).map(k => [k, properties[k]]));
  return {
    ...SCHEMA,
    properties: { books: { ...SCHEMA.properties.books, items: { ...item, required, properties: ordered } } },
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

/** Pixel axis [ax, ay, bx, by, t] to fractions, and the upright box around the turned rectangle. */
function pixelAxis(raw: unknown, { width, height }: { width: number; height: number }): { axis: NonNullable<RecognizedBook['axis']>; box: unknown } | undefined {
  if (!Array.isArray(raw) || raw.length !== 5 || !raw.every(n => typeof n === 'number' && Number.isFinite(n))) return undefined;
  const [ax, ay, bx, by, t] = raw as number[];
  const length = Math.hypot(bx - ax, by - ay);
  if (length < 2 || t <= 0) return undefined;
  const nx = -(by - ay) / length, ny = (bx - ax) / length;
  const xs = [ax + nx * t / 2, ax - nx * t / 2, bx + nx * t / 2, bx - nx * t / 2];
  const ys = [ay + ny * t / 2, ay - ny * t / 2, by + ny * t / 2, by - ny * t / 2];
  const x0 = Math.max(0, Math.min(...xs)), x1 = Math.min(width, Math.max(...xs));
  const y0 = Math.max(0, Math.min(...ys)), y1 = Math.min(height, Math.max(...ys));
  return {
    axis: [ax / width, ay / height, bx / width, by / height, t / width],
    box: [x0 / width, y0 / height, (x1 - x0) / width, (y1 - y0) / height],
  };
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
    const turned = pixels && r.axis !== undefined ? pixelAxis(r.axis, pixels) : undefined;
    const box = parseBox(turned ? turned.box : pixels ? pixelBox(r.box, pixels) : r.box);
    if ((r.box !== undefined || r.axis !== undefined) && !box) {
      // The raw numbers, so a rejected answer can be understood from the log.
      const raw = JSON.stringify(r.axis ?? r.box).slice(0, 60);
      problems.push(`#${i + 1}: Ausschnitt unbrauchbar${pixels ? ` ${raw}` : ''}`);
    }
    const confidence = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? clamp01(r.confidence) : 0.5;
    const publisher = typeof r.publisher === 'string' ? r.publisher.replace(/\s+/g, ' ').trim() : '';
    books.push({ title, author, kind, ...(box ? { box } : {}), ...(turned && box ? { axis: turned.axis } : {}), confidence, ...(publisher ? { publisher } : {}) });
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

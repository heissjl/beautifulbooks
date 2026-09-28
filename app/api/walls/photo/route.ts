import { NextRequest } from 'next/server';
import { hasApiKey, recognize, type RecognizedBook } from '@/lib/recognize';
import { matchPhotoBooks } from '@/lib/walls/photo';
import { json, openWalls } from '../guard';

/**
 * POST /api/walls/photo — a photo of books (JPEG or PNG, the browser has
 * already shrunk it) → the works on it, each with a tile to offer (ROADMAP
 * 5.13a, from the shelf lab 5.11). The photo goes to Anthropic once and is
 * never written or logged; the answer carries no copy of it.
 *
 * Outside production, `?sample=1` skips the model and uses a fixed list, so
 * the rest of the way can be tried without a key.
 */
export const maxDuration = 120;

const MAX_BYTES = 6 * 1024 * 1024;

const SAMPLE: RecognizedBook[] = [
  { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', kind: 'spine', confidence: 0.9 },
  { title: 'Dune', author: 'Frank Herbert', kind: 'spine', confidence: 0.9 },
  { title: 'Beloved', author: 'Toni Morrison', kind: 'cover', confidence: 0.9 },
  { title: 'Mrs Dalloway', author: 'Virginia Woolf', kind: 'spine', confidence: 0.8 },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', kind: 'spine', confidence: 0.9 },
  { title: 'Pedro Páramo', author: 'Juan Rulfo', kind: 'spine', confidence: 0.7 },
];

export async function POST(request: NextRequest) {
  const open = openWalls(request, 'wallsPhoto');
  if ('response' in open) return open.response;

  const sample = request.nextUrl.searchParams.get('sample') === '1' && process.env.VERCEL_ENV !== 'production';
  let books: RecognizedBook[];
  let problems: string[] = [];
  if (sample) {
    books = SAMPLE;
  } else {
    if (!hasApiKey()) return json({ error: 'Reading photos is not switched on here.' }, 503);
    const type = (request.headers.get('content-type') ?? '').split(';')[0];
    if (type !== 'image/jpeg' && type !== 'image/png') return json({ error: 'Send a JPEG or PNG.' }, 415);
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length === 0) return json({ error: 'The photo was empty.' }, 400);
    if (bytes.length > MAX_BYTES) return json({ error: 'The photo is too large.' }, 413);
    try {
      const run = await recognize(bytes, type);
      books = run.books;
      problems = run.problems;
    } catch {
      // Never "no books": the model did not answer, which is something else (N12).
      return json({ error: 'The photo could not be read just now. Try again in a moment.' }, 502);
    }
  }
  const matches = await matchPhotoBooks(books);
  return json({ matches, read: books.length, problems: problems.length, sample });
}

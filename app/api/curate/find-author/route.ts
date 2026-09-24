import { NextRequest } from 'next/server';
import { findAuthors } from '@/lib/curate/catalog';
import { json, memberGate } from '../../suggest/guard';

/** Who an author is at Open Library, for adding one to a draft (ROADMAP 5.10b). */
export async function GET(request: NextRequest) {
  const gate = memberGate(request);
  if ('response' in gate) return gate.response;
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return json({ error: 'Type at least two letters.' }, 400);
  try {
    return json({ found: await findAuthors(q) });
  } catch {
    // A catalogue that did not answer is not "nobody by that name" (N12).
    return json({ error: 'Open Library did not answer. Try again in a moment.' }, 502);
  }
}

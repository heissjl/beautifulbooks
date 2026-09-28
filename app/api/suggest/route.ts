import { NextRequest } from 'next/server';
import { readBody } from '@/app/api/versus/guard';
import { allCollections } from '@/lib/collections';
import { parseSuggestion } from '@/lib/suggest/store';
import { adminGate, friendGate, json, storeDown } from './guard';

/**
 * POST: a friend sends a suggestion. GET: Julian's local tool reads them all,
 * with its decisions (ROADMAP 5.10a, SPEC F8.4).
 *
 * Suggestions may name any collection the file holds, drafts included — a
 * friend helping to fill a draft is the point — and an author who is not on a
 * collection's list: that is a question to Julian, not a change, and his tool
 * shows it as one.
 */
export async function POST(request: NextRequest) {
  const gate = friendGate(request);
  if ('response' in gate) return gate.response;
  const known = allCollections({ includeDrafts: true }).map(c => c.slug);
  const suggestion = parseSuggestion(await readBody(request), known);
  if (typeof suggestion === 'string') return json({ error: suggestion }, 400);
  try {
    await gate.store.add(suggestion);
  } catch {
    return storeDown();
  }
  return json({ ok: true, id: suggestion.id });
}

export async function GET(request: NextRequest) {
  const gate = adminGate(request);
  if ('response' in gate) return gate.response;
  try {
    const [suggestions, decisions] = await Promise.all([gate.store.list(), gate.store.decisions()]);
    return json({ store: gate.store.kind, suggestions, decisions });
  } catch {
    return storeDown();
  }
}

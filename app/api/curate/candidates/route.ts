import { NextRequest } from 'next/server';
import { candidatesFor } from '@/lib/curate/catalog';
import { json, memberGate } from '../../suggest/guard';
import { draftStore, loadDraft } from '../store';

/** The most-printed works of one author or publisher on a draft (ROADMAP 5.10b). */
export async function GET(request: NextRequest) {
  const gate = memberGate(request);
  if ('response' in gate) return gate.response;
  const s = draftStore();
  if ('response' in s) return s.response;
  const loaded = await loadDraft(s.store, request.nextUrl.searchParams.get('draft'));
  if ('response' in loaded) return loaded.response;
  let candidates;
  try {
    candidates = await candidatesFor(loaded.draft, request.nextUrl.searchParams.get('source') ?? '');
  } catch {
    return json({ error: 'Open Library did not answer. Try again in a moment.' }, 502);
  }
  if (!candidates) return json({ error: 'That name is not on this draft.' }, 400);
  return json({ candidates });
}

import type { NextResponse } from 'next/server';
import { missingStoreMessage } from '@/lib/hotornot/store';
import { draftStoreFromEnv, isDraftId, type Draft, type DraftStore } from '@/lib/curate/drafts';
import { json } from '../suggest/guard';

/** The draft store, or the 503 that says why there is none (ROADMAP 5.10b). */
export function draftStore(): { store: DraftStore } | { response: NextResponse } {
  const store = draftStoreFromEnv();
  return store ? { store } : { response: json({ error: missingStoreMessage() }, 503) };
}

export const storeDown = () => json({ error: 'The draft store did not answer. Try again in a moment.' }, 503);

/** A live draft by id, or the answer to give instead. */
export async function loadDraft(store: DraftStore, id: string | null): Promise<{ draft: Draft } | { response: NextResponse }> {
  if (!id || !isDraftId(id)) return { response: json({ error: 'No such draft.' }, 404) };
  let draft: Draft | null;
  try {
    draft = await store.get(id);
  } catch {
    return { response: storeDown() };
  }
  if (!draft || draft.deleted) return { response: json({ error: 'No such draft. Someone may have deleted it.' }, 404) };
  return { draft };
}

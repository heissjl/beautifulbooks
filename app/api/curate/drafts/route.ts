import { NextRequest } from 'next/server';
import { readBody } from '@/app/api/versus/guard';
import { allCollections } from '@/lib/collections';
import collectionsFile from '@/data/collections.json';
import type { CollectionRecord } from '@/lib/collections';
import { listDrafts, newDraft } from '@/lib/curate/drafts';
import { json, memberGate } from '../../suggest/guard';
import { draftStore, storeDown } from '../store';

/**
 * GET: every draft, for friends and for Julian's tool. POST: a new draft,
 * empty or copied from a collection in the file (`from: <slug>`), drafts of
 * the file included — a friend helping to fill "Women writers" starts there.
 * (ROADMAP 5.10b, SPEC F8.5.)
 */
export async function GET(request: NextRequest) {
  const gate = memberGate(request);
  if ('response' in gate) return gate.response;
  const s = draftStore();
  if ('response' in s) return s.response;
  try {
    return json({ store: s.store.kind, drafts: await listDrafts(s.store) });
  } catch {
    return storeDown();
  }
}

export async function POST(request: NextRequest) {
  const gate = memberGate(request);
  if ('response' in gate) return gate.response;
  const s = draftStore();
  if ('response' in s) return s.response;
  const body = await readBody(request);
  const records = (collectionsFile as { collections: CollectionRecord[] }).collections;
  const known = new Set(allCollections({ includeDrafts: true }).map(c => c.slug));
  const from = typeof body.from === 'string' && body.from ? records.find(r => r.slug === body.from && known.has(r.slug)) : undefined;
  if (body.from && !from) return json({ error: 'That collection does not exist.' }, 400);
  let draft;
  try {
    draft = newDraft(body, new Date(), from);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Not created.' }, 400);
  }
  try {
    await s.store.put(draft);
    await s.store.register(draft.id);
  } catch {
    return storeDown();
  }
  return json({ draft });
}

import { NextRequest } from 'next/server';
import { readBody } from '@/app/api/versus/guard';
import { liveRecords } from '@/lib/collections-live';
import { draftToContinue, listDrafts, newDraft } from '@/lib/curate/drafts';
import { json, memberGate } from '../../suggest/guard';
import { draftStore, storeDown } from '../store';
import { measure } from '@/app/api/measure';

/**
 * GET: every draft, for friends and for Julian's tool. POST: a new draft,
 * empty or copied from a collection (`from: <slug>`), drafts of the file
 * included — a friend helping to fill "Women writers" starts there.
 * (ROADMAP 5.10b, SPEC F8.5.)
 *
 * The copy is the collection as the site shows it now — the file with any
 * draft published from /curate on top — not the file alone: copying the file
 * started Julian's next edit from a version the site had already replaced
 * (2026-10-05). With `reuse: true` (the Edit button) a draft that still holds
 * exactly that version is opened instead of a second copy.
 */
export async function GET(request: NextRequest) {
  measure('curate', request);
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
  measure('curate', request);
  const gate = memberGate(request);
  if ('response' in gate) return gate.response;
  const s = draftStore();
  if ('response' in s) return s.response;
  const body = await readBody(request);
  const from = typeof body.from === 'string' && body.from ? (await liveRecords()).find(r => r.slug === body.from) : undefined;
  if (body.from && !from) return json({ error: 'That collection does not exist.' }, 400);
  if (from && body.reuse === true) {
    try {
      const existing = draftToContinue(await listDrafts(s.store), from);
      if (existing) return json({ draft: existing, reused: true });
    } catch {
      return storeDown();
    }
  }
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

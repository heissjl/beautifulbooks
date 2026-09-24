import { NextRequest } from 'next/server';
import { readBody } from '@/app/api/versus/guard';
import { applyOp } from '@/lib/curate/drafts';
import { json, memberGate } from '../../../suggest/guard';
import { draftStore, loadDraft, storeDown } from '../../store';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * One change to one draft (`lib/curate/drafts.ts`, `applyOp`), answered with
 * the draft as it now stands. Julian's tool may also mark a draft imported.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const gate = memberGate(request);
  if ('response' in gate) return gate.response;
  const s = draftStore();
  if ('response' in s) return s.response;
  const loaded = await loadDraft(s.store, (await params).id);
  if ('response' in loaded) return loaded.response;
  const body = await readBody(request);
  let next;
  if (body.op === 'imported') {
    if (!gate.admin) return json({ error: 'Only Julian can mark a draft imported.' }, 403);
    next = { ...loaded.draft, importedOn: new Date().toISOString().slice(0, 10) };
  } else {
    try {
      next = applyOp(loaded.draft, body);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Not changed.' }, 400);
    }
  }
  try {
    await s.store.put(next);
  } catch {
    return storeDown();
  }
  return json({ draft: next });
}

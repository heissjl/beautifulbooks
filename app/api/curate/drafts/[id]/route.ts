import { NextRequest } from 'next/server';
import { readBody } from '@/app/api/versus/guard';
import { applyOp, toRecord } from '@/lib/curate/drafts';
import { collectionRecords, isCollectionSlug, parseCollections } from '@/lib/collections';
import { publishStoreFromEnv } from '@/lib/collections-live';
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
  } else if (body.op === 'publish') {
    // Julian publishes the draft itself (5.10g): the site shows the draft's
    // covers, order and text in place of the collection with that address,
    // at once. Only the admin; a friend's cookie cannot.
    if (!gate.admin) return json({ error: 'Only Julian can publish.' }, 403);
    const d = loaded.draft;
    if (!isCollectionSlug(d.slug)) return json({ error: `Not a usable address: ${d.slug}` }, 400);
    const file = collectionRecords().find(r => r.slug === d.slug);
    const record = {
      ...toRecord(d),
      published: true,
      ...(file?.coverCredits ? { coverCredits: file.coverCredits } : {}),
      ...(file?.coverSource ? { coverSource: file.coverSource } : {}),
    };
    if (parseCollections([record], { includeDrafts: true }).length !== 1) return json({ error: 'This draft cannot be shown as a collection.' }, 400);
    const pub = publishStoreFromEnv();
    if (!pub) return json({ error: 'No store on this deployment.' }, 503);
    try {
      const content = await pub.getContent();
      await pub.setContent({ ...content, [d.slug]: record });
      const switches = await pub.get();
      if (d.slug in switches) { const rest = { ...switches }; delete rest[d.slug]; await pub.set(rest); }
    } catch {
      return storeDown();
    }
    next = { ...d, publishedOn: new Date().toISOString() };
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

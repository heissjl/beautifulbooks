/**
 * What it takes to make an online draft equal a collection in the file, as
 * the draft's own steps (`applyOp` in lib/curate/drafts.ts). Pure, so the
 * push tool can be tested without the network.
 */
import type { CollectionPick, CollectionRecord } from '../../lib/collections';

export interface DraftLike {
  title: string;
  intro: string;
  works: Array<Pick<CollectionPick, 'id' | 'title' | 'author' | 'coverId'>>;
}

export type Op =
  | { op: 'meta'; title?: string; intro?: string }
  | { op: 'remove'; id: string }
  | { op: 'pick'; id: string; title: string; author: string; coverId: string }
  | { op: 'order'; ids: string[] };

/**
 * The file's picks a draft can hold: an `ol:` cover (a site-served image is
 * refused by /curate) and each work once (a draft keys picks by work). The
 * rest stays in the file only and is not reported as a difference.
 */
export function draftableWorks<T extends Pick<CollectionPick, 'id' | 'coverId'>>(works: T[]): T[] {
  const seen = new Set<string>();
  return works.filter(w => /^ol:\d+$/.test(w.coverId) && !seen.has(w.id) && (seen.add(w.id), true));
}

export function draftDelta(draft: DraftLike, fileRecord: Pick<CollectionRecord, 'title' | 'intro' | 'works'>): { ops: Op[]; onlineOnly: string[]; summary: string } {
  const record = { ...fileRecord, works: draftableWorks(fileRecord.works) };
  const ops: Op[] = [];
  const meta: { op: 'meta'; title?: string; intro?: string } = { op: 'meta' };
  if (draft.title !== record.title) meta.title = record.title;
  if ((draft.intro ?? '') !== (record.intro ?? '')) meta.intro = record.intro ?? '';
  if (meta.title !== undefined || meta.intro !== undefined) ops.push(meta);

  const fileIds = new Set(record.works.map(w => w.id));
  // First pick per work, as the draft's own steps see it; a draft copied from the file may hold a work under several covers.
  const online = new Map<string, DraftLike['works'][number]>();
  for (const w of draft.works) if (!online.has(w.id)) online.set(w.id, w);
  // A draft copied from the deployed file on /curate carries the file's own picks, site images included; those are not extra.
  const anyFileIds = new Set(fileRecord.works.map(w => w.id));
  const removed = draft.works.filter(w => !anyFileIds.has(w.id));
  for (const w of removed) ops.push({ op: 'remove', id: w.id });
  let added = 0;
  let covers = 0;
  let renamed = 0;
  for (const w of record.works) {
    const o = online.get(w.id);
    // Titles and authors count too: a name corrected in the file must reach the draft (Poésie/Gallimard, 2026-09-26).
    if (o && o.coverId === w.coverId && o.title === w.title && o.author === w.author) continue;
    if (!o) added += 1; else if (o.coverId !== w.coverId) covers += 1; else renamed += 1;
    ops.push({ op: 'pick', id: w.id, title: w.title, author: w.author, coverId: w.coverId });
  }
  const wanted = record.works.map(w => w.id);
  const kept = [...new Set(draft.works.filter(w => fileIds.has(w.id)).map(w => w.id))];
  const afterSteps = [...kept, ...wanted.filter(id => !online.has(id))];
  if (afterSteps.join() !== wanted.join()) ops.push({ op: 'order', ids: wanted });

  // What only the online draft has: works the file does not list, and other covers for the same work.
  const onlineOnly = [
    ...removed.map(w => `${w.title} (not in the file)`),
    ...record.works.filter(w => online.has(w.id) && online.get(w.id)!.coverId !== w.coverId).map(w => `${w.title}: online ${online.get(w.id)!.coverId}, file ${w.coverId}`),
  ];
  const summary = [meta.title !== undefined && 'title', meta.intro !== undefined && 'intro', removed.length && `${removed.length} removed`, added && `${added} added`, covers && `${covers} covers`, renamed && `${renamed} renamed`, ops.some(o => o.op === 'order') && 'order'].filter(Boolean).join(', ') || 'already equal';
  return { ops, onlineOnly, summary };
}

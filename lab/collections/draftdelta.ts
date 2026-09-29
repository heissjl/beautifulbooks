/**
 * What it takes to make an online draft equal a collection in the file, as
 * the draft's own steps (`applyOp` in lib/curate/drafts.ts). Pure, so the
 * push tool can be tested without the network.
 *
 * Tiles are compared by work and cover (`pickKey`): since 2026-09-29 a wall
 * may show one work twice when two printings have their own designs (Julian:
 * both Lone Star covers, the two layouts of the Fischer Bücherei), and a
 * draft holds that too.
 */
import type { CollectionPick, CollectionRecord } from '../../lib/collections';
import { pickKey, removePick, upsertPick } from '../../lib/collectionedit';

export interface DraftLike {
  title: string;
  intro: string;
  works: Array<Pick<CollectionPick, 'id' | 'title' | 'author' | 'coverId'>>;
}

export type Op =
  | { op: 'meta'; title?: string; intro?: string }
  | { op: 'remove'; id: string; coverId?: string }
  | { op: 'pick'; id: string; title: string; author: string; coverId: string; again?: boolean; was?: string }
  | { op: 'order'; ids: string[] };

type Tile = DraftLike['works'][number];

/** The file's picks a draft can hold: an `ol:` cover (a site-served image is refused by /curate). The rest stays in the file only. */
export function draftableWorks<T extends Pick<CollectionPick, 'id' | 'coverId'>>(works: T[]): T[] {
  return works.filter(w => /^ol:\d+$/.test(w.coverId));
}

export function draftDelta(draft: DraftLike, fileRecord: Pick<CollectionRecord, 'title' | 'intro' | 'works'>): { ops: Op[]; onlineOnly: string[]; summary: string } {
  const file = draftableWorks(fileRecord.works);
  const fileKeys = new Set(file.map(pickKey));
  const anyFileIds = new Set(fileRecord.works.map(w => w.id));
  const anyFileKeys = new Set(fileRecord.works.map(pickKey));
  // A draft copied from the deployed file on /curate carries the file's own picks, site images included; those are not extra.
  const online = draft.works.filter(w => !(anyFileKeys.has(pickKey(w)) && !fileKeys.has(pickKey(w))));
  const onlineKeys = new Set(online.map(pickKey));

  const ops: Op[] = [];
  const onlineOnly: string[] = [];
  const meta: { op: 'meta'; title?: string; intro?: string } = { op: 'meta' };
  if (draft.title !== fileRecord.title) meta.title = fileRecord.title;
  if ((draft.intro ?? '') !== (fileRecord.intro ?? '')) meta.intro = fileRecord.intro ?? '';
  if (meta.title !== undefined || meta.intro !== undefined) ops.push(meta);

  let removed = 0;
  let added = 0;
  let covers = 0;
  let renamed = 0;
  const pick = (w: Tile, extra: { again?: boolean; was?: string } = {}): Op => ({ op: 'pick', id: w.id, title: w.title, author: w.author, coverId: w.coverId, ...extra });

  // Tiles only the online draft has, and tiles only the file has, per work.
  const extraOnline = new Map<string, Tile[]>();
  for (const w of online) if (!fileKeys.has(pickKey(w))) extraOnline.set(w.id, [...(extraOnline.get(w.id) ?? []), w]);
  for (const w of online) {
    if (anyFileIds.has(w.id)) continue;
    // A work the file does not list at all goes as a whole.
    if (!ops.some(o => o.op === 'remove' && o.id === w.id)) { ops.push({ op: 'remove', id: w.id }); removed += 1; }
    onlineOnly.push(`${w.title} (not in the file)`);
    extraOnline.delete(w.id);
  }
  for (const w of file) {
    const key = pickKey(w);
    if (onlineKeys.has(key)) {
      const o = online.find(x => pickKey(x) === key)!;
      // Titles and authors count too: a name corrected in the file must reach the draft (Poésie/Gallimard, 2026-09-26).
      if (o.title !== w.title || o.author !== w.author) { ops.push(pick(w)); renamed += 1; }
      continue;
    }
    const spare = extraOnline.get(w.id);
    if (spare?.length) {
      // The online draft shows this work with a cover the file does not have: another cover chosen online.
      const o = spare.shift()!;
      onlineOnly.push(`${w.title}: online ${o.coverId}, file ${w.coverId}`);
      ops.push(pick(w, { was: o.coverId }));
      covers += 1;
      continue;
    }
    const workOnline = online.some(x => x.id === w.id) || ops.some(o => o.op === 'pick' && o.id === w.id);
    ops.push(pick(w, workOnline ? { again: true } : {}));
    added += 1;
  }
  for (const [, rest] of extraOnline) {
    for (const o of rest) {
      onlineOnly.push(`${o.title}: online also ${o.coverId}`);
      ops.push({ op: 'remove', id: o.id, coverId: o.coverId });
      removed += 1;
    }
  }

  // The order the steps leave, worked out with the server's own rules.
  let after: CollectionRecord = { slug: 'x', title: '', kind: 'series', intro: '', published: false, works: draft.works.map(w => ({ ...w })) };
  for (const o of ops) {
    if (o.op === 'remove') after = removePick(after, o.id, o.coverId);
    if (o.op === 'pick') after = upsertPick(after, { id: o.id, title: o.title, author: o.author, coverId: o.coverId }, { again: o.again, was: o.was });
  }
  const wanted = file.map(pickKey);
  const afterKeys = after.works.map(pickKey).filter(k => fileKeys.has(k));
  if (afterKeys.join() !== wanted.join()) ops.push({ op: 'order', ids: wanted });

  // An order set by hand online is the newest version (Julian, 2026-09-28: „pass darauf auf, dass die
  // reihenfolge und coverwahl die ich online gemacht habe, erhalten bleibt"): a different sequence of the
  // tiles both hold stops the push, as a different cover does, until it is taken into the file.
  const kept = online.map(pickKey).filter(k => fileKeys.has(k));
  if (kept.join() !== wanted.filter(k => onlineKeys.has(k)).join()) onlineOnly.push('the order of the works differs from the file');

  const summary = [meta.title !== undefined && 'title', meta.intro !== undefined && 'intro', removed && `${removed} removed`, added && `${added} added`, covers && `${covers} covers`, renamed && `${renamed} renamed`, ops.some(o => o.op === 'order') && 'order'].filter(Boolean).join(', ') || 'already equal';
  return { ops, onlineOnly, summary };
}

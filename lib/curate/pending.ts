/**
 * Unsaved edits on /curate (Julian, 2026-09-26: „es muss einen speichern
 * button bei der bearbeitung der collections geben"). Until then every drag
 * and every × went to the server at once, one request each — slow, and a
 * long rearrangement ran into the rate limit halfway. Now the tool keeps the
 * edits here and sends them as a batch when Julian presses Save.
 *
 * Pure, runs in the browser; the server still applies each step with
 * `applyOp`, so nothing here is trusted.
 */
import type { CollectionPick } from '../collections';

/** What a wall tile needs; a chosen cover carries the same. */
export type WallPick = Pick<CollectionPick, 'id' | 'title' | 'author' | 'coverId'> & { firstPublished?: number };

export interface Pending {
  title?: string;
  intro?: string;
  by?: string;
  /** Works taken off the wall. A work is never both here and in `picks`: choosing a cover takes it back. */
  removed: string[];
  /** Covers chosen (or books added), by work id. */
  picks: Record<string, WallPick>;
  /** The whole order, once anything was moved. */
  order: string[] | null;
}

export const NOTHING_PENDING: Pending = { removed: [], picks: {}, order: null };

export function hasPending(p: Pending): boolean {
  return p.title !== undefined || p.intro !== undefined || p.by !== undefined
    || p.removed.length > 0 || Object.keys(p.picks).length > 0 || p.order !== null;
}

/** The wall as it will be after Save: removals out, picks in (new ones at the end), then the order. */
export function pendingWorks<T extends WallPick>(works: readonly T[], p: Pending): Array<T | WallPick> {
  const removed = new Set(p.removed);
  const out: Array<T | WallPick> = works.filter(w => !removed.has(w.id)).map(w => p.picks[w.id] ? { ...w, ...p.picks[w.id] } : w);
  for (const [id, pick] of Object.entries(p.picks)) if (!removed.has(id) && !out.some(w => w.id === id)) out.push(pick);
  if (!p.order) return out;
  const at = new Map(p.order.map((id, i) => [id, i]));
  return [...out].sort((a, b) => (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity));
}

/** Moves one work to a position in the wall as shown (`to` counts in the list without it). */
export function moveTo(ids: readonly string[], id: string, to: number): string[] {
  const rest = ids.filter(x => x !== id);
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** The steps Save sends, in an order the server can apply one by one. */
export function pendingOps(p: Pending, finalIds: readonly string[]): Array<Record<string, unknown>> {
  const ops: Array<Record<string, unknown>> = [];
  if (p.title !== undefined || p.intro !== undefined || p.by !== undefined) {
    ops.push({ op: 'meta', ...(p.title !== undefined ? { title: p.title } : {}), ...(p.intro !== undefined ? { intro: p.intro } : {}), ...(p.by !== undefined ? { by: p.by } : {}) });
  }
  for (const id of p.removed) ops.push({ op: 'remove', id });
  for (const pick of Object.values(p.picks)) {
    ops.push({ op: 'pick', id: pick.id, title: pick.title, author: pick.author, coverId: pick.coverId, ...(pick.firstPublished ? { firstPublished: pick.firstPublished } : {}) });
  }
  if (p.order || Object.keys(p.picks).length > 0) ops.push({ op: 'order', ids: [...finalIds] });
  return ops;
}

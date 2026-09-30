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
import { parsePickKey, pickKey } from '../collectionedit';

/** What a wall tile needs; a chosen cover carries the same. */
export type WallPick = Pick<CollectionPick, 'id' | 'title' | 'author' | 'coverId'> & { firstPublished?: number };

/** A chosen cover: for a tile already saved (keyed by its saved key), or a new tile (`again` when the work is on the wall already). */
export type PendingPick = WallPick & { again?: boolean };

export interface Pending {
  title?: string;
  intro?: string;
  by?: string;
  /** Saved tiles taken off the wall, by tile key (`pickKey`). A tile is never both here and in `picks`. */
  removed: string[];
  /**
   * Covers chosen and books added. A saved tile's new cover sits under the
   * tile's saved key; a new tile under its own key. A wall may show a work
   * more than once (two printings, two designs), so keys are work + cover.
   */
  picks: Record<string, PendingPick>;
  /** The whole order as tile keys, once anything was moved. */
  order: string[] | null;
}

export const NOTHING_PENDING: Pending = { removed: [], picks: {}, order: null };

export { pickKey };

export function hasPending(p: Pending): boolean {
  return p.title !== undefined || p.intro !== undefined || p.by !== undefined
    || p.removed.length > 0 || Object.keys(p.picks).length > 0 || p.order !== null;
}

/** The wall as it will be after Save: removals out, picks in (new ones at the end), then the order. */
export function pendingWorks<T extends WallPick>(works: readonly T[], p: Pending): Array<T | WallPick> {
  const removed = new Set(p.removed);
  const saved = new Set(works.map(pickKey));
  const out: Array<T | WallPick> = works
    .filter(w => !removed.has(pickKey(w)))
    .map(w => (p.picks[pickKey(w)] ? { ...w, ...strip(p.picks[pickKey(w)]) } : w));
  for (const [key, pick] of Object.entries(p.picks)) {
    if (saved.has(key) || out.some(w => pickKey(w) === pickKey(pick))) continue;
    out.push(strip(pick));
  }
  if (!p.order) return out;
  const at = new Map(p.order.map((key, i) => [key, i]));
  return [...out].sort((a, b) => (at.get(pickKey(a)) ?? Infinity) - (at.get(pickKey(b)) ?? Infinity));
}

function strip(pick: PendingPick): WallPick {
  const { again: _again, ...rest } = pick;
  void _again;
  return rest;
}

/** Moves one tile to a position in the wall as shown (`to` counts in the list without it). */
export function moveTo(keys: readonly string[], key: string, to: number): string[] {
  const rest = keys.filter(x => x !== key);
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), key, ...rest.slice(at)];
}

/**
 * Takes the tile shown under `shownKey` off the wall: a new tile simply goes,
 * a saved one (even with a new cover chosen) is marked removed under its
 * saved key.
 */
export function removeTile(p: Pending, savedKeys: ReadonlySet<string>, shownKey: string): Pending {
  const picks = { ...p.picks };
  let removedKey: string | null = savedKeys.has(shownKey) && !(shownKey in picks) ? shownKey : null;
  for (const [key, pick] of Object.entries(picks)) {
    if (pickKey(pick) !== shownKey && key !== shownKey) continue;
    delete picks[key];
    if (savedKeys.has(key)) removedKey = key;
  }
  return {
    ...p,
    picks,
    removed: removedKey ? [...new Set([...p.removed, removedKey])] : p.removed,
    order: p.order?.filter(x => x !== shownKey) ?? null,
  };
}

/** The steps Save sends, in an order the server can apply one by one. */
export function pendingOps(p: Pending, finalKeys: readonly string[]): Array<Record<string, unknown>> {
  const ops: Array<Record<string, unknown>> = [];
  if (p.title !== undefined || p.intro !== undefined || p.by !== undefined) {
    ops.push({ op: 'meta', ...(p.title !== undefined ? { title: p.title } : {}), ...(p.intro !== undefined ? { intro: p.intro } : {}), ...(p.by !== undefined ? { by: p.by } : {}) });
  }
  for (const key of p.removed) {
    const { id, coverId } = parsePickKey(key);
    ops.push({ op: 'remove', id, ...(coverId ? { coverId } : {}) });
  }
  for (const [key, pick] of Object.entries(p.picks)) {
    const saved = parsePickKey(key);
    const was = saved.id === pick.id && saved.coverId && saved.coverId !== pick.coverId && !pick.again ? saved.coverId : undefined;
    ops.push({
      op: 'pick', id: pick.id, title: pick.title, author: pick.author, coverId: pick.coverId,
      ...(pick.firstPublished ? { firstPublished: pick.firstPublished } : {}),
      ...(pick.again ? { again: true } : {}),
      ...(was ? { was } : {}),
    });
  }
  if (p.order || Object.keys(p.picks).length > 0) ops.push({ op: 'order', ids: [...finalKeys] });
  return ops;
}

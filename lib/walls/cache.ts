/**
 * What a function instance remembers of readers' walls between requests
 * (ROADMAP 2.18c). Server only; pure apart from the clock, which is passed in.
 *
 * Measured 2026-10-05 (2.18b): `/c/<id>` read its wall twice per visit — once
 * for the metadata, once for the page — and counted the view with a third
 * command; `/collections` and `/collections/readers` read every shown wall by
 * id, one `GET` per listed wall, on every request. None of that needs the
 * store each time:
 *
 * - A wall is kept `WALL_TTL_MS` for viewers. Its owner always reads the
 *   store (`app/c/[id]/page.tsx`): they are the one who changes it, and a page
 *   that showed them their own change half a minute late would look broken.
 *   A write to a wall forgets it here on the instance that took the write
 *   (`lib/walls/store.ts`); the other instances forget it when it ages out.
 *   "No such wall" is kept too, so a walked address costs one read per half
 *   minute, not one per request.
 * - The list of shown walls — ids, views, reports and the walls themselves —
 *   is kept `LIST_TTL_MS`. A wall newly shown, hidden, changed or reported
 *   forgets the list on the instance that took the change.
 * - A view is not written when it happens but added to a buffer; the first
 *   request after `FLUSH_EVERY_MS` writes the buffer as one command
 *   (`WallStore.viewMany`), after its response has left. What an instance has
 *   buffered when it is stopped is lost — a count, not a reader's work, and
 *   at most ten seconds of it.
 *
 * One memory per instance, on `globalThis` (see `wallMemory` in `./store.ts`).
 */
import type { Wall } from './model';
import type { ShownWall } from './store';

export const WALL_TTL_MS = 30_000;
export const LIST_TTL_MS = 60_000;
export const FLUSH_EVERY_MS = 10_000;
/** Walls remembered at most; the oldest goes when the next arrives, so a crawler walking ids cannot grow the memory. */
export const WALLS_REMEMBERED = 500;
/** Views waiting to be written at most; beyond that the oldest go, so a dead store cannot grow the buffer. */
export const VIEWS_BUFFERED = 1000;

interface Held<T> {
  value: T;
  at: number;
}

function dropOldest<K, V>(map: Map<K, V>, max: number): void {
  while (map.size > max) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}

export class WallMemory {
  private readonly walls = new Map<string, Held<Wall | null>>();
  private list: Held<ShownWall[]> | undefined;
  private readonly views = new Map<string, number>();
  private flushedAt = 0;
  /** Reads answered from memory, and reads that went to the store — for the operations block (2.18g). */
  hits = 0;
  misses = 0;

  /** The wall as remembered: `null` for "no such wall", `undefined` when it must be read. */
  wall(id: string, now: number): Wall | null | undefined {
    const held = this.walls.get(id);
    return held && now - held.at < WALL_TTL_MS ? held.value : undefined;
  }

  /** The wall however old — for a reader while the store is paused. */
  staleWall(id: string): Wall | null | undefined {
    return this.walls.get(id)?.value;
  }

  keepWall(id: string, wall: Wall | null, now: number): void {
    // Delete first, so the entry moves to the end: the map is in order of last keeping.
    this.walls.delete(id);
    this.walls.set(id, { value: wall, at: now });
    dropOldest(this.walls, WALLS_REMEMBERED);
  }

  forgetWall(id: string): void {
    this.walls.delete(id);
  }

  shown(now: number): ShownWall[] | undefined {
    return this.list && now - this.list.at < LIST_TTL_MS ? this.list.value : undefined;
  }

  staleShown(): ShownWall[] | undefined {
    return this.list?.value;
  }

  keepShown(list: ShownWall[], now: number): void {
    this.list = { value: list, at: now };
  }

  forgetShown(): void {
    this.list = undefined;
  }

  addView(id: string): void {
    const n = (this.views.get(id) ?? 0) + 1;
    // Delete first, so the entry moves to the end: the oldest ids go when the buffer is full.
    this.views.delete(id);
    this.views.set(id, n);
    dropOldest(this.views, VIEWS_BUFFERED);
  }

  /** Whether the first request after `FLUSH_EVERY_MS` has come, and there is something to write. */
  viewsDue(now: number): boolean {
    return this.views.size > 0 && now - this.flushedAt >= FLUSH_EVERY_MS;
  }

  takeViews(now: number): Array<[id: string, by: number]> {
    const out = [...this.views.entries()];
    this.views.clear();
    this.flushedAt = now;
    return out;
  }

  /** Views back into the buffer after a failed write: nothing is lost while the instance lives. */
  returnViews(views: ReadonlyArray<readonly [id: string, by: number]>): void {
    for (const [id, by] of views) this.views.set(id, (this.views.get(id) ?? 0) + by);
    dropOldest(this.views, VIEWS_BUFFERED);
  }

  /** Views counted on this instance and not yet written. */
  get pendingViews(): number {
    let n = 0;
    for (const by of this.views.values()) n += by;
    return n;
  }
}

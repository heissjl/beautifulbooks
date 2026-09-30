/**
 * The editing mode of a reader's collection (ROADMAP 5.13m; Julian,
 * 2026-09-29: „es sollte einen bearbeitungsmodus geben bei dem klar ist, bei
 * welcher collection man gerade was hinzufügt“). Pure and client-safe: the
 * editor's address, where a proposed cover stands against the open
 * collection, and requests cut to the size the change route takes.
 */
import type { PublicWall, Tile, WallOp } from './model';

/** Operations one `POST /api/walls/<id>` applies; the route drops the rest (app/api/walls/[id]/route.ts). */
export const OPS_PER_REQUEST = 50;

export type EditMode = 'add' | 'arrange';
export type AddTab = 'search' | 'photo' | 'ideas';

export interface EditState {
  mode?: EditMode;
  add?: AddTab;
  q?: string;
  work?: string;
}

/** `/c/<id>/edit` with what the editor shows; defaults stay out of the address. */
export function editHref(id: string, state: EditState = {}): string {
  const p = new URLSearchParams();
  if (state.mode === 'arrange') p.set('mode', 'arrange');
  if (state.add && state.add !== 'search') p.set('add', state.add);
  if (state.q) p.set('q', state.q);
  if (state.work) p.set('work', state.work);
  const qs = p.toString();
  return `/c/${id}/edit${qs ? `?${qs}` : ''}`;
}

const TABS: readonly AddTab[] = ['search', 'photo', 'ideas'];

/** The editor's state read back from the address; anything unknown falls to the default. */
export function readEditState(get: (key: string) => string | null): Required<Pick<EditState, 'mode' | 'add'>> & Pick<EditState, 'q' | 'work'> {
  const add = get('add');
  const work = get('work');
  const q = get('q')?.trim();
  return {
    mode: get('mode') === 'arrange' ? 'arrange' : 'add',
    add: TABS.includes(add as AddTab) ? (add as AddTab) : 'search',
    ...(q ? { q } : {}),
    ...(work && /^OL\d+W$/.test(work) ? { work } : {}),
  };
}

/**
 * Where a proposed cover stands against the open collection: this very cover
 * is in it, the book is in it with another cover, or it is new to it.
 */
export type Standing = 'in' | 'work' | 'new';

export function standingOf(tile: Tile, wall: Pick<PublicWall, 'tiles'> | undefined): Standing {
  if (!wall) return 'new';
  if (wall.tiles.some((t) => t.coverId === tile.coverId)) return 'in';
  if (wall.tiles.some((t) => t.workId === tile.workId)) return 'work';
  return 'new';
}

/** `add` operations for the tiles not in the collection yet, each cover once, cut into requests the route accepts whole. */
export function addRequests(tiles: readonly Tile[], wall?: Pick<PublicWall, 'tiles'>): WallOp[][] {
  const seen = new Set((wall?.tiles ?? []).map((t) => t.coverId));
  const ops: WallOp[] = [];
  for (const tile of tiles) {
    if (seen.has(tile.coverId)) continue;
    seen.add(tile.coverId);
    ops.push({ op: 'add', tile });
  }
  const out: WallOp[][] = [];
  for (let i = 0; i < ops.length; i += OPS_PER_REQUEST) out.push(ops.slice(i, i + OPS_PER_REQUEST));
  return out;
}

/** The title a new collection gets before its owner names it. */
export function defaultTitle(walls: readonly unknown[]): string {
  return walls.length ? `Collection ${walls.length + 1}` : 'My collection';
}

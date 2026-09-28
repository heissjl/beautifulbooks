/**
 * Where readers' walls live (ROADMAP 5.13a). Server only.
 *
 * The cover game's Redis (SPEC F7.3) through the same small command set, so
 * no new service: `wall:<id>` holds a wall as JSON, `walls:owner:<hash>` lists
 * the ids an owner made, `walls:all` lists every id once, for the aggregate
 * count the gate in PLAN-5.13 asks for. Under `next dev` without a store the
 * walls live in memory on `globalThis`, for the reason `lib/hotornot/store.ts`
 * gives: API routes and pages get separate copies of a module there.
 */
import { commandsFromEnv, type RedisCommands } from '@/lib/hotornot/store';
import type { Wall } from './model';

export interface WallStore {
  readonly kind: 'memory' | 'redis';
  get(id: string): Promise<Wall | null>;
  put(wall: Wall): Promise<void>;
  /** Records a new wall under its owner and in the list of all walls; call once, at creation. */
  register(wall: Wall): Promise<void>;
  idsOf(ownerHash: string): Promise<string[]>;
  count(): Promise<number>;
  /** Notes that a wall was offered for the showcase; the wall's own status decides what it is now (5.13d). */
  submitted(id: string): Promise<void>;
  submittedIds(): Promise<string[]>;
  /** One more view of a wall by someone not its owner. Nothing about the viewer. */
  view(id: string): Promise<void>;
  views(): Promise<Map<string, number>>;
}

/** The store did not answer — never to be shown as "no such wall" (SPEC N12). */
export class WallStoreUnavailableError extends Error {}

/** Walls of one owner, newest change first; ids whose wall is gone are skipped. */
export async function wallsOf(store: WallStore, ownerHash: string): Promise<Wall[]> {
  const ids = [...new Set(await store.idsOf(ownerHash))].slice(-200);
  const walls = await Promise.all(ids.map((id) => store.get(id)));
  return walls
    .filter((w): w is Wall => !!w && w.ownerHash === ownerHash)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function memoryWallStore(): WallStore {
  const walls = new Map<string, string>();
  const owners = new Map<string, string[]>();
  const all: string[] = [];
  const showcase: string[] = [];
  const counts = new Map<string, number>();
  return {
    kind: 'memory',
    async get(id) {
      const raw = walls.get(id);
      return raw ? (JSON.parse(raw) as Wall) : null;
    },
    async put(wall) {
      walls.set(wall.id, JSON.stringify(wall));
    },
    async register(wall) {
      owners.set(wall.ownerHash, [...(owners.get(wall.ownerHash) ?? []), wall.id]);
      all.push(wall.id);
    },
    async idsOf(ownerHash) {
      return [...(owners.get(ownerHash) ?? [])];
    },
    async count() {
      return all.length;
    },
    async submitted(id) {
      showcase.push(id);
    },
    async submittedIds() {
      return [...new Set(showcase)];
    },
    async view(id) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    },
    async views() {
      return new Map(counts);
    },
  };
}

const KEYS = {
  wall: (id: string) => `wall:${id}`,
  owner: (hash: string) => `walls:owner:${hash}`,
  all: 'walls:all',
  showcase: 'walls:showcase',
  views: 'walls:views',
};

function parseWall(raw: unknown): Wall | null {
  if (typeof raw !== 'string') return null;
  try {
    const w = JSON.parse(raw) as Wall;
    return w && typeof w.id === 'string' && Array.isArray(w.tiles) ? w : null;
  } catch {
    return null;
  }
}

/** A hash of counts as the transport delivers it: a plain object or a `Map` (RESP3). */
function countsFrom(result: unknown): Map<string, number> {
  const entries = result instanceof Map ? [...result.entries()] : result && typeof result === 'object' ? Object.entries(result) : [];
  return new Map(entries.map(([k, v]) => [String(k), Number(v) || 0]));
}

async function guarded<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (err) {
    throw new WallStoreUnavailableError(err instanceof Error ? err.message : String(err));
  }
}

export function commandsWallStore(commands: RedisCommands): WallStore {
  return {
    kind: 'redis',
    get: (id) => guarded(commands.get(KEYS.wall(id)).then(parseWall)),
    put: (wall) => guarded(commands.set(KEYS.wall(wall.id), JSON.stringify(wall)).then(() => undefined)),
    register: (wall) =>
      guarded(Promise.all([commands.rPush(KEYS.owner(wall.ownerHash), wall.id), commands.rPush(KEYS.all, wall.id)]).then(() => undefined)),
    idsOf: (hash) =>
      guarded(commands.lRange(KEYS.owner(hash), 0, -1).then((r) => (Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : []))),
    count: () => guarded(commands.lLen(KEYS.all).then((n) => (typeof n === 'number' ? n : Number(n) || 0))),
    submitted: (id) => guarded(commands.rPush(KEYS.showcase, id).then(() => undefined)),
    submittedIds: () =>
      guarded(commands.lRange(KEYS.showcase, 0, -1).then((r) => [...new Set(Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : [])])),
    view: (id) => guarded((commands.hIncrBy ? commands.hIncrBy(KEYS.views, id, 1) : Promise.resolve()).then(() => undefined)),
    views: () => guarded(commands.hGetAll(KEYS.views).then(countsFrom)),
  };
}

/**
 * The walls shown among readers' walls: approved ones, most viewed first
 * (5.13d). Reads every submitted id and the whole view hash — fine for
 * hundreds; a sorted set is the step when it is thousands.
 */
export async function showcased(store: WallStore): Promise<Array<{ wall: Wall; views: number }>> {
  const [ids, views] = await Promise.all([store.submittedIds(), store.views()]);
  const walls = await Promise.all(ids.map((id) => store.get(id)));
  return walls
    .filter((w): w is Wall => !!w && w.showcase === 'approved')
    .map((wall) => ({ wall, views: views.get(wall.id) ?? 0 }))
    .sort((a, b) => b.views - a.views || b.wall.updatedAt.localeCompare(a.wall.updatedAt));
}

/** Walls waiting for Julian's look, oldest first. */
export async function awaitingReview(store: WallStore): Promise<Wall[]> {
  const ids = await store.submittedIds();
  const walls = await Promise.all(ids.map((id) => store.get(id)));
  return walls.filter((w): w is Wall => !!w && w.showcase === 'submitted');
}

const shared = globalThis as typeof globalThis & { __wallsDevMemory?: WallStore };

export function wallStoreFromEnv(env: Record<string, string | undefined> = process.env): WallStore | null {
  const commands = commandsFromEnv(env);
  if (commands) return commandsWallStore(commands);
  if (env.NODE_ENV === 'production') return null;
  shared.__wallsDevMemory ??= memoryWallStore();
  return shared.__wallsDevMemory;
}

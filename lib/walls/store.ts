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
  };
}

const KEYS = {
  wall: (id: string) => `wall:${id}`,
  owner: (hash: string) => `walls:owner:${hash}`,
  all: 'walls:all',
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
  };
}

const shared = globalThis as typeof globalThis & { __wallsDevMemory?: WallStore };

export function wallStoreFromEnv(env: Record<string, string | undefined> = process.env): WallStore | null {
  const commands = commandsFromEnv(env);
  if (commands) return commandsWallStore(commands);
  if (env.NODE_ENV === 'production') return null;
  shared.__wallsDevMemory ??= memoryWallStore();
  return shared.__wallsDevMemory;
}

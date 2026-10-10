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
import { commandsFromEnv, type RedisCommands } from '../redis';
import { MAX_WALLS_PER_OWNER, toPublic, UNSAVED_HOURS, WALLS_CAP, type PublicWall, type Wall } from './model';
import { pageOf, readerOrder } from './order';

export interface WallStore {
  readonly kind: 'memory' | 'redis';
  get(id: string): Promise<Wall | null>;
  put(wall: Wall): Promise<void>;
  /** Records a new wall under its owner; call once, at creation. */
  register(wall: Wall): Promise<void>;
  /** Counts a wall among all walls, once, when it is saved (5.13j): unsaved tries are not collections. */
  counted(id: string): Promise<void>;
  idsOf(ownerHash: string): Promise<string[]>;
  count(): Promise<number>;
  /** Notes that a wall was shown among readers' walls; the wall's own status decides what it is now (5.13d). */
  submitted(id: string): Promise<void>;
  submittedIds(): Promise<string[]>;
  /** One more view of a wall by someone not its owner. Nothing about the viewer. */
  view(id: string): Promise<void>;
  views(): Promise<Map<string, number>>;
  /**
   * A browser pressed "Report" on a shown wall (ROADMAP 2.20). Counted once per
   * reporter: `by` is the hash of the reporter's visitor id, the same one-way
   * hash a wall's owner is stored as — kept only to tell a second press from a
   * new reporter, never shown. `fresh` is false when this browser had already
   * reported the wall; `count` is the number of distinct reporters after a fresh report.
   */
  report(id: string, by: string): Promise<{ fresh: boolean; count: number }>;
  reports(): Promise<Map<string, number>>;
  /** One more photo read on this day (UTC, `YYYY-MM-DD`); answers the day's count so far, for the daily cap (5.11a). Nothing about who. */
  countPhoto(day: string): Promise<number>;
  /** Adds what a read cost to the day's spend (thousandths of a cent, lib/walls/photobudget.ts) and answers the day's total; 0 only asks. */
  spendPhoto(day: string, units: number): Promise<number>;
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

/** This browser already has as many collections as one may (ROADMAP 2.20); expired tries do not count. */
export async function ownerAtCap(store: WallStore, ownerHash: string): Promise<boolean> {
  return (await wallsOf(store, ownerHash)).length >= MAX_WALLS_PER_OWNER;
}

/** The site holds as many saved collections as it will (ROADMAP 2.20). */
export async function siteAtCap(store: WallStore): Promise<boolean> {
  return (await store.count()) >= WALLS_CAP;
}

export function memoryWallStore(now: () => number = Date.now): WallStore {
  const walls = new Map<string, string>();
  const expires = new Map<string, number>();
  const owners = new Map<string, string[]>();
  const all: string[] = [];
  const showcase: string[] = [];
  const counts = new Map<string, number>();
  const flags = new Map<string, number>();
  const reporters = new Map<string, Set<string>>();
  const photos = new Map<string, number>();
  const spent = new Map<string, number>();
  return {
    kind: 'memory',
    async spendPhoto(day, units) {
      const n = (spent.get(day) ?? 0) + units;
      spent.set(day, n);
      return n;
    },
    async countPhoto(day) {
      const n = (photos.get(day) ?? 0) + 1;
      photos.set(day, n);
      return n;
    },
    async get(id) {
      const raw = walls.get(id);
      const until = expires.get(id);
      if (until !== undefined && now() > until) {
        walls.delete(id);
        expires.delete(id);
        return null;
      }
      return raw ? (JSON.parse(raw) as Wall) : null;
    },
    async put(wall) {
      walls.set(wall.id, JSON.stringify(wall));
      if (wall.unsaved) expires.set(wall.id, now() + UNSAVED_HOURS * 3_600_000);
      else expires.delete(wall.id);
    },
    async register(wall) {
      owners.set(wall.ownerHash, [...(owners.get(wall.ownerHash) ?? []), wall.id]);
    },
    async counted(id) {
      all.push(id);
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
    async report(id, by) {
      const seen = reporters.get(id) ?? new Set<string>();
      reporters.set(id, seen);
      if (seen.has(by)) return { fresh: false, count: flags.get(id) ?? 0 };
      seen.add(by);
      flags.set(id, (flags.get(id) ?? 0) + 1);
      return { fresh: true, count: flags.get(id) ?? 0 };
    },
    async reports() {
      return new Map(flags);
    },
  };
}

const KEYS = {
  wall: (id: string) => `wall:${id}`,
  owner: (hash: string) => `walls:owner:${hash}`,
  all: 'walls:all',
  photos: 'walls:photos',
  photoSpend: 'walls:photos:spend',
  showcase: 'walls:showcase',
  views: 'walls:views',
  reports: 'walls:reports',
  /** Hash per wall: reporter hash → 1. Lets one browser report a wall once (2.20). */
  reporters: (id: string) => `walls:reporters:${id}`,
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
    // An unsaved wall expires by itself; SET without EX, on saving, clears the expiry.
    put: (wall) =>
      guarded(
        (wall.unsaved && commands.setEx
          ? commands.setEx(KEYS.wall(wall.id), JSON.stringify(wall), UNSAVED_HOURS * 3600)
          : commands.set(KEYS.wall(wall.id), JSON.stringify(wall))
        ).then(() => undefined),
      ),
    register: (wall) => guarded(commands.rPush(KEYS.owner(wall.ownerHash), wall.id).then(() => undefined)),
    counted: (id) => guarded(commands.rPush(KEYS.all, id).then(() => undefined)),
    idsOf: (hash) =>
      guarded(commands.lRange(KEYS.owner(hash), 0, -1).then((r) => (Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : []))),
    count: () => guarded(commands.lLen(KEYS.all).then((n) => (typeof n === 'number' ? n : Number(n) || 0))),
    submitted: (id) => guarded(commands.rPush(KEYS.showcase, id).then(() => undefined)),
    submittedIds: () =>
      guarded(commands.lRange(KEYS.showcase, 0, -1).then((r) => [...new Set(Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : [])])),
    view: (id) => guarded((commands.hIncrBy ? commands.hIncrBy(KEYS.views, id, 1) : Promise.resolve()).then(() => undefined)),
    views: () => guarded(commands.hGetAll(KEYS.views).then(countsFrom)),
    report: (id, by) =>
      guarded(
        (async () => {
          const fresh = Number(await commands.hSetNX(KEYS.reporters(id), by, '1')) === 1;
          if (!fresh) return { fresh: false, count: 0 };
          const n = commands.hIncrBy ? await commands.hIncrBy(KEYS.reports, id, 1) : 0;
          return { fresh: true, count: Number(n) || 0 };
        })(),
      ),
    reports: () => guarded(commands.hGetAll(KEYS.reports).then(countsFrom)),
    // Without HINCRBY (a test double) the cap cannot count and does not bind.
    // Without HINCRBY the budget cannot count and does not bind, like the cap.
    spendPhoto: (day, units) => guarded((commands.hIncrBy ? commands.hIncrBy(KEYS.photoSpend, day, Math.round(units)) : Promise.resolve(0)).then((n) => Number(n) || 0)),
    countPhoto: (day) => guarded((commands.hIncrBy ? commands.hIncrBy(KEYS.photos, day, 1) : Promise.resolve(0)).then((n) => Number(n) || 0)),
  };
}

export interface ShownWall {
  wall: Wall;
  views: number;
  reports: number;
}

/**
 * Every wall its owner shows among readers' walls, with its views and
 * reports (5.13d). Reads every listed id and both count hashes — fine for
 * hundreds; a sorted set is the step when it is thousands.
 */
export async function listedWalls(store: WallStore): Promise<ShownWall[]> {
  const [ids, views, reports] = await Promise.all([store.submittedIds(), store.views(), store.reports()]);
  const walls = await Promise.all(ids.map((id) => store.get(id)));
  return walls
    .filter((w): w is Wall => !!w && !!w.showcase)
    .map((wall) => ({ wall, views: views.get(wall.id) ?? 0, reports: reports.get(wall.id) ?? 0 }));
}

/** The shown ones only, for the public page. */
export async function shownWalls(store: WallStore): Promise<ShownWall[]> {
  return (await listedWalls(store)).filter((s) => s.wall.showcase === 'shown');
}

/** One page of the public list in a visit's order (5.13d): shared by the page and its route. */
export async function readersPage(
  store: WallStore,
  seed: number,
  offset: number,
  now: number = Date.now(),
): Promise<{ walls: PublicWall[]; next: number | null; total: number }> {
  const shown = await shownWalls(store);
  const ordered = readerOrder(shown.map((s) => ({ ...s, id: s.wall.id, createdOn: s.wall.createdOn })), seed, now);
  const page = pageOf(ordered, offset);
  return { walls: page.items.map((s) => toPublic(s.wall)), next: page.next, total: ordered.length };
}

/** For Julian: shown and hidden walls, the most reported first. */
export async function moderationList(store: WallStore): Promise<ShownWall[]> {
  return (await listedWalls(store)).sort((a, b) => b.reports - a.reports || b.wall.updatedAt.localeCompare(a.wall.updatedAt));
}

const shared = globalThis as typeof globalThis & { __wallsDevMemory?: WallStore };

export function wallStoreFromEnv(env: Record<string, string | undefined> = process.env): WallStore | null {
  const commands = commandsFromEnv(env);
  if (commands) return commandsWallStore(commands);
  if (env.NODE_ENV === 'production') return null;
  // Hot reloading keeps the old instance on globalThis; one that lacks a method
  // this code has would answer "did not answer" for a store that is fine
  // (found twice on 2026-09-28). Dev only, and its walls are scratch anyway.
  const fresh = memoryWallStore();
  if (!shared.__wallsDevMemory || Object.keys(fresh).some((k) => !(k in (shared.__wallsDevMemory as object)))) shared.__wallsDevMemory = fresh;
  return shared.__wallsDevMemory;
}

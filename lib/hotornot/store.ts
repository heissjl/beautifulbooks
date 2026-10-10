/**
 * Where the votes of the cover game live (ROADMAP 5.8a). Server only.
 *
 * The first store the running site writes to — the thing E6 deferred and E18
 * kept deferred. Whether it stays is decision E21, and Julian's. Everything
 * sits behind one small interface, so the tests run against memory (N7) and
 * a deployment against Redis from the Vercel Marketplace, and the game never
 * knows which.
 *
 * **A vote is two covers, a winner and a day.** Nothing about the voter is
 * written, ever (N11): no IP, no cookie, no session, no user agent. The same
 * holds for a "not a cover" report and for the pair tokens, which name covers
 * and a time, not a person.
 */
import {
  commandsFromEnv, hashEntries, HINCRBY_MANY_SCRIPT, missingStoreMessage, redisCommands, STORE_LOOKED_FOR, STORE_PREFIX,
  STORE_TIMEOUT_MS, storeConfig, StoreUnavailableError, upstashCommands, type RedisCommands, type StoreConfig,
} from '../redis';

/*
  The generic half — the commands, the two transports, the variables — moved to
  lib/redis.ts on 2026-10-10 (ROADMAP 6.105): seven modules and four API guards
  had been importing infrastructure from a feature. Re-exported here so the
  game's own tests and older imports keep working; new code imports lib/redis.
*/
export {
  commandsFromEnv, HINCRBY_MANY_SCRIPT, missingStoreMessage, redisCommands, STORE_LOOKED_FOR, STORE_PREFIX,
  STORE_TIMEOUT_MS, storeConfig, StoreUnavailableError, upstashCommands, type RedisCommands, type StoreConfig,
};

export interface StoredVote {
  a: string;
  b: string;
  winner: string;
  /** YYYY-MM-DD. A day, not a timestamp: enough to tell sessions apart, too coarse to tell people apart. */
  on: string;
}

export interface CoverFlag {
  id: string;
  /** `reported`: a person pressed "not a cover". `broken`: the image did not load. */
  reason: 'reported' | 'broken';
}

export interface VoteStore {
  /** Which kind this is, so the page can say where its votes live. */
  readonly kind: 'memory' | 'upstash' | 'redis';
  votes(pool: string): Promise<StoredVote[]>;
  /** How many votes a pool holds — LLEN, a few bytes, however many there are. */
  count(pool: string): Promise<number>;
  /**
   * The votes from position `start` on: the tail a running tally has not seen.
   * `seen` counts the entries read, including any that did not parse, so a
   * damaged entry is stepped over once instead of fetched forever.
   */
  votesFrom(pool: string, start: number): Promise<{ votes: StoredVote[]; seen: number }>;
  /** The running tally kept beside the votes, as one string (`lib/hotornot/game.ts`); null when there is none. */
  tally(pool: string): Promise<string | null>;
  saveTally(pool: string, value: string): Promise<void>;
  add(pool: string, vote: StoredVote): Promise<void>;
  flags(pool: string): Promise<CoverFlag[]>;
  /** Keeps the first reason given for a cover; a second report changes nothing. */
  flag(pool: string, flag: CoverFlag): Promise<void>;
  /** True the first time a pair token is claimed and false after that: one vote per pair handed out. */
  claim(token: string, ttlSeconds: number): Promise<boolean>;
}

type Env = Record<string, string | undefined>;

const keyFor = {
  votes: (pool: string) => `versus:${pool}:votes`,
  flags: (pool: string) => `versus:${pool}:flags`,
  tally: (pool: string) => `versus:${pool}:tally`,
  token: (token: string) => `versus:token:${token}`,
};

/** Votes in this process's memory. Tests use it, and `next dev` without a configured store. */
export function memoryStore(now: () => number = Date.now): VoteStore {
  const votes = new Map<string, StoredVote[]>();
  const flags = new Map<string, Map<string, CoverFlag['reason']>>();
  const claimed = new Map<string, number>();
  const tallies = new Map<string, string>();
  return {
    kind: 'memory',
    async votes(pool) {
      return [...(votes.get(pool) ?? [])];
    },
    async count(pool) {
      return votes.get(pool)?.length ?? 0;
    },
    async votesFrom(pool, start) {
      const tail = (votes.get(pool) ?? []).slice(start);
      return { votes: tail, seen: tail.length };
    },
    async tally(pool) {
      return tallies.get(pool) ?? null;
    },
    async saveTally(pool, value) {
      tallies.set(pool, value);
    },
    async add(pool, vote) {
      votes.set(pool, [...(votes.get(pool) ?? []), vote]);
    },
    async flags(pool) {
      return [...(flags.get(pool) ?? new Map()).entries()].map(([id, reason]) => ({ id, reason }));
    },
    async flag(pool, flag) {
      const list = flags.get(pool) ?? new Map<string, CoverFlag['reason']>();
      if (!list.has(flag.id)) list.set(flag.id, flag.reason);
      flags.set(pool, list);
    },
    async claim(token, ttlSeconds) {
      const until = claimed.get(token);
      if (until !== undefined && until > now()) return false;
      claimed.set(token, now() + ttlSeconds * 1000);
      return true;
    },
  };
}

/** The game on top of any Redis: a list of votes per pool, a hash of flags, a short-lived key per claimed token. */
export function commandsStore(commands: RedisCommands, kind: 'upstash' | 'redis'): VoteStore {
  return {
    kind,
    async votes(pool) {
      const result = await commands.lRange(keyFor.votes(pool), 0, -1);
      if (!Array.isArray(result)) return [];
      return result.map(parseVote).filter((v): v is StoredVote => v !== null);
    },
    async count(pool) {
      const n = Number(await commands.lLen(keyFor.votes(pool)));
      return Number.isFinite(n) && n > 0 ? n : 0;
    },
    async votesFrom(pool, start) {
      const result = await commands.lRange(keyFor.votes(pool), start, -1);
      if (!Array.isArray(result)) return { votes: [], seen: 0 };
      return { votes: result.map(parseVote).filter((v): v is StoredVote => v !== null), seen: result.length };
    },
    async tally(pool) {
      const value = await commands.get(keyFor.tally(pool));
      return typeof value === 'string' ? value : null;
    },
    async saveTally(pool, value) {
      await commands.set(keyFor.tally(pool), value);
    },
    async add(pool, vote) {
      await commands.rPush(keyFor.votes(pool), JSON.stringify(vote));
    },
    async flags(pool) {
      return hashEntries(await commands.hGetAll(keyFor.flags(pool)))
        .map(([id, reason]): CoverFlag => ({ id, reason: String(reason) === 'broken' ? 'broken' : 'reported' }));
    },
    async flag(pool, flag) {
      await commands.hSetNX(keyFor.flags(pool), flag.id, flag.reason);
    },
    async claim(pairToken, ttlSeconds) {
      return String(await commands.setNx(keyFor.token(pairToken), '1', ttlSeconds)) === 'OK';
    },
  };
}

function parseVote(raw: unknown): StoredVote | null {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredVote>;
    if (typeof v.a !== 'string' || typeof v.b !== 'string' || typeof v.winner !== 'string') return null;
    return { a: v.a, b: v.b, winner: v.winner, on: typeof v.on === 'string' ? v.on : '' };
  } catch {
    return null;
  }
}

/**
 * Upstash Redis over its REST API: one POST per command, the command as a
 * JSON array, the token as a bearer header. Plain `fetch`, with the same
 * timeout and the same error as every other external call here (N3).
 */
export function upstashStore(url: string, token: string, fetchImpl: typeof fetch = fetch): VoteStore {
  return commandsStore(upstashCommands(url, token, fetchImpl), 'upstash');
}

/**
 * Redis over its own protocol, `redis://` or `rediss://` (TLS). What the
 * Marketplace store actually provided on 2026-09-11 was exactly one variable,
 * `STORAGE_REDIS_URL` — no REST address and no token — so this is the path
 * the preview takes. Connects on the first command, not on construction.
 */
export function redisStore(url: string): VoteStore {
  return commandsStore(redisCommands(url), 'redis');
}

/**
 * On `globalThis`, not in a module variable. `next dev` compiles the API
 * routes and the pages into separate bundles, each with its own copy of this
 * module, and a module-level store gave the game one memory and the standings
 * page another: found in the browser on 2026-09-11, when two votes counted in
 * the game and the board said nobody had voted.
 */
const shared = globalThis as typeof globalThis & { __versusDevMemory?: VoteStore };

/**
 * The store this deployment has: Redis when its variables are set (REST
 * first, a direct connection otherwise); memory under `next dev`, so the game
 * can be played on a laptop; and nothing at all in a production build without
 * the variables — the route says so instead of keeping votes in one server
 * instance's memory, where they would vanish with it and differ between
 * instances.
 */
export function storeFromEnv(env: Env = process.env): VoteStore | null {
  const config = storeConfig(env);
  if (config?.kind === 'rest') return upstashStore(config.url, config.token);
  if (config?.kind === 'redis') return redisStore(config.url);
  if (env.NODE_ENV === 'production') return null;
  shared.__versusDevMemory ??= memoryStore();
  return shared.__versusDevMemory;
}


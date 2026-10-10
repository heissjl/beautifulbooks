/**
 * The site's Redis, behind one small interface (ROADMAP 6.105, split out of
 * `lib/hotornot/store.ts` on 2026-10-10). Server only.
 *
 * Every feature that writes — the cover game's votes, readers' walls, friends'
 * drafts and suggestions, the short links of a shelf-portrait, the analytics,
 * the alerts, the live state of the collections — speaks these commands to
 * the same store from the Vercel Marketplace, through whichever transport its
 * variables name: the REST API (Upstash) or a direct `redis://` connection.
 * The commands' answers are checked, not trusted: a client library's types
 * and a JSON body are both claims about the wire.
 *
 * What is **not** here: what any feature does with the commands. The game's
 * `VoteStore` stays in `lib/hotornot/store.ts`, the walls' store in
 * `lib/walls/store.ts`, and so on — each with its own keys and its own dev
 * memory fallback.
 */
import { createClient } from 'redis';

type Env = Record<string, string | undefined>;

/**
 * The store did not answer. Like `SourceUnavailableError` for the catalogues:
 * a silent store is not an empty board, and the page must say which it is
 * (SPEC F1.7, N12).
 */
export class StoreUnavailableError extends Error {
  constructor(message: string) {
    super(`store did not answer: ${message}`);
    this.name = 'StoreUnavailableError';
  }
}

/** Per-request cap. The game waits on the store for every click, and a page render must not wait long either. */
export const STORE_TIMEOUT_MS = 4000;

/**
 * The five Redis commands the game needs, whoever speaks them — the REST API,
 * a direct connection, or a test. Their answers are checked, not trusted: a
 * client library's types and a JSON body are both claims about the wire.
 */
export interface RedisCommands {
  rPush(key: string, value: string): Promise<unknown>;
  lRange(key: string, start: number, stop: number): Promise<unknown>;
  lLen(key: string): Promise<unknown>;
  get(key: string): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  /** Field → value, as a plain object or a `Map`, however the transport delivers it. */
  hGetAll(key: string): Promise<unknown>;
  hSetNX(key: string, field: string, value: string): Promise<unknown>;
  /** SET key value NX EX ttl: "OK" when set, anything else when the key was already there. */
  setNx(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  /** HINCRBY: readers' walls count their views with it (5.13d). Optional, so test doubles of the game need not grow. */
  hIncrBy?(key: string, field: string, by: number): Promise<unknown>;
  /** SET key value EX ttl: an unsaved collection that disappears by itself (5.13j). Optional, like hIncrBy. */
  setEx?(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  /** EXPIRE key seconds: the daily totals of the analytics (3.1a) age out by themselves. Optional, like hIncrBy. */
  expire?(key: string, seconds: number): Promise<unknown>;
  /**
   * Many HINCRBYs on one hash and its EXPIRE as **one** command, a Lua script
   * (ROADMAP 2.18d): the CPU meter's flush was 14–35 commands every thirty
   * seconds per instance (measured 2.18b). Optional, like hIncrBy.
   */
  hIncrByMany?(key: string, increments: ReadonlyArray<readonly [field: string, by: number]>, ttlSeconds: number): Promise<unknown>;
  /**
   * SCAN cursor MATCH pattern COUNT n → [next cursor, keys]; "0" when done. Only for Julian's list of Shelf-Portrait
   * links (ROADMAP 5.18b, K17), never on a reader's request. Optional, like hIncrBy.
   */
  scan?(cursor: string, match: string, count: number): Promise<[string, string[]]>;
}

/** A SCAN answer as either transport delivers it: `[cursor, keys]` over REST, `{ cursor, keys }` from node-redis. */
export function scanReply(reply: unknown): [string, string[]] {
  const pair = Array.isArray(reply) ? reply : reply && typeof reply === 'object' ? [(reply as { cursor?: unknown }).cursor, (reply as { keys?: unknown }).keys] : [];
  const keys = Array.isArray(pair[1]) ? pair[1].filter((k): k is string => typeof k === 'string') : [];
  return [String(pair[0] ?? '0'), keys];
}

/** ARGV[1] is the expiry, then field and amount in turns. Returns how many fields it added to. */
export const HINCRBY_MANY_SCRIPT =
  "for i = 2, #ARGV, 2 do redis.call('HINCRBY', KEYS[1], ARGV[i], ARGV[i + 1]) end " +
  "redis.call('EXPIRE', KEYS[1], ARGV[1]) return (#ARGV - 1) / 2";

function hIncrByManyArgs(increments: ReadonlyArray<readonly [string, number]>, ttlSeconds: number): string[] {
  return [String(ttlSeconds), ...increments.flatMap(([field, by]) => [field, String(by)])];
}

/**
 * A hash as field → value pairs. RESP3, which node-redis 6 speaks by default,
 * can deliver a hash as a `Map`, and `Object.entries` of a `Map` is empty — the
 * reports would have vanished without a word.
 */
export function hashEntries(result: unknown): Array<[string, unknown]> {
  if (result instanceof Map) return [...result.entries()].map(([k, v]) => [String(k), v]);
  if (result && typeof result === 'object') return Object.entries(result as Record<string, unknown>);
  return [];
}

/**
 * The commands behind `upstashStore`, on their own so that a second store —
 * the suggestions of `lib/suggest/store.ts` — can speak to the same Redis
 * without a second client.
 */
export function upstashCommands(url: string, token: string, fetchImpl: typeof fetch = fetch): RedisCommands {
  async function command(args: Array<string | number>): Promise<unknown> {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch (err) {
      throw new StoreUnavailableError(err instanceof Error ? err.message : String(err));
    }
    if (!res.ok) throw new StoreUnavailableError(`HTTP ${res.status}`);
    let body: { result?: unknown; error?: unknown };
    try {
      body = (await res.json()) as { result?: unknown; error?: unknown };
    } catch {
      throw new StoreUnavailableError('an answer that was not JSON');
    }
    if (body.error !== undefined) throw new StoreUnavailableError(String(body.error));
    return body.result;
  }

  return {
    rPush: (key, value) => command(['RPUSH', key, value]),
    lRange: (key, start, stop) => command(['LRANGE', key, start, stop]),
    lLen: key => command(['LLEN', key]),
    get: key => command(['GET', key]),
    set: (key, value) => command(['SET', key, value]),
    hIncrBy: (key, field, by) => command(['HINCRBY', key, field, by]),
    setEx: (key, value, ttlSeconds) => command(['SET', key, value, 'EX', ttlSeconds]),
    expire: (key, seconds) => command(['EXPIRE', key, seconds]),
    // HGETALL answers a flat list over REST: field, value, field, value, …
    hGetAll: async key => {
      const flat = await command(['HGETALL', key]);
      const out: Record<string, unknown> = {};
      if (Array.isArray(flat)) {
        for (let i = 0; i + 1 < flat.length; i += 2) {
          const field = flat[i];
          if (typeof field === 'string') out[field] = flat[i + 1];
        }
      }
      return out;
    },
    hSetNX: (key, field, value) => command(['HSETNX', key, field, value]),
    setNx: (key, value, ttlSeconds) => command(['SET', key, value, 'NX', 'EX', ttlSeconds]),
    hIncrByMany: (key, increments, ttlSeconds) => command(['EVAL', HINCRBY_MANY_SCRIPT, 1, key, ...hIncrByManyArgs(increments, ttlSeconds)]),
    scan: async (cursor, match, count) => scanReply(await command(['SCAN', cursor, 'MATCH', match, 'COUNT', count])),
  };
}

/**
 * The client is built in exactly one place, and its type is taken from that
 * call: `ReturnType<typeof createClient>` names the library's generic
 * default, which node-redis 6 — RESP3 unless told otherwise — does not match.
 */
function newClient(url: string) {
  return createClient({ url, socket: { connectTimeout: STORE_TIMEOUT_MS, reconnectStrategy: false } });
}

type RedisClient = ReturnType<typeof newClient>;

/**
 * One connection per address and function instance, kept between requests,
 * on `globalThis` for the reason given at `shared` below. A connection that
 * errors is dropped, and the next request connects afresh: no reconnect loop
 * in the background of a serverless function.
 */
const connections = globalThis as typeof globalThis & { __versusRedis?: Map<string, Promise<RedisClient>> };

function clientFor(url: string): Promise<RedisClient> {
  const open = (connections.__versusRedis ??= new Map());
  const existing = open.get(url);
  if (existing) return existing;
  const client = newClient(url);
  // Without a listener a dropped connection would take the whole function down with it.
  client.on('error', () => open.delete(url));
  const ready = client.connect().then(() => client);
  open.set(url, ready);
  ready.catch(() => open.delete(url));
  return ready;
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${STORE_TIMEOUT_MS} ms`)), STORE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** The commands behind `redisStore`, shared the same way as `upstashCommands`. */
export function redisCommands(url: string): RedisCommands {
  const run = async (command: (client: RedisClient) => Promise<unknown>): Promise<unknown> => {
    try {
      return await withTimeout(clientFor(url).then(command));
    } catch (err) {
      connections.__versusRedis?.delete(url);
      throw new StoreUnavailableError(err instanceof Error ? err.message : String(err));
    }
  };
  return {
    rPush: (key, value) => run(client => client.rPush(key, value)),
    lRange: (key, start, stop) => run(client => client.lRange(key, start, stop)),
    lLen: key => run(client => client.lLen(key)),
    get: key => run(client => client.get(key)),
    set: (key, value) => run(client => client.set(key, value)),
    hGetAll: key => run(client => client.hGetAll(key)),
    hSetNX: (key, field, value) => run(client => client.hSetNX(key, field, value)),
    setNx: (key, value, ttlSeconds) => run(client => client.set(key, value, { NX: true, EX: ttlSeconds })),
    hIncrBy: (key, field, by) => run(client => client.hIncrBy(key, field, by)),
    setEx: (key, value, ttlSeconds) => run(client => client.set(key, value, { EX: ttlSeconds })),
    expire: (key, seconds) => run(client => client.expire(key, seconds)),
    hIncrByMany: (key, increments, ttlSeconds) =>
      run(client => client.eval(HINCRBY_MANY_SCRIPT, { keys: [key], arguments: hIncrByManyArgs(increments, ttlSeconds) })),
    scan: async (cursor, match, count) => scanReply(await run(client => client.scan(cursor, { MATCH: match, COUNT: count }))),
  };
}

/**
 * The prefix Julian gave the store's variables when connecting it (2026-09-11).
 * What comes after it depends on the integration — Upstash's REST pair
 * (`…KV_REST_API_URL`, `…REST_API_TOKEN`) or a plain Redis address
 * (`…REDIS_URL`) — so the end of the name and the scheme of the value are
 * matched rather than one full name assumed.
 */
export const STORE_PREFIX = 'STORAGE_';

/** What the store needs, and what to say when it is missing — names only, never a value. */
export const STORE_LOOKED_FOR =
  `${STORE_PREFIX}…REST_API_URL with ${STORE_PREFIX}…REST_API_TOKEN, or a ${STORE_PREFIX}…URL holding a redis:// address`;

export type StoreConfig = { kind: 'rest'; url: string; token: string } | { kind: 'redis'; url: string };

export function storeConfig(env: Env = process.env, prefix: string = STORE_PREFIX): StoreConfig | null {
  const names = Object.keys(env).filter(k => k.startsWith(prefix) && env[k]).sort();
  const url = names.find(k => /REST(_API)?_URL$/.test(k));
  // The read-only token is useless here: a vote is a write.
  const token = names.find(k => /REST(_API)?_TOKEN$/.test(k) && !k.includes('READ_ONLY'));
  if (url && token) return { kind: 'rest', url: env[url] ?? '', token: env[token] ?? '' };
  const tcp = names.find(k => k.endsWith('URL') && /^rediss?:\/\//.test(env[k] ?? ''));
  if (tcp) return { kind: 'redis', url: env[tcp] ?? '' };
  return null;
}

/**
 * Why there is no store, in words a person can act on — names only, never a
 * value. Outside production it also lists the variables that do start with
 * the prefix: the first preview answered "not configured" although Julian had
 * connected the store, and the only way to see why was to see what the
 * integration had actually named them (2026-09-11). Production keeps to what
 * was looked for; a configuration listing has no business on the site.
 */
export function missingStoreMessage(env: Env = process.env): string {
  const base = `The store is not configured here. Looked for ${STORE_LOOKED_FOR}.`;
  if (env.VERCEL_ENV === 'production') return base;
  const found = Object.keys(env).filter(k => k.startsWith(STORE_PREFIX)).sort();
  return found.length > 0
    ? `${base} Variables starting with ${STORE_PREFIX} on this deployment: ${found.join(', ')}.`
    : `${base} No variable on this deployment starts with ${STORE_PREFIX}.`;
}

/**
 * The Redis commands this deployment has, or null: the same choice as
 * `storeFromEnv` (REST first, then a direct connection), without the dev
 * memory fallback, which each store keeps for itself. `prefix` names another
 * store's variables: the short links of 5.18b live in a Redis of their own
 * (`LINKS_…`), found by the same matching.
 */
export function commandsFromEnv(env: Env = process.env, prefix: string = STORE_PREFIX): RedisCommands | null {
  const config = storeConfig(env, prefix);
  if (config?.kind === 'rest') return upstashCommands(config.url, config.token);
  if (config?.kind === 'redis') return redisCommands(config.url);
  return null;
}

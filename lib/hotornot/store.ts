/**
 * Where the votes of the cover game live (ROADMAP 5.8a). Server only.
 *
 * The first store the running site writes to — the thing E6 deferred and E18
 * kept deferred. Whether it stays is decision E21, and Julian's. Everything
 * sits behind one small interface, so the tests run against memory (N7) and
 * a deployment against Upstash Redis from the Vercel Marketplace, and the
 * game never knows which.
 *
 * **A vote is two covers, a winner and a day.** Nothing about the voter is
 * written, ever (N11): no IP, no cookie, no session, no user agent. The same
 * holds for a "not a cover" report and for the pair tokens, which name covers
 * and a time, not a person.
 */

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
  readonly kind: 'memory' | 'upstash';
  votes(pool: string): Promise<StoredVote[]>;
  add(pool: string, vote: StoredVote): Promise<void>;
  flags(pool: string): Promise<CoverFlag[]>;
  /** Keeps the first reason given for a cover; a second report changes nothing. */
  flag(pool: string, flag: CoverFlag): Promise<void>;
  /** True the first time a pair token is claimed and false after that: one vote per pair handed out. */
  claim(token: string, ttlSeconds: number): Promise<boolean>;
}

/**
 * The store did not answer. Like `SourceUnavailableError` for the catalogues:
 * a silent store is not an empty board, and the page must say which it is
 * (SPEC F1.7, N12).
 */
export class StoreUnavailableError extends Error {
  constructor(message: string) {
    super(`vote store did not answer: ${message}`);
    this.name = 'StoreUnavailableError';
  }
}

/** Per-request cap. The game waits on the store for every click, so it must not wait long. */
export const STORE_TIMEOUT_MS = 4000;

const keyFor = {
  votes: (pool: string) => `versus:${pool}:votes`,
  flags: (pool: string) => `versus:${pool}:flags`,
  token: (token: string) => `versus:token:${token}`,
};

/** Votes in this process's memory. Tests use it, and `next dev` without a configured store. */
export function memoryStore(now: () => number = Date.now): VoteStore {
  const votes = new Map<string, StoredVote[]>();
  const flags = new Map<string, Map<string, CoverFlag['reason']>>();
  const claimed = new Map<string, number>();
  return {
    kind: 'memory',
    async votes(pool) {
      return [...(votes.get(pool) ?? [])];
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

/**
 * Upstash Redis over its REST API: one POST per command, the command as a
 * JSON array, the token as a bearer header. Plain `fetch` rather than the
 * SDK — five commands do not justify a dependency, and every external call
 * here gets the same timeout and the same error as the others (N3).
 */
export function upstashStore(url: string, token: string, fetchImpl: typeof fetch = fetch): VoteStore {
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
    kind: 'upstash',
    async votes(pool) {
      const result = await command(['LRANGE', keyFor.votes(pool), 0, -1]);
      if (!Array.isArray(result)) return [];
      const out: StoredVote[] = [];
      for (const raw of result) {
        const vote = parseVote(raw);
        if (vote) out.push(vote);
      }
      return out;
    },
    async add(pool, vote) {
      await command(['RPUSH', keyFor.votes(pool), JSON.stringify(vote)]);
    },
    async flags(pool) {
      // HGETALL answers a flat list over REST: field, value, field, value, …
      const result = await command(['HGETALL', keyFor.flags(pool)]);
      if (!Array.isArray(result)) return [];
      const out: CoverFlag[] = [];
      for (let i = 0; i + 1 < result.length; i += 2) {
        const id = result[i];
        const reason = result[i + 1];
        if (typeof id === 'string') out.push({ id, reason: reason === 'broken' ? 'broken' : 'reported' });
      }
      return out;
    },
    async flag(pool, flag) {
      await command(['HSETNX', keyFor.flags(pool), flag.id, flag.reason]);
    },
    async claim(pairToken, ttlSeconds) {
      const result = await command(['SET', keyFor.token(pairToken), 1, 'NX', 'EX', ttlSeconds]);
      return result === 'OK';
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
 * The prefix Julian gave the store's variables when connecting it (2026-09-11).
 * What Upstash puts after it has differed between versions of the integration
 * (`KV_REST_API_URL`, `REST_API_URL`, `UPSTASH_REDIS_REST_URL`), so the end
 * of the name is matched rather than one full name assumed.
 */
export const STORE_PREFIX = 'STORAGE_';

/** What the store needs, and what to say when it is missing — names only, never a value. */
export const STORE_LOOKED_FOR = [`${STORE_PREFIX}…REST_API_URL`, `${STORE_PREFIX}…REST_API_TOKEN`];

type Env = Record<string, string | undefined>;

export function storeConfig(env: Env = process.env): { url: string; token: string } | null {
  const names = Object.keys(env).filter(k => k.startsWith(STORE_PREFIX) && env[k]).sort();
  const url = names.find(k => /REST(_API)?_URL$/.test(k));
  // The read-only token is useless here: a vote is a write.
  const token = names.find(k => /REST(_API)?_TOKEN$/.test(k) && !k.includes('READ_ONLY'));
  if (!url || !token) return null;
  return { url: env[url] ?? '', token: env[token] ?? '' };
}

/**
 * Why there is no store, in words a person can act on — names only, never a
 * value. Outside production it also lists the variables that do start with
 * the prefix: the first preview answered "not configured" although Julian had
 * connected the store, and the only way to see why was to see what the
 * integration had actually named them (2026-09-11). Production keeps it to
 * what was looked for; a configuration listing has no business on the site.
 */
export function missingStoreMessage(env: Env = process.env): string {
  const base = `The vote store is not configured here. Looked for ${STORE_LOOKED_FOR.join(' and ')}.`;
  if (env.VERCEL_ENV === 'production') return base;
  const found = Object.keys(env).filter(k => k.startsWith(STORE_PREFIX)).sort();
  return found.length > 0
    ? `${base} Variables starting with ${STORE_PREFIX} on this deployment: ${found.join(', ')}.`
    : `${base} No variable on this deployment starts with ${STORE_PREFIX}.`;
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
 * The store this deployment has: Upstash when its variables are set; memory
 * under `next dev`, so the game can be played on a laptop; and nothing at all
 * in a production build without the variables — the route says so instead
 * of keeping votes in one server instance's memory, where they would vanish
 * with it and differ between instances.
 */
export function storeFromEnv(env: Env = process.env): VoteStore | null {
  const config = storeConfig(env);
  if (config) return upstashStore(config.url, config.token);
  if (env.NODE_ENV === 'production') return null;
  shared.__versusDevMemory ??= memoryStore();
  return shared.__versusDevMemory;
}

/**
 * The analytics' server half (ROADMAP 3.1a): adds to and reads the daily
 * totals in the game's Redis (F7.3). Server only.
 *
 * Counting never throws and never waits on the reader: the routes call it
 * after the response is on its way, and a silent store costs a number, not a
 * redirect. **Only production counts** — previews and `next dev` share the
 * same Redis or none, and a test click from a preview would be a reader in
 * the totals (plan §4).
 */
import { commandsFromEnv, type RedisCommands } from '../redis';
import { bookField, landingField, searchField, workField, type Signal } from './signals';
import {
  clickField,
  EMPTY_RETENTION_SECONDS,
  dayOf,
  insightsKey,
  RETENTION_SECONDS,
  type ClickCount,
  type DayHash,
  type InsightsHash,
  type Op,
} from './model';

type Env = Record<string, string | undefined>;

/** Whether this deployment adds to the totals at all. */
export function countingEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV === 'production';
}

export type CountResult = 'counted' | 'off' | 'no-store' | 'invalid' | 'failed';

async function add(commands: RedisCommands, hash: InsightsHash, field: string, now: Date, by = 1): Promise<CountResult> {
  if (!commands.hIncrBy) return 'no-store';
  const key = insightsKey(dayOf(now), hash);
  try {
    await commands.hIncrBy(key, field, by);
    // Every write renews the day's expiry; the last write of a day sets it for good.
    await commands.expire?.(key, hash === 'empty' ? EMPTY_RETENTION_SECONDS : RETENTION_SECONDS);
    return 'counted';
  } catch {
    return 'failed';
  }
}

export interface CountOptions {
  env?: Env;
  commands?: RedisCommands | null;
  now?: Date;
}

function setup(options: CountOptions): RedisCommands | null | 'off' {
  if (!countingEnabled(options.env)) return 'off';
  return options.commands === undefined ? commandsFromEnv(options.env) : options.commands;
}

/** +1 for a click through `/go/`. */
export async function countClick(click: ClickCount, options: CountOptions = {}): Promise<CountResult> {
  const field = clickField(click);
  if (!field) return 'invalid';
  const commands = setup(options);
  if (commands === 'off') return 'off';
  if (!commands) return 'no-store';
  return add(commands, 'clicks', field, options.now ?? new Date());
}

/** +1 for an event of the operation (K11). */
export async function countOp(op: Op, options: CountOptions = {}): Promise<CountResult> {
  const commands = setup(options);
  if (commands === 'off') return 'off';
  if (!commands) return 'no-store';
  return add(commands, 'ops', op, options.now ?? new Date());
}

/**
 * What the CPU meter of this instance gathered since its last flush (ROADMAP
 * 2.18l, K14): one increment per field, one expiry for the day. Called every
 * thirty seconds at most (`app/api/measure.ts`), not per request.
 *
 * As one command where the store can (2.18d): measured 2026-10-05, a flush
 * was 14–35 HINCRBYs, one per route × caller × measure. A store without the
 * script (a test double, the dev memory) still gets them one by one.
 */
export async function countCpu(increments: ReadonlyArray<[field: string, by: number]>, options: CountOptions = {}): Promise<CountResult> {
  if (increments.length === 0) return 'counted';
  const commands = setup(options);
  if (commands === 'off') return 'off';
  if (!commands) return 'no-store';
  const key = insightsKey(dayOf(options.now ?? new Date()), 'cpu');
  if (commands.hIncrByMany) {
    try {
      await commands.hIncrByMany(key, increments, RETENTION_SECONDS);
      return 'counted';
    } catch {
      return 'failed';
    }
  }
  const hIncrBy = commands.hIncrBy;
  if (!hIncrBy) return 'no-store';
  try {
    await Promise.all(increments.map(([field, by]) => hIncrBy(key, field, by)));
    await commands.expire?.(key, RETENTION_SECONDS);
    return 'counted';
  } catch {
    return 'failed';
  }
}

/** RESP3 may hand a hash back as a `Map` (see `hashEntries` in the game's store). */
function asHash(result: unknown): DayHash {
  if (result instanceof Map) return Object.fromEntries([...result.entries()].map(([k, v]) => [String(k), v]));
  if (result && typeof result === 'object') return result as DayHash;
  return {};
}

export type ReadResult =
  | { ok: true; hashes: DayHash[] }
  | { ok: false; reason: 'no-store' | 'failed' };

/**
 * The hashes of the given days, in order. A store that fails is reported as
 * failed — never as a day with no clicks (N12: a silent source is not an
 * empty result).
 */
export async function readDays(days: string[], hash: InsightsHash, commands: RedisCommands | null = commandsFromEnv()): Promise<ReadResult> {
  if (!commands) return { ok: false, reason: 'no-store' };
  try {
    const hashes = await Promise.all(days.map(day => commands.hGetAll(insightsKey(day, hash)).then(asHash)));
    return { ok: true, hashes };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/**
 * One visit's signal into the day's totals (ROADMAP 3.1b): a book visit adds
 * to `book` and `works`, a search to `search` and, when it found nothing, to
 * `empty` with its words, a landing page (5.6a) to `landing`.
 */
export async function countSignal(signal: Signal, options: CountOptions = {}): Promise<CountResult> {
  const commands = setup(options);
  if (commands === 'off') return 'off';
  if (!commands) return 'no-store';
  const now = options.now ?? new Date();
  const writes: Array<[InsightsHash, string]> =
    signal.t === 'book'
      ? [['book', bookField(signal)], ['works', workField(signal)]]
      : signal.t === 'landing'
        ? [['landing', landingField(signal)]]
        : [['search', searchField(signal)], ...(signal.q ? [['empty', signal.q] as [InsightsHash, string]] : [])];
  const results = await Promise.all(writes.map(([hash, field]) => add(commands, hash, field, now)));
  return results.find(r => r !== 'counted') ?? 'counted';
}

/**
 * One photo of a shelf read by the image model (ROADMAP 3.1, K13; the photo
 * route of 5.13a). `capped` is a photo turned away by the day's limit before
 * the model was asked, `failed` one the model did not answer, `read` one it
 * did — with its tokens per model, which is what it costs. Julian's own
 * photos count too: they cost the same.
 */
export type PhotoCount =
  | { outcome: 'capped' }
  | { outcome: 'failed' }
  | { outcome: 'read'; model: string; inputTokens: number; outputTokens: number; books: number; found: number; maybe: number };

const MODEL_ID = /^[a-z0-9][a-z0-9.-]{0,47}$/;

export async function countPhoto(photo: PhotoCount, options: CountOptions = {}): Promise<CountResult> {
  const commands = setup(options);
  if (commands === 'off') return 'off';
  if (!commands) return 'no-store';
  const now = options.now ?? new Date();
  const writes: Array<[string, number]> = [[photo.outcome, 1]];
  if (photo.outcome === 'read') {
    if (!MODEL_ID.test(photo.model)) return 'invalid';
    const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
    writes.push(
      [`in|${photo.model}`, whole(photo.inputTokens)],
      [`out|${photo.model}`, whole(photo.outputTokens)],
      ['books', whole(photo.books)],
      ['found', whole(photo.found)],
      ['maybe', whole(photo.maybe)],
    );
  }
  const results = await Promise.all(writes.filter(([, n]) => n > 0).map(([field, n]) => add(commands, 'photos', field, now, n)));
  return results.find(r => r !== 'counted') ?? 'counted';
}


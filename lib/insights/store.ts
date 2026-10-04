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
import { commandsFromEnv, type RedisCommands } from '../hotornot/store';
import { bookField, searchField, workField, type Signal } from './signals';
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

async function add(commands: RedisCommands, hash: InsightsHash, field: string, now: Date): Promise<CountResult> {
  if (!commands.hIncrBy) return 'no-store';
  const key = insightsKey(dayOf(now), hash);
  try {
    await commands.hIncrBy(key, field, 1);
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
 * `empty` with its words.
 */
export async function countSignal(signal: Signal, options: CountOptions = {}): Promise<CountResult> {
  const commands = setup(options);
  if (commands === 'off') return 'off';
  if (!commands) return 'no-store';
  const now = options.now ?? new Date();
  const writes: Array<[InsightsHash, string]> =
    signal.t === 'book'
      ? [['book', bookField(signal)], ['works', workField(signal)]]
      : [['search', searchField(signal)], ...(signal.q ? [['empty', signal.q] as [InsightsHash, string]] : [])];
  const results = await Promise.all(writes.map(([hash, field]) => add(commands, hash, field, now)));
  return results.find(r => r !== 'counted') ?? 'counted';
}


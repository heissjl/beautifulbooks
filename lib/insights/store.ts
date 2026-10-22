/**
 * The analytics' server half (ROADMAP 3.1a): adds to and reads the daily
 * totals in the game's Redis (F7.3). Server only.
 *
 * Counting never throws and never waits on the reader: the routes call it
 * after the response is on its way, and a silent store costs a number, not a
 * redirect. **Only production counts** — previews and `next dev` share the
 * same Redis or none, and a test click from a preview would be a reader in
 * the totals (plan §4) — and only while `INSIGHTS` is not `off` (2.18d, the
 * switch for a day the store must be spared).
 *
 * The two hot counters, the page signal (`/api/seen`) and the click through
 * `/go/`, no longer write per event: `queueSignal` and `queueClick` add to a
 * buffer per instance (`./buffer.ts`), and `flushInsights` writes the sums at
 * most every ten seconds as one command per day-hash (ROADMAP 2.18d). The
 * direct counters stay for the rare events (an operation's stumble, a photo).
 */
import { commandsFromEnv, type RedisCommands } from '../redis';
import { InsightsBuffer, type PendingHash } from './buffer';
import { bookField, landingField, searchField, workField, type Signal } from './signals';
import type { GuardRoute, Rejection } from './human';
import {
  clickField,
  EMPTY_RETENTION_SECONDS,
  dayOf,
  guardField,
  insightsKey,
  RETENTION_SECONDS,
  type ClickCount,
  type DayHash,
  type InsightsHash,
  type Op,
} from './model';

type Env = Record<string, string | undefined>;

/** `INSIGHTS=off`: nothing is counted or written, whatever else is set (ROADMAP 2.18d, 2.18f). The view says so. */
export function insightsOff(env: Env = process.env): boolean {
  return (env.INSIGHTS ?? '').trim().toLowerCase() === 'off';
}

/** Whether this deployment adds to the totals at all. */
export function countingEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV === 'production' && !insightsOff(env);
}

function retentionOf(hash: InsightsHash): number {
  return hash === 'empty' ? EMPTY_RETENTION_SECONDS : RETENTION_SECONDS;
}

export type CountResult = 'counted' | 'off' | 'no-store' | 'invalid' | 'failed';

async function add(commands: RedisCommands, hash: InsightsHash, field: string, now: Date, by = 1): Promise<CountResult> {
  if (!commands.hIncrBy) return 'no-store';
  const key = insightsKey(dayOf(now), hash);
  try {
    await commands.hIncrBy(key, field, by);
    // Every write renews the day's expiry; the last write of a day sets it for good.
    await commands.expire?.(key, retentionOf(hash));
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

/**
 * +1 for a request the guard turned away (ROADMAP 3.1i): which route and
 * why, as one number per day. Nothing else about the request is kept.
 */
export async function countRejected(route: GuardRoute, reason: Rejection, options: CountOptions = {}): Promise<CountResult> {
  const commands = setup(options);
  if (commands === 'off') return 'off';
  if (!commands) return 'no-store';
  return add(commands, 'guard', guardField(route, reason), options.now ?? new Date());
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
  const results = await Promise.all(signalWrites(signal).map(([hash, field]) => add(commands, hash, field, now)));
  return results.find(r => r !== 'counted') ?? 'counted';
}

/** The fields a signal adds one to, one per hash — the same for the direct counter and the buffer. */
function signalWrites(signal: Signal): Array<[InsightsHash, string]> {
  return signal.t === 'book'
    ? [['book', bookField(signal)], ['works', workField(signal)]]
    : signal.t === 'landing'
      ? [['landing', landingField(signal)]]
      : [['search', searchField(signal)], ...(signal.q ? [['empty', signal.q] as [InsightsHash, string]] : [])];
}

const sharedBuffer = globalThis as typeof globalThis & { __bbInsightsBuffer?: InsightsBuffer };

/** This instance's buffer of sums not yet written (2.18d), on `globalThis` like the stores: `next dev` splits modules. */
export function insightsBuffer(): InsightsBuffer {
  if (!(sharedBuffer.__bbInsightsBuffer instanceof InsightsBuffer)) sharedBuffer.__bbInsightsBuffer = new InsightsBuffer();
  return sharedBuffer.__bbInsightsBuffer;
}

export interface QueueOptions {
  env?: Env;
  buffer?: InsightsBuffer;
  now?: Date;
}

export type QueueResult = 'queued' | 'off' | 'invalid';

/** One visit's signal into the buffer — written with the next flush, not now (2.18d). */
export function queueSignal(signal: Signal, options: QueueOptions = {}): QueueResult {
  if (!countingEnabled(options.env)) return 'off';
  const buffer = options.buffer ?? insightsBuffer();
  const day = dayOf(options.now ?? new Date());
  for (const [hash, field] of signalWrites(signal)) buffer.add(insightsKey(day, hash), field, 1, retentionOf(hash));
  return 'queued';
}

/** One click through `/go/` into the buffer — written with the next flush, not now (2.18d). */
export function queueClick(click: ClickCount, options: QueueOptions = {}): QueueResult {
  const field = clickField(click);
  if (!field) return 'invalid';
  if (!countingEnabled(options.env)) return 'off';
  (options.buffer ?? insightsBuffer()).add(insightsKey(dayOf(options.now ?? new Date()), 'clicks'), field, 1, RETENTION_SECONDS);
  return 'queued';
}

/** One day-hash of sums as one command where the store has the script, else one HINCRBY per field and one EXPIRE. */
async function writeHash(commands: RedisCommands, pending: PendingHash): Promise<void> {
  if (commands.hIncrByMany) {
    await commands.hIncrByMany(pending.key, pending.increments, pending.retention);
    return;
  }
  const hIncrBy = commands.hIncrBy;
  if (!hIncrBy) return;
  await Promise.all(pending.increments.map(([field, by]) => hIncrBy(pending.key, field, by)));
  await commands.expire?.(pending.key, pending.retention);
}

export type FlushResult = 'written' | 'nothing' | 'not-due' | 'off' | 'no-store' | 'failed';

/**
 * Writes what the buffer holds once the first call after `FLUSH_EVERY_MS`
 * has come: one command per day-hash. Called after a response has left
 * (`later`), never on the reader's time. A hash whose write fails goes back
 * into the buffer for the next flush — nothing is counted twice, nothing is
 * lost while the instance lives.
 */
export async function flushInsights(options: CountOptions & { buffer?: InsightsBuffer; force?: boolean } = {}): Promise<FlushResult> {
  const buffer = options.buffer ?? insightsBuffer();
  const nowMs = (options.now ?? new Date()).getTime();
  if (!options.force && !buffer.due(nowMs)) return 'not-due';
  const commands = setup(options);
  if (commands === 'off') return 'off';
  if (!commands) return 'no-store';
  const pending = buffer.take(nowMs);
  if (pending.length === 0) return 'nothing';
  const failed: PendingHash[] = [];
  for (const p of pending) {
    try {
      await writeHash(commands, p);
    } catch {
      failed.push(p);
    }
  }
  if (failed.length > 0) {
    buffer.putBack(failed);
    return 'failed';
  }
  return 'written';
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
  /** Turned away because the store was silent and the day's budget could not be checked (ROADMAP 2.18h, J3). */
  | { outcome: 'store' }
  /** Turned away because this instance was already reading its share of photos (2.18h, `lib/walls/photogate.ts`). */
  | { outcome: 'busy' }
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


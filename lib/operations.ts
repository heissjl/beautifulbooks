/**
 * The operations block (ROADMAP 2.18g): what the store holds, what Google is
 * doing, whether the morning mail went, what this instance keeps in memory —
 * read for `/api/health`, the morning mail and `/admin/insights`. Server
 * only; the words and the lines are in `lib/fill.ts`.
 *
 * Redis's `INFO memory` is not there in every transport (the REST API has no
 * INFO), so the fill level is read the plain way: `DBSIZE` for the keys,
 * `LLEN` for the lists that grow with use, `STRLEN` for the one value that
 * grows with the collections. Seven small commands, on a request Julian or
 * the monitor makes — never on a reader's.
 */
import poolFile from '@/data/versus-pool.json';
import { CONTENT_KEY, liveMemory } from './collections-live';
import { DRAFTS_LIST_KEY } from './curate/drafts';
import { fillWarnings, HEARTBEAT_LAST_KEY, parseHeartbeatRecord, type FillFacts, type FillWarning, type HeartbeatRecord } from './fill';
import { fieldSearchKnownBroken } from './googlefields';
import { googlePausedFor } from './googlequota';
import { votesKey } from './hotornot/store';
import { insightsBuffer } from './insights/store';
import { commandsFromEnv, type RedisCommands } from './redis';
import { storePause } from './storepause';
import { SUGGESTIONS_LIST_KEY } from './suggest/store';
import { wallMemory, WALLS_ALL_KEY } from './walls/store';

/** Every vote log that counts for the game: the pools it grew from, then its own (`logsOf` in lib/hotornot/game.ts). */
export const VOTE_LOGS: readonly string[] = [...((poolFile as { inherits?: string[] }).inherits ?? []), (poolFile as { name: string }).name];

function whole(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

async function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('late')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the fill level. A command the transport lacks, or one that fails or is late, answers null — never 0 (N12). */
export async function readFill(commands: RedisCommands, timeoutMs = 2000): Promise<FillFacts> {
  const ask = async (work: (() => Promise<unknown>) | null): Promise<number | null> => {
    if (!work) return null;
    try {
      return whole(await within(work(), timeoutMs));
    } catch {
      return null;
    }
  };
  const dbSize = commands.dbSize;
  const strLen = commands.strLen;
  const [keys, walls, drafts, suggestions, contentBytes, ...logs] = await Promise.all([
    ask(dbSize ? () => dbSize() : null),
    ask(() => commands.lLen(WALLS_ALL_KEY)),
    ask(() => commands.lLen(DRAFTS_LIST_KEY)),
    ask(() => commands.lLen(SUGGESTIONS_LIST_KEY)),
    ask(strLen ? () => strLen(CONTENT_KEY) : null),
    ...VOTE_LOGS.map(name => ask(() => commands.lLen(votesKey(name)))),
  ]);
  const votes = logs.every(n => n === null) ? null : logs.reduce<number>((sum, n) => sum + (n ?? 0), 0);
  return { keys, walls, drafts, suggestions, contentBytes, votes };
}

export interface OperationsFacts {
  /** Whether a store is configured here at all. */
  configured: boolean;
  /** null without a store. */
  fill: FillFacts | null;
  warnings: FillWarning[];
  /** The last morning mail as the heartbeat route noted it; null when none was noted yet, `unreadable` when the store was silent. */
  heartbeat: HeartbeatRecord | null | 'unreadable';
  googlePausedS: number;
  googleFieldsBroken: boolean;
  /** The pause of this instance's page reads (`lib/storepause.ts`). */
  pause: { active: boolean; remainingS: number; trips: number };
  /** What this one instance holds — the view sees only the instance that rendered it. */
  instance: {
    insightsPending: number;
    viewsPending: number;
    wallHits: number;
    wallMisses: number;
    /** Seconds since the live collections were read, or null when never. */
    liveHeldAgeS: number | null;
  };
}

export async function gatherOperations(commands: RedisCommands | null = commandsFromEnv(), now: number = Date.now()): Promise<OperationsFacts> {
  const fill = commands ? await readFill(commands) : null;
  let heartbeat: HeartbeatRecord | null | 'unreadable' = null;
  if (commands) {
    try {
      heartbeat = parseHeartbeatRecord(await within(commands.get(HEARTBEAT_LAST_KEY), 2000));
    } catch {
      heartbeat = 'unreadable';
    }
  }
  const pause = storePause();
  const walls = wallMemory();
  const held = liveMemory().held;
  return {
    configured: commands !== null,
    fill,
    warnings: fill ? fillWarnings(fill) : [],
    heartbeat,
    googlePausedS: googlePausedFor(now),
    googleFieldsBroken: fieldSearchKnownBroken(),
    pause: { active: pause.active(now), remainingS: Math.ceil(pause.remaining(now) / 1000), trips: pause.trips },
    instance: {
      insightsPending: insightsBuffer().pending,
      viewsPending: walls.pendingViews,
      wallHits: walls.hits,
      wallMisses: walls.misses,
      liveHeldAgeS: held ? Math.round((now - held.at) / 1000) : null,
    },
  };
}

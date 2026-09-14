/**
 * The cover game on the site (ROADMAP 5.8a). Server only.
 *
 * The same arithmetic as the lab (`rating.ts`, validated by
 * `lab/hotornot/sim.ts`), the same claim rule (`crowns`, `CROWN_HOLD`), and a
 * frozen pool (`data/versus-pool.json`). What is new is the store and the
 * signed pairs. Each function takes the store and the pool as arguments, so
 * the tests play whole games against memory.
 *
 * **A pair costs the same whatever the number of votes** (2026-09-14). Until
 * then every request for a pair read every vote ever cast and replayed them —
 * 403 records a click on the preview, and growing with each vote, so it would
 * have failed exactly when the game worked. The pairing now keeps a running
 * tally (`pairingTally`); only the board still reads every vote, because its
 * uncertainty needs them all, and it does so once a minute (`cachedBoard`).
 */
import poolFile from '@/data/versus-pool.json';
import { coverPathSegment } from '../coverurl';
import { rng } from '../loading';
import type { PoolCover } from './pool';
import {
  CROWN_HOLD, applyVote, crowns, favouriteRate, newElo, nextPair, verdictFor,
  type Crown, type EloState, type Standing,
} from './rating';
import { storeConfig, type CoverFlag, type StoredVote, type VoteStore } from './store';
import { PAIR_TTL_SECONDS, pairSecret, signPair, verifyPair } from './token';

export interface VersusPool {
  name: string;
  builtAt: string;
  indexBuiltAt: string;
  /** Covers a person judged not to be covers before the pool was frozen, with the reason. */
  excluded: Array<{ id: string; reason: string }>;
  covers: PoolCover[];
  /**
   * Pools this one grew from. Their votes and reports count here too, for the
   * covers both hold: the 1000-cover pool kept the 35 votes friends had cast
   * on the 200-book one (2026-09-11). New votes go to this pool's own name.
   */
  inherits?: string[];
}

/** Every log whose votes count for this pool, oldest first: the pools it grew from, then its own. */
function logsOf(pool: VersusPool): string[] {
  return [...(pool.inherits ?? []), pool.name];
}

/** Reports under this pool's name and every name it inherits, each cover once. */
async function flagsOf(store: VoteStore, pool: VersusPool): Promise<CoverFlag[]> {
  const lists = await Promise.all(logsOf(pool).map(name => store.flags(name)));
  const byCover = new Map<string, CoverFlag>();
  for (const flag of lists.flat()) if (!byCover.has(flag.id)) byCover.set(flag.id, flag);
  return [...byCover.values()];
}

/** Every vote and every report. Reads the whole log: for the board, not for a click. */
async function recorded(store: VoteStore, pool: VersusPool): Promise<{ votes: StoredVote[]; flags: CoverFlag[] }> {
  const [votes, flags] = await Promise.all([
    Promise.all(logsOf(pool).map(name => store.votes(name))),
    flagsOf(store, pool),
  ]);
  return { votes: votes.flat(), flags };
}

/** The pool's covers minus the ones people reported. */
function activeIds(pool: VersusPool, flags: readonly CoverFlag[]): string[] {
  const out = new Set(flags.map(f => f.id));
  return pool.covers.map(c => c.id).filter(id => !out.has(id));
}

export const POOL = poolFile as VersusPool;

/** Through our own image route (ROADMAP 1.3): the covers never leave the site. */
export function imagePath(coverId: string, size: 'M' | 'L'): string {
  return `/img/${size}/${coverPathSegment(coverId)}`;
}

/**
 * The key for this deployment's pair tokens: from the REST token, or from the
 * Redis address, whose password makes it just as secret and just as shared
 * between the instances of one deployment.
 */
export function secretForEnv(env: Record<string, string | undefined> = process.env): Buffer {
  const config = storeConfig(env);
  return pairSecret(config ? (config.kind === 'rest' ? config.token : config.url) : undefined);
}

/**
 * The running tally behind the pairing.
 *
 * A tally is always **the first N votes of each log, counted**. A request for
 * a pair asks the store how many votes there are (LLEN, a few bytes), fetches
 * only those past N and counts them on. Each instance keeps its tally in
 * memory; every `TALLY_SAVE_EVERY` votes it also writes it beside the votes,
 * so a fresh instance starts there instead of at the first vote.
 *
 * Because it is always a whole prefix, two instances cannot corrupt it:
 * whichever saves last saves a consistent state — at worst an older one, and
 * the next request counts the difference again. No lock and no script. On one
 * instance the updates queue, so two clicks at once never count the same new
 * votes twice.
 *
 * Two small differences from recounting, both harmless for choosing a pair and
 * both absent from the board, which recounts: votes are counted in the order
 * the logs were written (inherited first), and a vote on a cover reported
 * later still moved its opponent's rating.
 */
export const TALLY_SAVE_EVERY = 25;

interface TallyEntry {
  /** The pool it was counted for; a rebuilt pool under the same name starts over. */
  pool: string;
  upto: Record<string, number>;
  elo: EloState;
  /** Votes that moved a rating: the ones on two covers this pool holds. */
  applied: number;
  /** Votes counted when it was last written to the store. */
  saved: number;
  loaded: boolean;
  queue: Promise<void>;
}

const tallies = new Map<string, TallyEntry>();

/** For tests: every tally is forgotten, as on a fresh instance. */
export function forgetTallies(): void {
  tallies.clear();
}

/** Which pool a tally or a board belongs to: its name and every cover id, FNV-1a. */
function fingerprint(pool: VersusPool): string {
  let h = 0x811c9dc5;
  for (const part of [pool.name, ...pool.covers.map(c => c.id)]) {
    for (let i = 0; i < part.length; i++) h = Math.imul(h ^ part.charCodeAt(i), 0x01000193) >>> 0;
    h = Math.imul(h ^ 0x7c, 0x01000193) >>> 0;
  }
  return `${pool.name}#${h.toString(16)}`;
}

const counted = (upto: Record<string, number>) => Object.values(upto).reduce((sum, n) => sum + n, 0);

function freshEntry(pool: string): TallyEntry {
  return { pool, upto: {}, elo: newElo([]), applied: 0, saved: 0, loaded: false, queue: Promise.resolve() };
}

function readTally(raw: string | null, pool: string): Pick<TallyEntry, 'upto' | 'elo' | 'applied'> | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as { pool?: unknown; upto?: unknown; covers?: unknown; applied?: unknown };
    if (t.pool !== pool || !t.upto || typeof t.upto !== 'object' || !t.covers || typeof t.covers !== 'object') return null;
    if (typeof t.applied !== 'number' || t.applied < 0) return null;
    const elo = newElo([]);
    for (const [id, value] of Object.entries(t.covers as Record<string, unknown>)) {
      if (!Array.isArray(value) || typeof value[0] !== 'number' || typeof value[1] !== 'number') return null;
      elo.rating.set(id, value[0]);
      elo.games.set(id, value[1]);
    }
    const upto: Record<string, number> = {};
    for (const [name, n] of Object.entries(t.upto as Record<string, unknown>)) {
      if (typeof n !== 'number' || n < 0) return null;
      upto[name] = n;
    }
    return { upto, elo, applied: t.applied };
  } catch {
    return null;
  }
}

function writeTally(entry: TallyEntry): string {
  const covers: Record<string, [number, number]> = {};
  for (const [id, rating] of entry.elo.rating) covers[id] = [Math.round(rating * 100) / 100, entry.elo.games.get(id) ?? 0];
  return JSON.stringify({ pool: entry.pool, upto: entry.upto, applied: entry.applied, covers });
}

async function catchUp(store: VoteStore, pool: VersusPool, entry: TallyEntry): Promise<void> {
  const logs = logsOf(pool);
  const counts = await Promise.all(logs.map(name => store.count(name)));
  // A log shorter than what was counted means the store was emptied or replaced: count again from nothing.
  if (logs.some((name, i) => counts[i] < (entry.upto[name] ?? 0))) Object.assign(entry, freshEntry(entry.pool), { loaded: true, queue: entry.queue });
  if (!entry.loaded) {
    const saved = readTally(await store.tally(pool.name), entry.pool);
    if (saved && logs.every((name, i) => counts[i] >= (saved.upto[name] ?? 0))) {
      entry.upto = saved.upto;
      entry.elo = saved.elo;
      entry.applied = saved.applied;
      entry.saved = counted(saved.upto);
    }
    entry.loaded = true;
  }
  const known = new Set(pool.covers.map(c => c.id));
  for (const [i, name] of logs.entries()) {
    const from = entry.upto[name] ?? 0;
    if (counts[i] <= from) continue;
    const { votes, seen } = await store.votesFrom(name, from);
    // Counted and advanced together, after the fetch: a store that fails mid-way leaves the tally as it was.
    for (const vote of votes) {
      if (!known.has(vote.a) || !known.has(vote.b)) continue;
      applyVote(entry.elo, vote);
      entry.applied++;
    }
    entry.upto[name] = from + seen;
  }
  const total = counted(entry.upto);
  if (total - entry.saved >= TALLY_SAVE_EVERY) {
    await store.saveTally(pool.name, writeTally(entry));
    entry.saved = total;
  }
}

/** The ratings and games the pairing needs, brought up to the last vote. */
export async function pairingTally(store: VoteStore, pool: VersusPool = POOL): Promise<{ elo: EloState; votes: number }> {
  const id = fingerprint(pool);
  const entry = tallies.get(id) ?? freshEntry(id);
  tallies.set(id, entry);
  const work = entry.queue.then(() => catchUp(store, pool, entry));
  entry.queue = work.catch(() => undefined);
  await work;
  return { elo: entry.elo, votes: entry.applied };
}

export interface PairSide {
  id: string;
  src: string;
  title: string;
  author: string;
  workId: string;
  /** The book page with this cover selected: what the share button under a cover passes on. */
  href: string;
}

function side(pool: VersusPool, id: string): PairSide {
  const cover = pool.covers.find(c => c.id === id);
  return {
    id,
    workId: cover?.workId ?? '',
    src: imagePath(id, 'L'),
    title: cover?.title ?? '',
    author: cover?.author ?? '',
    href: cover ? bookPath(cover.workId, id) : '',
  };
}

export interface PairResponse {
  pool: string;
  store: VoteStore['kind'];
  votes: number;
  covers: number;
  /** Title and author shown under each cover since 2026-09-11 (Julian: "wir müssen noch titel und autor anzeigen"). */
  a: PairSide;
  b: PairSide;
  token: string;
}

export async function nextPairFor(
  store: VoteStore,
  secret: Buffer,
  { pool = POOL, last, recent, random = rng(Date.now() >>> 0), now = Date.now() }: {
    pool?: VersusPool;
    /** The pair just shown, which the client sends back so it is not shown again at once. */
    last?: readonly [string, string];
    /** Covers this player saw lately (`nextPair`); the browser keeps the list, the server nothing about the player. */
    recent?: readonly string[];
    random?: () => number;
    now?: number;
  } = {},
): Promise<PairResponse | null> {
  const [{ elo, votes }, flags] = await Promise.all([pairingTally(store, pool), flagsOf(store, pool)]);
  const ids = activeIds(pool, flags);
  const book = new Map(pool.covers.map(c => [c.id, c.workId]));
  const pair = nextPair(ids, elo, random, { last, recent, bookOf: id => book.get(id) ?? id });
  if (!pair) return null;
  const [a, b] = pair;
  return {
    pool: pool.name,
    store: store.kind,
    votes,
    covers: ids.length,
    a: side(pool, a),
    b: side(pool, b),
    token: signPair(secret, pool.name, a, b, now),
  };
}

/**
 * `chosen` names the book behind the cover just picked. The pair itself never
 * says it — the cover is judged, not the book — but once the vote is in, the
 * player may want to go to the book (Julian, 2026-09-11: "falls man es so
 * schön findet, dass man es kaufen möchte").
 */
export type Outcome =
  | { ok: true; chosen?: { id: string; workId: string; title: string; author: string; href: string } }
  | { ok: false; status: 400 | 409; error: string };

/** The detail page with this cover selected (ROADMAP 6.20): where its buy links are. */
export function bookPath(workId: string, coverId: string): string {
  return `/book/${workId}/cover/${coverPathSegment(coverId)}`;
}

interface PairInput {
  a: unknown;
  b: unknown;
  token: unknown;
}

/** A pair this server handed out and nobody has used yet — or the reason it is not. */
async function claimPair(
  store: VoteStore, secret: Buffer, pool: VersusPool, input: PairInput, now: number,
): Promise<Outcome & { a?: string; b?: string }> {
  const { a, b, token } = input;
  if (typeof a !== 'string' || typeof b !== 'string' || typeof token !== 'string' || a === b) {
    return { ok: false, status: 400, error: 'A vote needs the two covers shown and the token that came with them.' };
  }
  const known = new Set(pool.covers.map(c => c.id));
  if (!known.has(a) || !known.has(b)) return { ok: false, status: 400, error: 'Those covers are not in this game.' };
  if (!verifyPair(secret, pool.name, a, b, token, now)) {
    return { ok: false, status: 400, error: 'This pair was not handed out here, or it has expired. Load a new one.' };
  }
  if (!(await store.claim(token, PAIR_TTL_SECONDS))) {
    return { ok: false, status: 409, error: 'This pair has already been voted on.' };
  }
  return { ok: true, a, b };
}

export async function castVote(
  store: VoteStore,
  secret: Buffer,
  input: PairInput & { winner: unknown },
  { pool = POOL, now = Date.now() }: { pool?: VersusPool; now?: number } = {},
): Promise<Outcome> {
  if (input.winner !== input.a && input.winner !== input.b) {
    return { ok: false, status: 400, error: 'The winner has to be one of the two covers.' };
  }
  const claimed = await claimPair(store, secret, pool, input, now);
  if (!claimed.ok || !claimed.a || !claimed.b) return claimed.ok ? { ok: false, status: 400, error: 'Not a vote.' } : claimed;
  const vote: StoredVote = { a: claimed.a, b: claimed.b, winner: input.winner as string, on: new Date(now).toISOString().slice(0, 10) };
  await store.add(pool.name, vote);
  const cover = pool.covers.find(c => c.id === vote.winner);
  if (!cover) return { ok: true };
  const { id, workId, title, author } = cover;
  return { ok: true, chosen: { id, workId, title, author, href: bookPath(workId, id) } };
}

/**
 * "Not a cover", or an image that did not load. Takes the cover out of the
 * game for everyone, so it needs the same proof as a vote — the pair it was
 * shown in — and uses the pair up.
 */
export async function flagCover(
  store: VoteStore,
  secret: Buffer,
  input: PairInput & { id: unknown; reason: unknown },
  { pool = POOL, now = Date.now() }: { pool?: VersusPool; now?: number } = {},
): Promise<Outcome> {
  if (input.id !== input.a && input.id !== input.b) {
    return { ok: false, status: 400, error: 'Only a cover that was on screen can be reported.' };
  }
  const claimed = await claimPair(store, secret, pool, input, now);
  if (!claimed.ok) return claimed;
  await store.flag(pool.name, { id: input.id as string, reason: input.reason === 'broken' ? 'broken' : 'reported' });
  return { ok: true };
}

/** `exact` only for a crown held CROWN_HOLD rounds in a row; less than that is `rising`, shown but not claimed. */
export type Verdict = 'exact' | 'rising' | 'three' | 'open';

function judge(crown: Crown, standing: Standing | undefined, end: 'best' | 'worst'): Verdict {
  if (!standing) return 'open';
  if (crown.held >= CROWN_HOLD) return 'exact';
  if (crown.held > 0) return 'rising';
  const verdict = verdictFor(standing, end);
  return verdict === 'exact' ? 'rising' : verdict;
}

export interface BoardEntry extends Standing, PoolCover {
  src: string;
  /** Votes this cover won, out of `games`: what the standings page says instead of shares of rankings. */
  wins: number;
}

export interface Board {
  pool: string;
  store: VoteStore['kind'];
  covers: number;
  votes: number;
  /** Average games a cover has played. */
  perCover: number;
  favourite: { rate: number; decided: number };
  hold: number;
  best: { verdict: Verdict; held: number };
  worst: { verdict: Verdict; held: number };
  top: BoardEntry[];
  bottom: BoardEntry[];
  flagged: number;
}

/** How many covers each end of the board lists: five, or twenty on request (Julian, 2026-09-11). */
export async function board(
  store: VoteStore,
  { pool = POOL, top: topCount = 5, bottom: bottomCount = 5 }: { pool?: VersusPool; top?: number; bottom?: number } = {},
): Promise<Board> {
  const { votes: all, flags } = await recorded(store, pool);
  const ids = activeIds(pool, flags);
  // A vote on a cover the pool no longer holds, or one people reported, counts for nothing here.
  const active = new Set(ids);
  const votes = all.filter(v => active.has(v.a) && active.has(v.b));
  // One round is as many votes as there are covers: the spacing the simulation judged at.
  const { table, best, worst } = crowns(ids, votes, { step: Math.max(1, ids.length) });
  const meta = new Map(pool.covers.map(c => [c.id, c]));
  const wins = new Map<string, number>();
  for (const v of votes) wins.set(v.winner, (wins.get(v.winner) ?? 0) + 1);
  const entry = (s: Standing): BoardEntry => {
    const c = meta.get(s.id) ?? { id: s.id, workId: '', title: '', author: '' };
    return { ...c, ...s, src: imagePath(s.id, 'M'), wins: wins.get(s.id) ?? 0 };
  };
  const top = table.slice(0, topCount);
  const bottom = table.slice(-bottomCount).reverse();
  return {
    pool: pool.name,
    store: store.kind,
    covers: ids.length,
    votes: votes.length,
    perCover: ids.length ? (2 * votes.length) / ids.length : 0,
    favourite: favouriteRate(ids, votes),
    hold: CROWN_HOLD,
    best: { verdict: judge(best, top[0], 'best'), held: best.held },
    worst: { verdict: judge(worst, bottom[0], 'worst'), held: worst.held },
    top: top.map(entry),
    bottom: bottom.map(entry),
    flagged: flags.length,
  };
}

/**
 * The board for everyone who opens it within a minute. It still reads every
 * vote — the uncertainty of the standings needs them all — so it is counted
 * once a minute per instance instead of once per visitor, and a crawler that
 * comes by often costs nothing extra. Two visitors in the same second share
 * one count.
 */
export const BOARD_SECONDS = 60;

const boards = new Map<string, { at: number; board: Promise<Board> }>();

/** For tests: the next board is counted afresh. */
export function forgetBoards(): void {
  boards.clear();
}

export function cachedBoard(
  store: VoteStore,
  { pool = POOL, top = 5, bottom = 5, now = Date.now() }: { pool?: VersusPool; top?: number; bottom?: number; now?: number } = {},
): Promise<Board> {
  const key = `${fingerprint(pool)}|${store.kind}|${top}|${bottom}`;
  const hit = boards.get(key);
  if (hit && now - hit.at < BOARD_SECONDS * 1000) return hit.board;
  const counting = board(store, { pool, top, bottom });
  boards.set(key, { at: now, board: counting });
  // A store that did not answer is not a board to keep for a minute.
  counting.catch(() => boards.delete(key));
  return counting;
}

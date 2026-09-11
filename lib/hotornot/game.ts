/**
 * The cover game on the site (ROADMAP 5.8a). Server only.
 *
 * The same arithmetic as the lab (`rating.ts`, validated by
 * `lab/hotornot/sim.ts`), the same claim rule (`crowns`, `CROWN_HOLD`), and a
 * frozen pool (`data/versus-pool.json`). What is new is the store and the
 * signed pairs. Each function takes the store and the pool as arguments, so
 * the tests play whole games against memory.
 *
 * Stateless on purpose: every request reads the votes and recomputes. That is
 * fine up to a few thousand votes — the friends test this is built for — and
 * it means any instance answers like any other. Past that, the votes would
 * want an incremental rating in the store.
 */
import poolFile from '@/data/versus-pool.json';
import { coverPathSegment } from '../coverurl';
import { rng } from '../loading';
import type { PoolCover } from './pool';
import {
  CROWN_HOLD, applyVote, crowns, favouriteRate, newElo, nextPair, verdictFor,
  type Crown, type Standing, type Vote,
} from './rating';
import { storeConfig, type StoredVote, type VoteStore } from './store';
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

/** Votes and reports under this pool's name and every name it inherits. */
async function recorded(store: VoteStore, pool: VersusPool): Promise<{ votes: StoredVote[]; flags: Awaited<ReturnType<VoteStore['flags']>> }> {
  const names = [pool.name, ...(pool.inherits ?? [])];
  const [votes, flags] = await Promise.all([
    Promise.all(names.map(name => store.votes(name))),
    Promise.all(names.map(name => store.flags(name))),
  ]);
  return { votes: votes.flat(), flags: flags.flat() };
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

async function activeCovers(store: VoteStore, pool: VersusPool): Promise<{ ids: string[]; votes: Vote[] }> {
  const { votes, flags } = await recorded(store, pool);
  const out = new Set(flags.map(f => f.id));
  const ids = pool.covers.map(c => c.id).filter(id => !out.has(id));
  // A vote on a cover the pool no longer holds (a stricter rule took it out) counts for nothing.
  const active = new Set(ids);
  return { ids, votes: votes.filter(v => active.has(v.a) && active.has(v.b)) };
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
  const { ids, votes } = await activeCovers(store, pool);
  const elo = newElo(ids);
  for (const vote of votes) applyVote(elo, vote);
  const pair = nextPair(ids, elo, random, { last, recent });
  if (!pair) return null;
  const [a, b] = pair;
  return {
    pool: pool.name,
    store: store.kind,
    votes: votes.length,
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
  const [{ ids, votes }, { flags }] = await Promise.all([activeCovers(store, pool), recorded(store, pool)]);
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

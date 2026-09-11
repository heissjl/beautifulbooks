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
}

export const POOL = poolFile as VersusPool;

/** Through our own image route (ROADMAP 1.3): the covers never leave the site. */
export function imagePath(coverId: string, size: 'M' | 'L'): string {
  return `/img/${size}/${coverPathSegment(coverId)}`;
}

/** The key for this deployment's pair tokens. */
export function secretForEnv(env: Record<string, string | undefined> = process.env): Buffer {
  return pairSecret(storeConfig(env)?.token);
}

async function activeCovers(store: VoteStore, pool: VersusPool): Promise<{ ids: string[]; votes: Vote[] }> {
  const [votes, flags] = await Promise.all([store.votes(pool.name), store.flags(pool.name)]);
  const out = new Set(flags.map(f => f.id));
  const ids = pool.covers.map(c => c.id).filter(id => !out.has(id));
  return { ids, votes: votes.filter(v => !out.has(v.a) && !out.has(v.b)) };
}

export interface PairResponse {
  pool: string;
  store: VoteStore['kind'];
  votes: number;
  covers: number;
  a: { id: string; src: string };
  b: { id: string; src: string };
  token: string;
}

export async function nextPairFor(
  store: VoteStore,
  secret: Buffer,
  { pool = POOL, last, random = rng(Date.now() >>> 0), now = Date.now() }: {
    pool?: VersusPool;
    /** The pair just shown, which the client sends back so it is not shown again at once. */
    last?: readonly [string, string];
    random?: () => number;
    now?: number;
  } = {},
): Promise<PairResponse | null> {
  const { ids, votes } = await activeCovers(store, pool);
  const elo = newElo(ids);
  for (const vote of votes) applyVote(elo, vote);
  const pair = nextPair(ids, elo, random, { last });
  if (!pair) return null;
  const [a, b] = pair;
  return {
    pool: pool.name,
    store: store.kind,
    votes: votes.length,
    covers: ids.length,
    a: { id: a, src: imagePath(a, 'L') },
    b: { id: b, src: imagePath(b, 'L') },
    token: signPair(secret, pool.name, a, b, now),
  };
}

export type Outcome = { ok: true } | { ok: false; status: 400 | 409; error: string };

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
  return { ok: true };
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

export async function board(store: VoteStore, { pool = POOL }: { pool?: VersusPool } = {}): Promise<Board> {
  const [{ ids, votes }, flags] = await Promise.all([activeCovers(store, pool), store.flags(pool.name)]);
  // One round is as many votes as there are covers: the spacing the simulation judged at.
  const { table, best, worst } = crowns(ids, votes, { step: Math.max(1, ids.length) });
  const meta = new Map(pool.covers.map(c => [c.id, c]));
  const entry = (s: Standing): BoardEntry => {
    const c = meta.get(s.id) ?? { id: s.id, workId: '', title: '', author: '' };
    return { ...c, ...s, src: imagePath(s.id, 'M') };
  };
  const top = table.slice(0, 5);
  const bottom = table.slice(-5).reverse();
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

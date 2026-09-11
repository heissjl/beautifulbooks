/**
 * Hot or Not for book covers — the arithmetic (ROADMAP 5.8, Spielart 4).
 *
 * Two covers side by side, one click for the one you would rather look at:
 * the mechanism Facemash made famous in 2003. What is taken from it is the
 * pairwise vote and the Elo rating. What it rated — photographs of people,
 * taken without asking — is exactly what a cover is not: a cover is made to
 * be judged, and "judge a book by its covers" is this site's first line.
 *
 * Pure, no I/O. Three tools, each for its own job:
 *
 *   - **Elo**, updated after every vote. Cheap, and good enough to choose the
 *     next pair. Its ratings depend on the order the votes came in, so it is
 *     never what gets reported.
 *   - **Bradley–Terry**, fitted over all votes at once. Order-free; this is
 *     the ranking the board shows.
 *   - **Plausible rankings drawn from each cover's uncertainty**: how often
 *     the reported ugliest cover is still the ugliest among rankings the votes
 *     allow. That share, not the crown, is what a claim may rest on (SPEC
 *     N12). "The ugliest cover" after sixty votes is noise with a headline.
 */
import { rng } from '../loading';

/** Where every cover starts, and the step size — the chess conventions Facemash used. */
export const ELO_START = 1500;
export const ELO_K = 32;

/**
 * Share of plausible rankings an end must hold before the board calls it a
 * finding. Below it the board says "not yet", and nothing gets posted on that
 * basis. Whether 0.9 keeps wrong claims rare is what `sim.ts` measures.
 */
export const FINDING_SHARE = 0.9;

export interface Vote {
  a: string;
  b: string;
  /** The preferred cover, `a` or `b`. A skip is not a vote and is not stored. */
  winner: string;
}

/** Probability that a cover rated `ra` beats one rated `rb`. */
export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

export interface EloState {
  rating: Map<string, number>;
  games: Map<string, number>;
}

export function newElo(ids: readonly string[]): EloState {
  return {
    rating: new Map(ids.map(id => [id, ELO_START])),
    games: new Map(ids.map(id => [id, 0])),
  };
}

/**
 * Applies one vote, in place. Returns whether the favourite *before* the vote
 * won it, or undefined when the two were level and there was no favourite.
 */
export function applyVote(state: EloState, vote: Vote, k = ELO_K): boolean | undefined {
  const ra = state.rating.get(vote.a) ?? ELO_START;
  const rb = state.rating.get(vote.b) ?? ELO_START;
  const sa = vote.winner === vote.a ? 1 : 0;
  const shift = k * (sa - expectedScore(ra, rb));
  state.rating.set(vote.a, ra + shift);
  state.rating.set(vote.b, rb - shift);
  state.games.set(vote.a, (state.games.get(vote.a) ?? 0) + 1);
  state.games.set(vote.b, (state.games.get(vote.b) ?? 0) + 1);
  if (ra === rb) return undefined;
  return (ra > rb) === (sa === 1);
}

/**
 * How often the Elo favourite won, over the later part of the votes.
 *
 * The game's consensus in one number, and the bridge to the simulation
 * (`sim.ts` reports the same statistic under the same pairing): near 50 %
 * the votes are taste and nothing else, and no cover can be crowned however
 * long people click. The first half is left out because every cover starts
 * level and the early favourites are coin flips.
 */
export function favouriteRate(
  ids: readonly string[],
  votes: readonly Vote[],
  fromShare = 0.5,
): { rate: number; decided: number } {
  const state = newElo(ids);
  const from = Math.floor(votes.length * fromShare);
  let won = 0;
  let decided = 0;
  votes.forEach((vote, i) => {
    const favouriteWon = applyVote(state, vote);
    if (i < from || favouriteWon === undefined) return;
    decided += 1;
    if (favouriteWon) won += 1;
  });
  return { rate: decided ? won / decided : 0, decided };
}

export interface FitOptions {
  /**
   * Virtual games each cover has drawn against an average cover (half won,
   * half lost). Keeps the fit finite for a cover that has never won or never
   * lost — early on, most of them — and pulls a cover seen twice towards the
   * middle, which is where two votes say it belongs.
   */
  prior?: number;
  iterations?: number;
  tolerance?: number;
  /** Strengths to start from (log scale); a previous fit makes the next one fast. */
  start?: ReadonlyMap<string, number>;
}

/**
 * Bradley–Terry strengths on a log scale, fitted by Hunter's MM algorithm.
 * 0 is the virtual average cover; a cover at +1 beats it 73 % of the time.
 */
export function fitBradleyTerry(
  ids: readonly string[],
  votes: readonly Vote[],
  options: FitOptions = {},
): Map<string, number> {
  const prior = options.prior ?? 1;
  const iterations = options.iterations ?? 500;
  const tolerance = options.tolerance ?? 1e-7;
  const n = ids.length;
  const at = new Map(ids.map((id, i) => [id, i]));

  const wins = new Float64Array(n);
  const counts = new Map<number, number>();
  for (const vote of votes) {
    const i = at.get(vote.a);
    const j = at.get(vote.b);
    if (i === undefined || j === undefined || i === j) continue;
    wins[vote.winner === vote.a ? i : j] += 1;
    const key = i < j ? i * n + j : j * n + i;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const left = new Int32Array(counts.size);
  const right = new Int32Array(counts.size);
  const games = new Float64Array(counts.size);
  let m = 0;
  for (const [key, count] of counts) {
    left[m] = Math.floor(key / n);
    right[m] = key % n;
    games[m] = count;
    m += 1;
  }

  const p = new Float64Array(n);
  for (let i = 0; i < n; i++) p[i] = Math.exp(options.start?.get(ids[i]) ?? 0);
  const denominator = new Float64Array(n);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) denominator[i] = prior / (p[i] + 1);
    for (let k = 0; k < games.length; k++) {
      const share = games[k] / (p[left[k]] + p[right[k]]);
      denominator[left[k]] += share;
      denominator[right[k]] += share;
    }
    let change = 0;
    for (let i = 0; i < n; i++) {
      const next = (wins[i] + prior / 2) / denominator[i];
      change = Math.max(change, Math.abs(Math.log(next / p[i])));
      p[i] = next;
    }
    if (change < tolerance) break;
  }
  return new Map(ids.map((id, i) => [id, Math.log(p[i])]));
}

/**
 * How uncertain each strength is: one standard deviation on the log scale,
 * from the curvature of the likelihood at the fit (a Laplace approximation,
 * cover by cover). Every game adds `p_a p_b / (p_a + p_b)^2` of information
 * to both covers, whoever won; the virtual games of the prior add theirs.
 * Three games leave a cover uncertain by well over one unit; three hundred
 * pin it to a tenth.
 */
export function strengthSpread(
  ids: readonly string[],
  votes: readonly Vote[],
  fit: ReadonlyMap<string, number>,
  prior = 1,
): Map<string, number> {
  const p = new Map(ids.map(id => [id, Math.exp(fit.get(id) ?? 0)]));
  const information = new Map(ids.map(id => {
    const pi = p.get(id) ?? 1;
    return [id, (prior * pi) / (pi + 1) ** 2];
  }));
  for (const vote of votes) {
    const pa = p.get(vote.a);
    const pb = p.get(vote.b);
    if (pa === undefined || pb === undefined || vote.a === vote.b) continue;
    const gained = (pa * pb) / (pa + pb) ** 2;
    information.set(vote.a, (information.get(vote.a) ?? 0) + gained);
    information.set(vote.b, (information.get(vote.b) ?? 0) + gained);
  }
  return new Map(ids.map(id => [id, 1 / Math.sqrt(information.get(id) ?? prior / 4)]));
}

/** The narrowest spread of appeal the board assumes; below it, covers count as alike. */
export const MIN_APPEAL = 0.25;

/**
 * How strongly to pull strengths towards the middle, from how much the covers
 * turn out to differ (empirical Bayes, by the method of moments).
 *
 * A fixed single virtual game was the second version, and it still crowned
 * on fifteen votes: one virtual game says covers may lie two units apart
 * either way, so four losses in a row carried a cover far out to the end.
 * How far covers really lie apart is itself in the votes — the spread of the
 * fitted strengths, less the part of it that is only each fit's own error.
 * Where voters agree, covers differ a lot and the pull is weak; where it is
 * taste, they barely differ and the pull is strong, which is exactly where a
 * crown would otherwise be invented. Before there is evidence of a spread,
 * the pull is at its strongest.
 */
export function empiricalPrior(
  ids: readonly string[],
  votes: readonly Vote[],
  start?: ReadonlyMap<string, number>,
): { prior: number; appeal: number } {
  const loose = fitBradleyTerry(ids, votes, { prior: 1, start });
  const error = strengthSpread(ids, votes, loose, 1);
  const n = Math.max(1, ids.length);
  const values = ids.map(id => loose.get(id) ?? 0);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const total = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const noise = ids.reduce((s, id) => s + (error.get(id) ?? 0) ** 2, 0) / n;
  const appeal = Math.sqrt(Math.max(total - noise, MIN_APPEAL ** 2));
  // One virtual game against an average cover carries a quarter unit of information.
  return { prior: Math.min(64, Math.max(0.5, 4 / appeal ** 2)), appeal };
}

export interface Standing {
  id: string;
  /** Bradley–Terry strength over every vote, log scale. */
  strength: number;
  games: number;
  /** Share of plausible rankings in which this cover came first, or among the first three. */
  first: number;
  topThree: number;
  /** The same from the other end. */
  last: number;
  bottomThree: number;
}

/**
 * The ranking with its own doubt attached, best first.
 *
 * `draws` plausible rankings are drawn, each cover's strength shaken by its
 * own uncertainty (`strengthSpread`), and each cover carries the share in
 * which it held an end. A cover that is last in 55 of 100 is not "the ugliest
 * cover", it is a candidate. How hard the strengths are pulled towards the
 * middle first follows from the votes (`empiricalPrior`).
 *
 * **Not a bootstrap, on purpose.** Resampling the votes was the first
 * version, and it crowned after fifteen votes: a cover that lost its only
 * three games loses them again in nearly every resample, so it sat at the
 * bottom almost every time. That measures how stable these votes are, not
 * how sure we are about the cover — three losses happen to an average cover
 * one time in eight. Shaking each cover on its own ignores that strengths are
 * measured against each other, which makes the spread wider than it is; for
 * a claim that is the side to err on.
 */
export function standings(
  ids: readonly string[],
  votes: readonly Vote[],
  { draws = 100, seed = 1, prior, start }: {
    draws?: number;
    seed?: number;
    /** Fixed virtual games per cover; by default they follow from the votes. */
    prior?: number;
    start?: ReadonlyMap<string, number>;
  } = {},
): Standing[] {
  const virtualGames = prior ?? empiricalPrior(ids, votes, start).prior;
  const fit = fitBradleyTerry(ids, votes, { prior: virtualGames, start });
  const spread = strengthSpread(ids, votes, fit, virtualGames);
  const games = new Map(ids.map(id => [id, 0]));
  for (const v of votes) {
    games.set(v.a, (games.get(v.a) ?? 0) + 1);
    games.set(v.b, (games.get(v.b) ?? 0) + 1);
  }
  const tally = new Map(ids.map(id => [id, { first: 0, topThree: 0, last: 0, bottomThree: 0 }]));
  const random = rng(seed);
  const runs = Math.max(1, draws);
  for (let r = 0; r < runs; r++) {
    const order = ids
      .map(id => ({ id, s: (fit.get(id) ?? 0) + (spread.get(id) ?? 0) * gaussian(random) }))
      .sort((x, y) => y.s - x.s);
    order.forEach(({ id }, place) => {
      const t = tally.get(id);
      if (!t) return;
      if (place === 0) t.first += 1;
      if (place < 3) t.topThree += 1;
      if (place === order.length - 1) t.last += 1;
      if (place >= order.length - 3) t.bottomThree += 1;
    });
  }
  return ids
    .map(id => {
      const t = tally.get(id) ?? { first: 0, topThree: 0, last: 0, bottomThree: 0 };
      return {
        id,
        strength: fit.get(id) ?? 0,
        games: games.get(id) ?? 0,
        first: t.first / runs,
        topThree: t.topThree / runs,
        last: t.last / runs,
        bottomThree: t.bottomThree / runs,
      };
    })
    .sort((x, y) => y.strength - x.strength);
}

/**
 * What the board may say about an end: `exact` — this cover, a finding;
 * `three` — only that it is one of the three; `open` — not yet anything.
 */
export function verdictFor(standing: Standing, end: 'best' | 'worst'): 'exact' | 'three' | 'open' {
  const one = end === 'best' ? standing.first : standing.last;
  const three = end === 'best' ? standing.topThree : standing.bottomThree;
  if (one >= FINDING_SHARE) return 'exact';
  if (three >= FINDING_SHARE) return 'three';
  return 'open';
}

/**
 * The crown, if the same cover has worn it at each of the last `hold` checks;
 * otherwise null. `history` lists, check by check, the cover the board called
 * `exact` at that end, or '' where it called nothing.
 *
 * Why a crown has to be held: the board is asked again after every round of
 * votes, and whoever posts at the first 90 % inherits the old trouble with
 * peeking — asked sixty times, a threshold is crossed by chance sooner or
 * later. A crown that survives more votes is one the votes keep confirming.
 */
export function crownHeld(history: readonly string[], hold: number): string | null {
  if (hold < 1 || history.length < hold) return null;
  const recent = history.slice(-hold);
  return recent[0] !== '' && recent.every(id => id === recent[0]) ? recent[0] : null;
}

/**
 * Rounds in a row a crown must be held before the board calls it a finding.
 * A round is as many votes as the pool has covers — the spacing at which
 * `sim.ts` asks the board, so the two judge alike.
 */
export const CROWN_HOLD = 3;

export interface Crown {
  /** The cover the board calls `exact` at this end now, or '' for none. */
  id: string;
  /** Rounds in a row, counting back from now, it has been called that; at most `hold`. */
  held: number;
}

/**
 * The board's judgement with its history: the standings now, and for each end
 * how many rounds back the same cover was already crowned. Stateless — the
 * earlier rounds are recomputed from the first votes — so a restarted server
 * judges exactly as a running one would.
 */
export function crowns(
  ids: readonly string[],
  votes: readonly Vote[],
  { step, hold = CROWN_HOLD, draws = 100, seed = 1 }: { step: number; hold?: number; draws?: number; seed?: number },
): { table: Standing[]; best: Crown; worst: Crown } {
  const table = standings(ids, votes, { draws, seed });
  const crowned = (t: Standing[], end: 'best' | 'worst') => {
    const s = end === 'best' ? t[0] : t[t.length - 1];
    return s && verdictFor(s, end) === 'exact' ? s.id : '';
  };
  const best = { id: crowned(table, 'best'), held: 0 };
  const worst = { id: crowned(table, 'worst'), held: 0 };
  let bestRuns = best.id !== '';
  let worstRuns = worst.id !== '';
  for (let back = 0; back < hold && (bestRuns || worstRuns); back++) {
    const n = votes.length - back * step;
    if (n <= 0) break;
    const then = back === 0 ? table : standings(ids, votes.slice(0, n), { draws, seed });
    if (bestRuns && crowned(then, 'best') === best.id) best.held += 1;
    else bestRuns = false;
    if (worstRuns && crowned(then, 'worst') === worst.id) worst.held += 1;
    else worstRuns = false;
  }
  return { table, best, worst };
}

export interface PairOptions {
  /** Games every cover plays before the ends get extra attention. */
  warmup?: number;
  /**
   * Share of pairs, after the warm-up, that start from the current top or
   * bottom. The claim is about the ends, so that is where the votes go; the
   * middle only has to be sorted well enough to know who is at the ends.
   */
  tailFocus?: number;
  /** How many covers count as an end. */
  tail?: number;
  /** The opponent comes from this many nearest-rated covers. */
  window?: number;
  /** The pair just shown, not to be shown again straight away. */
  last?: readonly [string, string];
  /**
   * Covers this player saw lately. Kept out of the next pair while at least
   * two others are left (Julian, 2026-09-11: covers came back too often in a
   * row). Without it, a skipped cover returned at once — skipping plays no
   * game, so it stayed the least-seen — and after the warm-up every second
   * pair started from the same twenty covers at the ends.
   */
  recent?: readonly string[];
}

/**
 * The next pair to show.
 *
 * One cover is the least-seen (or, after the warm-up and in `tailFocus` of
 * the cases, one from either end); its opponent is the least-seen among its
 * nearest-rated rivals, because a vote between a clear favourite and a clear
 * outsider teaches almost nothing. **Which side each lands on is random**:
 * people favour one side of a pair, and a system that always put the
 * least-seen cover on the left would measure that instead of the covers.
 */
export function nextPair(
  ids: readonly string[],
  elo: EloState,
  random: () => number,
  options: PairOptions = {},
): [string, string] | null {
  if (ids.length < 2) return null;
  const warmup = options.warmup ?? 3;
  const tailFocus = options.tailFocus ?? 0.5;
  const tail = options.tail ?? Math.max(3, Math.round(ids.length * 0.05));
  const window = options.window ?? 8;
  const games = (id: string) => elo.games.get(id) ?? 0;
  const rating = (id: string) => elo.rating.get(id) ?? ELO_START;

  // The warm-up is a phase of the whole game; what this player just saw only narrows the choice.
  const warming = Math.min(...ids.map(games)) < warmup;
  const recent = new Set(options.recent ?? []);
  const unseen = ids.filter(id => !recent.has(id));
  const open = unseen.length >= 2 ? unseen : ids;
  const openSet = new Set(open);
  const leastSeen = () => {
    const fewest = Math.min(...open.map(games));
    return pickFrom(open.filter(id => games(id) === fewest), random);
  };

  let a: string;
  if (warming || random() >= tailFocus) {
    a = leastSeen();
  } else {
    const byRating = [...ids].sort((x, y) => rating(y) - rating(x));
    const ends = [...byRating.slice(0, tail), ...byRating.slice(-tail)].filter(id => openSet.has(id));
    a = ends.length > 0 ? pickFrom(ends, random) : leastSeen();
  }

  const lastKey = options.last ? pairKey(options.last[0], options.last[1]) : '';
  const fresh = open.filter(id => id !== a && pairKey(a, id) !== lastKey);
  const rivals = fresh.length > 0 ? fresh : ids.filter(id => id !== a);
  // Shuffled first so that level ratings — every cover, at the start — do
  // not hand the first few ids every early game.
  const nearest = shuffled(rivals, random)
    .sort((x, y) => Math.abs(rating(x) - rating(a)) - Math.abs(rating(y) - rating(a)))
    .slice(0, window);
  const least = Math.min(...nearest.map(games));
  const b = pickFrom(nearest.filter(id => games(id) === least), random);
  return random() < 0.5 ? [a, b] : [b, a];
}

/** Two different covers, uniformly — the pairing the simulation measures `nextPair` against. */
export function randomPair(ids: readonly string[], random: () => number): [string, string] | null {
  if (ids.length < 2) return null;
  const i = Math.floor(random() * ids.length);
  let j = Math.floor(random() * (ids.length - 1));
  if (j >= i) j += 1;
  return [ids[i], ids[j]];
}

function pairKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

function pickFrom<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('pick from an empty list');
  return item;
}

export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Box–Muller: one standard normal draw from two uniform ones. */
export function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/** A word to a seed, so a pool can be named instead of numbered (FNV-1a). */
export function seedNumber(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

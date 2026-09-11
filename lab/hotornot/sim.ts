/**
 * How many votes until the ugliest cover is a finding? (ROADMAP 5.8, Spielart 4.)
 *
 * Pure simulation. Every cover gets a hidden "true" appeal, drawn from a
 * normal distribution; simulated voters prefer the more appealing of two
 * covers, but not reliably — `noise` says how often they disagree with the
 * true order (a logistic choice, the Bradley–Terry model itself). Then the
 * game runs as the server runs it, and after every `pool` votes two things
 * are asked:
 *
 *   - **found**: is the true worst cover at the bottom of the fit, and does it
 *     stay there to the end?
 *   - **claimed**: would the board, with the same `standings`, the same
 *     `FINDING_SHARE` and the same `crownHeld`, say "this is the ugliest" —
 *     and when it first does, is it right? That is the pair of numbers that
 *     decides whether a claim may be posted: how long it takes, and how often
 *     it would have been false.
 *
 * What it cannot say is how much real people agree. That is measured in
 * play — `favouriteRate` over real votes — and read against the `favourite`
 * this reports for the same pairing: the row whose number matches is the row
 * that applies, and its vote counts are the forecast.
 */
import { rng } from '../../lib/loading';
import {
  applyVote, crownHeld, fitBradleyTerry, gaussian, newElo, nextPair, randomPair, standings, verdictFor,
  type Vote,
} from '../../lib/hotornot/rating';

export interface SimOptions {
  /** Covers in the pool. */
  pool: number;
  /** Logistic scale of the voters' choice, in units of the appeal's standard deviation. */
  noise: number;
  strategy: 'random' | 'adaptive';
  /** Stop after this many votes per cover. */
  votesPerCover: number;
  seed: number;
  /**
   * Checks in a row the board must name the same cover before a claim counts
   * (`crownHeld`). 1 is posting at the first crown.
   */
  hold?: number;
}

export interface SimResult {
  votes: number;
  /** Votes from which on the fitted last cover was the true last at every check; null if never. */
  worst: number | null;
  /** The same, allowing any of the true three worst. */
  worstThree: number | null;
  best: number | null;
  bestThree: number | null;
  /** Votes at which the board would first have said "this is the ugliest"; null if it never did. */
  worstClaimed: number | null;
  /** Whether that first claim named the true worst cover; null without a claim. */
  worstClaimRight: boolean | null;
  bestClaimed: number | null;
  bestClaimRight: boolean | null;
  /** Share of the later votes won by the Elo favourite — the number real play is compared with. */
  favourite: number;
  /** Share of random pairs on which a voter picks the truly better cover — what `noise` means. */
  consensus: number;
}

export function simulate(options: SimOptions): SimResult {
  const random = rng(options.seed);
  const hold = options.hold ?? 1;
  const ids = Array.from({ length: options.pool }, (_, i) => `c${i}`);
  const appeal = new Map(ids.map(id => [id, gaussian(random)]));
  const truth = [...ids].sort((x, y) => (appeal.get(y) ?? 0) - (appeal.get(x) ?? 0));
  const trueBest = truth[0];
  const trueWorst = truth[truth.length - 1];
  const bestThree = truth.slice(0, 3);
  const worstThree = truth.slice(-3);
  const prefersA = (a: string, b: string) =>
    random() < 1 / (1 + Math.exp(-((appeal.get(a) ?? 0) - (appeal.get(b) ?? 0)) / options.noise));

  const elo = newElo(ids);
  const votes: Vote[] = [];
  const total = options.pool * options.votesPerCover;
  const checks: Array<{ at: number; best: string; worst: string }> = [];
  const crownedWorst: string[] = [];
  const crownedBest: string[] = [];
  let fit: Map<string, number> | undefined;
  let last: [string, string] | undefined;
  let won = 0;
  let decided = 0;
  let worstClaimed: number | null = null;
  let worstClaimRight: boolean | null = null;
  let bestClaimed: number | null = null;
  let bestClaimRight: boolean | null = null;

  for (let n = 1; n <= total; n++) {
    const pair = options.strategy === 'adaptive' ? nextPair(ids, elo, random, { last }) : randomPair(ids, random);
    if (!pair) break;
    last = pair;
    const [a, b] = pair;
    const vote = { a, b, winner: prefersA(a, b) ? a : b };
    votes.push(vote);
    const favouriteWon = applyVote(elo, vote);
    if (n > total / 2 && favouriteWon !== undefined) {
      decided += 1;
      if (favouriteWon) won += 1;
    }
    if (n % options.pool !== 0) continue;

    fit = fitBradleyTerry(ids, votes, { start: fit, iterations: 80, tolerance: 1e-5 });
    let best = ids[0];
    let worst = ids[0];
    for (const id of ids) {
      if ((fit.get(id) ?? 0) > (fit.get(best) ?? 0)) best = id;
      if ((fit.get(id) ?? 0) < (fit.get(worst) ?? 0)) worst = id;
    }
    checks.push({ at: n, best, worst });

    if (worstClaimed === null || bestClaimed === null) {
      // The board's own judgement, with its own threshold — nothing re-derived here.
      const table = standings(ids, votes, { start: fit, draws: 100, seed: options.seed + n });
      const top = table[0];
      const bottom = table[table.length - 1];
      crownedWorst.push(verdictFor(bottom, 'worst') === 'exact' ? bottom.id : '');
      crownedBest.push(verdictFor(top, 'best') === 'exact' ? top.id : '');
      const worstCrown = crownHeld(crownedWorst, hold);
      const bestCrown = crownHeld(crownedBest, hold);
      if (worstClaimed === null && worstCrown) {
        worstClaimed = n;
        worstClaimRight = worstCrown === trueWorst;
      }
      if (bestClaimed === null && bestCrown) {
        bestClaimed = n;
        bestClaimRight = bestCrown === trueBest;
      }
    }
  }

  /** The first check of the unbroken run of correct checks that reaches the end. */
  const settledAt = (correct: (c: { best: string; worst: string }) => boolean): number | null => {
    let at: number | null = null;
    for (let i = checks.length - 1; i >= 0 && correct(checks[i]); i--) at = checks[i].at;
    return at;
  };

  return {
    votes: votes.length,
    worst: settledAt(c => c.worst === trueWorst),
    worstThree: settledAt(c => worstThree.includes(c.worst)),
    best: settledAt(c => c.best === trueBest),
    bestThree: settledAt(c => bestThree.includes(c.best)),
    worstClaimed,
    worstClaimRight,
    bestClaimed,
    bestClaimRight,
    favourite: decided ? won / decided : 0,
    consensus: consensusFor(options.noise, options.seed),
  };
}

/** Share of uniformly random pairs on which a voter picks the truly better cover. */
export function consensusFor(noise: number, seed = 1, samples = 20000): number {
  const random = rng((seed ^ 0x9e3779b9) >>> 0);
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const gap = Math.abs(gaussian(random) - gaussian(random));
    sum += 1 / (1 + Math.exp(-gap / noise));
  }
  return sum / samples;
}

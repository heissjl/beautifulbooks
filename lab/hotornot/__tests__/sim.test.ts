import { describe, expect, it } from 'vitest';
import { rng } from '../../../lib/loading';
import { CROWN_HOLD, crownHeld, crowns, randomPair, type Vote } from '../rating';
import { consensusFor, simulate } from '../sim';

const idsOf = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

/** Votes from a known order: cover i beats cover j with the Bradley–Terry probability. */
function votesFrom(strength: readonly number[], count: number, seed = 7): Vote[] {
  const random = rng(seed);
  const ids = strength.map((_, i) => `c${i}`);
  const out: Vote[] = [];
  for (let n = 0; n < count; n++) {
    const pair = randomPair(ids, random);
    if (!pair) break;
    const [a, b] = pair;
    const gap = strength[Number(a.slice(1))] - strength[Number(b.slice(1))];
    out.push({ a, b, winner: random() < 1 / (1 + Math.exp(-gap)) ? a : b });
  }
  return out;
}

describe('the simulation', () => {
  it('finds both ends when voters agree', () => {
    const result = simulate({ pool: 16, noise: 0.3, strategy: 'adaptive', votesPerCover: 40, seed: 3 });
    expect(result.worst).not.toBeNull();
    expect(result.best).not.toBeNull();
    expect(result.votes).toBe(16 * 40);
  });

  it('is the same run for the same seed', () => {
    const options = { pool: 20, noise: 1, strategy: 'random' as const, votesPerCover: 10, seed: 4 };
    expect(simulate(options)).toEqual(simulate(options));
  });

  it('turns noise into agreement the way the table claims', () => {
    expect(consensusFor(0.3)).toBeGreaterThan(consensusFor(1));
    expect(consensusFor(1)).toBeGreaterThan(consensusFor(3));
    expect(consensusFor(1000)).toBeCloseTo(0.5, 2);
  });

  it('gives the favourite fewer wins the less voters agree', () => {
    const agree = simulate({ pool: 20, noise: 0.3, strategy: 'adaptive', votesPerCover: 20, seed: 5 });
    const differ = simulate({ pool: 20, noise: 3, strategy: 'adaptive', votesPerCover: 20, seed: 5 });
    expect(agree.favourite).toBeGreaterThan(differ.favourite);
  });

  it('makes no claim when every cover has played once', () => {
    const result = simulate({ pool: 16, noise: 0.3, strategy: 'adaptive', votesPerCover: 1, seed: 6 });
    expect(result.worstClaimed).toBeNull();
    expect(result.bestClaimed).toBeNull();
  });

  it('claims the ugliest when voters agree, and is right when it does', () => {
    let made = 0;
    let wrong = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const result = simulate({ pool: 16, noise: 0.3, strategy: 'adaptive', votesPerCover: 60, seed });
      if (result.worstClaimRight === null) continue;
      made += 1;
      if (!result.worstClaimRight) wrong += 1;
    }
    expect(made).toBeGreaterThanOrEqual(8);
    expect(wrong).toBeLessThanOrEqual(1);
  });

  it('never claims earlier when a crown has to be held', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const options = { pool: 20, noise: 0.5, strategy: 'adaptive' as const, votesPerCover: 40, seed };
      const first = simulate({ ...options, hold: 1 });
      const held = simulate({ ...options, hold: 3 });
      if (held.worstClaimed === null) continue;
      expect(first.worstClaimed).not.toBeNull();
      expect(held.worstClaimed).toBeGreaterThanOrEqual(first.worstClaimed ?? 0);
    }
  });
});

describe('a crown that has to be held', () => {
  it('counts only when the same cover wore it at each of the last checks', () => {
    expect(crownHeld(['a', 'a', 'a'], 3)).toBe('a');
    expect(crownHeld(['b', 'a', 'a'], 2)).toBe('a');
    expect(crownHeld(['a', 'b', 'a'], 3)).toBeNull();
    expect(crownHeld(['a', '', 'a'], 2)).toBeNull();
    expect(crownHeld(['a', 'a'], 3)).toBeNull();
    expect(crownHeld(['', ''], 1)).toBeNull();
    expect(crownHeld(['x'], 1)).toBe('x');
  });

  it('is what the board reads: a clear end holds it for every round asked, a handful of votes for none', () => {
    const clear = crowns(idsOf(10), votesFrom(Array.from({ length: 10 }, (_, i) => 1.2 * i), 3000), { step: 10 });
    expect(clear.worst).toEqual({ id: 'c0', held: CROWN_HOLD });
    expect(clear.best).toEqual({ id: 'c9', held: CROWN_HOLD });
    const thin = crowns(idsOf(10), votesFrom(Array.from({ length: 10 }, (_, i) => 0.3 * i), 15), { step: 10 });
    expect(thin.worst.held).toBe(0);
    expect(thin.best.held).toBe(0);
  });
});

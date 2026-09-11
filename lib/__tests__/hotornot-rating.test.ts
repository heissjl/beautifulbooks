import { describe, expect, it } from 'vitest';
import { rng } from '../loading';
import {
  ELO_START, MIN_APPEAL, applyVote, empiricalPrior, expectedScore, favouriteRate, fitBradleyTerry,
  newElo, nextPair, randomPair, standings, strengthSpread, verdictFor, type Standing, type Vote,
} from '../hotornot/rating';

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

const idsOf = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

describe('Elo', () => {
  it('expects even odds between equals and 10:1 at four hundred points', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1900, 1500)).toBeCloseTo(10 / 11, 6);
    expect(expectedScore(1600, 1500) + expectedScore(1500, 1600)).toBeCloseTo(1, 12);
  });

  it('moves points from loser to winner and nothing else', () => {
    const state = newElo(['x', 'y']);
    expect(applyVote(state, { a: 'x', b: 'y', winner: 'x' })).toBeUndefined();
    const x = state.rating.get('x') ?? 0;
    const y = state.rating.get('y') ?? 0;
    expect(x).toBeGreaterThan(ELO_START);
    expect(x + y).toBeCloseTo(2 * ELO_START, 9);
    expect(state.games.get('x')).toBe(1);
    // x is now the favourite; its next win is the favourite winning.
    expect(applyVote(state, { a: 'y', b: 'x', winner: 'x' })).toBe(true);
    expect(applyVote(state, { a: 'y', b: 'x', winner: 'y' })).toBe(false);
  });
});

describe('Bradley–Terry', () => {
  it('recovers a known order from noisy votes', () => {
    const strength = [-3, -2, -1, 0, 1, 2, 3];
    const fit = fitBradleyTerry(idsOf(7), votesFrom(strength, 4000));
    const order = idsOf(7).sort((x, y) => (fit.get(x) ?? 0) - (fit.get(y) ?? 0));
    expect(order).toEqual(idsOf(7));
  });

  it('stays finite for a cover that never won', () => {
    const votes: Vote[] = Array.from({ length: 20 }, (_, i) => ({ a: 'c0', b: `c${1 + (i % 3)}`, winner: `c${1 + (i % 3)}` }));
    const fit = fitBradleyTerry(idsOf(4), votes);
    expect([...fit.values()].every(Number.isFinite)).toBe(true);
    expect(Math.min(...fit.values())).toBe(fit.get('c0'));
  });

  it('puts an unseen cover at the average, not at an end', () => {
    const fit = fitBradleyTerry(idsOf(3), [{ a: 'c0', b: 'c1', winner: 'c0' }]);
    expect(fit.get('c2')).toBeCloseTo(0, 6);
    expect(fit.get('c0') ?? 0).toBeGreaterThan(0);
    expect(fit.get('c1') ?? 0).toBeLessThan(0);
  });

  it('is surer about a cover the more it has played', () => {
    const votes = votesFrom([0, 0, 0, 0], 400);
    const few = strengthSpread(idsOf(4), votes.slice(0, 8), fitBradleyTerry(idsOf(4), votes.slice(0, 8)));
    const many = strengthSpread(idsOf(4), votes, fitBradleyTerry(idsOf(4), votes));
    expect(many.get('c0') ?? 0).toBeLessThan((few.get('c0') ?? 0) / 3);
  });
});

describe('how much the covers differ', () => {
  it('assumes they are alike until the votes show otherwise', () => {
    expect(empiricalPrior(idsOf(10), []).appeal).toBe(MIN_APPEAL);
    const few = votesFrom(Array.from({ length: 10 }, (_, i) => 0.3 * i), 15);
    expect(empiricalPrior(idsOf(10), few).appeal).toBe(MIN_APPEAL);
  });

  it('reads the real spread off plenty of votes', () => {
    // Twenty covers evenly from -1.7 to +1.7: a standard deviation of about one.
    const strength = Array.from({ length: 20 }, (_, i) => -1.7 + (3.4 * i) / 19);
    const { appeal } = empiricalPrior(idsOf(20), votesFrom(strength, 6000));
    expect(appeal).toBeGreaterThan(0.75);
    expect(appeal).toBeLessThan(1.3);
  });

  it('finds almost no spread where every vote is a coin flip', () => {
    const { appeal } = empiricalPrior(idsOf(20), votesFrom(new Array(20).fill(0), 6000));
    expect(appeal).toBeLessThan(0.35);
  });
});

describe('standings and what may be said about them', () => {
  it('holds a clear end in nearly every plausible ranking and sorts best first', () => {
    const strength = Array.from({ length: 10 }, (_, i) => 1.2 * i);
    const table = standings(idsOf(10), votesFrom(strength, 3000));
    expect(table[0].id).toBe('c9');
    expect(table[table.length - 1].id).toBe('c0');
    expect(table[table.length - 1].last).toBeGreaterThanOrEqual(0.9);
    expect(verdictFor(table[table.length - 1], 'worst')).toBe('exact');
  });

  it('does not crown anything on a handful of votes', () => {
    const strength = Array.from({ length: 10 }, (_, i) => 0.3 * i);
    const table = standings(idsOf(10), votesFrom(strength, 15));
    expect(verdictFor(table[table.length - 1], 'worst')).toBe('open');
  });

  it('does not crown a cover for losing its only three games', () => {
    // The case that retired the bootstrap: those three losses come back in
    // nearly every resample of the votes, so the cover sat last almost every
    // time. Three losses in a row happen to an average cover one time in eight.
    const votes: Vote[] = [
      { a: 'c0', b: 'c1', winner: 'c1' }, { a: 'c0', b: 'c2', winner: 'c2' }, { a: 'c0', b: 'c3', winner: 'c3' },
      { a: 'c4', b: 'c5', winner: 'c4' }, { a: 'c6', b: 'c7', winner: 'c7' }, { a: 'c8', b: 'c9', winner: 'c9' },
    ];
    const table = standings(idsOf(10), votes);
    expect(table[table.length - 1].id).toBe('c0');
    expect(verdictFor(table[table.length - 1], 'worst')).toBe('open');
  });

  it('crowns nothing before anyone has voted', () => {
    const table = standings(idsOf(10), []);
    expect(verdictFor(table[0], 'best')).toBe('open');
    expect(verdictFor(table[table.length - 1], 'worst')).toBe('open');
  });

  it('separates "this one" from "one of the three"', () => {
    const base: Standing = { id: 'x', strength: 0, games: 9, first: 0, topThree: 0, last: 0, bottomThree: 0 };
    expect(verdictFor({ ...base, last: 0.93, bottomThree: 1 }, 'worst')).toBe('exact');
    expect(verdictFor({ ...base, last: 0.5, bottomThree: 0.95 }, 'worst')).toBe('three');
    expect(verdictFor({ ...base, first: 0.6, topThree: 0.7 }, 'best')).toBe('open');
  });
});

describe('the next pair', () => {
  it('never pairs a cover with itself and only uses the covers it is given', () => {
    const random = rng(3);
    const state = newElo(idsOf(6));
    for (let i = 0; i < 200; i++) {
      const pair = nextPair(['c1', 'c2', 'c4'], state, random);
      expect(pair).not.toBeNull();
      const [a, b] = pair ?? ['', ''];
      expect(a).not.toBe(b);
      expect(['c1', 'c2', 'c4']).toContain(a);
      expect(['c1', 'c2', 'c4']).toContain(b);
    }
    expect(nextPair(['c1'], state, random)).toBeNull();
  });

  it('spreads the early games over the whole pool', () => {
    const random = rng(5);
    const state = newElo(idsOf(40));
    for (let i = 0; i < 60; i++) {
      const pair = nextPair(idsOf(40), state, random);
      if (!pair) break;
      applyVote(state, { a: pair[0], b: pair[1], winner: pair[0] });
    }
    // 60 games are 120 appearances: every one of the forty covers has played.
    expect(Math.min(...state.games.values())).toBeGreaterThanOrEqual(1);
  });

  it('does not show the same pair twice in a row when there is a choice', () => {
    const random = rng(9);
    const state = newElo(idsOf(3));
    let last: [string, string] | undefined;
    for (let i = 0; i < 100; i++) {
      const pair = nextPair(idsOf(3), state, random, { last });
      if (!pair) break;
      if (last) expect([...pair].sort()).not.toEqual([...last].sort());
      last = pair;
    }
  });

  it('puts the least-seen cover on either side, not always the left', () => {
    const random = rng(11);
    let left = 0;
    for (let i = 0; i < 400; i++) {
      const state = newElo(idsOf(5));
      state.games.set('c0', -1);
      const pair = nextPair(idsOf(5), state, random);
      if (pair?.[0] === 'c0') left += 1;
    }
    expect(left).toBeGreaterThan(140);
    expect(left).toBeLessThan(260);
  });

  // Julian, 2026-09-11: covers came back too often in a row. A player who keeps
  // skipping — skipping plays no game — used to get the same least-seen cover at once.
  it('shows no cover twice within twenty-five pairs of 200, even to a player who only skips', () => {
    const ids = idsOf(200);
    for (const warm of [false, true]) {
      const random = rng(warm ? 17 : 19);
      const state = newElo(ids);
      if (warm) for (const id of ids) state.games.set(id, 5); // past the warm-up: the ends get attention
      const seen: string[] = [];
      for (let i = 0; i < 60; i++) {
        const pair = nextPair(ids, state, random, { recent: seen.slice(-50) });
        if (!pair) break;
        for (const id of pair) expect(seen.slice(-50)).not.toContain(id);
        seen.push(...pair);
      }
    }
  });

  it('shows a seen cover again rather than nothing, once every cover was seen', () => {
    const random = rng(23);
    const state = newElo(idsOf(4));
    const pair = nextPair(idsOf(4), state, random, { recent: idsOf(4) });
    expect(pair).not.toBeNull();
  });
});

describe('consensus', () => {
  it('is near one when the better cover always wins, and near a half when nobody agrees', () => {
    const strength = Array.from({ length: 20 }, (_, i) => i);
    const random = rng(13);
    const ids = idsOf(20);
    const sure: Vote[] = [];
    const coin: Vote[] = [];
    for (let n = 0; n < 2000; n++) {
      const pair = randomPair(ids, random);
      if (!pair) break;
      const [a, b] = pair;
      sure.push({ a, b, winner: strength[Number(a.slice(1))] > strength[Number(b.slice(1))] ? a : b });
      coin.push({ a, b, winner: random() < 0.5 ? a : b });
    }
    expect(favouriteRate(ids, sure).rate).toBeGreaterThan(0.9);
    expect(favouriteRate(ids, coin).rate).toBeGreaterThan(0.4);
    expect(favouriteRate(ids, coin).rate).toBeLessThan(0.6);
  });
});

import { describe, expect, it } from 'vitest';
import { buildRound, compare, rng, seedNumber, shuffled, type DuelBook } from '../seed';

const pool: DuelBook[] = Array.from({ length: 40 }, (_, i) => ({
  id: `OL${i}W`,
  title: `Book ${i}`,
  author: `Author ${i % 7}`,
  coverIds: Array.from({ length: 8 }, (_, k) => `ol:${i}-${k}`),
}));

describe('the same link gives the same round', () => {
  it('is identical for the same seed and different for another', () => {
    const a = buildRound('paperwhite', pool);
    const b = buildRound('paperwhite', pool);
    const c = buildRound('paperblack', pool);
    expect(a).toEqual(b);
    expect(a.books.map(x => x.id)).not.toEqual(c.books.map(x => x.id));
  });

  it('offers the same covers in the same order to both players', () => {
    const a = buildRound('x', pool).books[0];
    const b = buildRound('x', pool).books[0];
    expect(a.choices).toEqual(b.choices);
    expect(new Set(a.choices).size).toBe(a.choices.length);
  });

  it('keeps the question the same size, skipping books that cannot fill it', () => {
    const thin = [...pool, { id: 'OLthin', title: 'Thin', author: 'A', coverIds: ['ol:1', 'ol:2'] }];
    const round = buildRound('s', thin, { books: 5, choices: 6 });
    expect(round.books).toHaveLength(5);
    expect(round.books.every(b => b.choices.length === 6)).toBe(true);
    expect(round.books.map(b => b.id)).not.toContain('OLthin');
  });

  it('asks for no more books than the pool holds', () => {
    expect(buildRound('s', pool.slice(0, 3), { books: 10 }).books).toHaveLength(3);
  });
});

describe('the generator itself', () => {
  it('is stable, so two machines see one round', () => {
    const next = rng(seedNumber('beautiful'));
    // Fixed values, so a change to the generator shows up as a failing test
    // rather than as two friends silently seeing different rounds.
    expect([next(), next(), next()].map(n => n.toFixed(6))).toEqual(['0.775142', '0.971098', '0.415285']);
  });
  it('shuffles without losing or duplicating anything', () => {
    const out = shuffled([1, 2, 3, 4, 5], rng(7));
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('comparing two players', () => {
  const round = buildRound('s', pool, { books: 4, choices: 6 });
  const ids = round.books.map(b => b.id);

  it('counts only what both answered, and names the chance line', () => {
    const a = { [ids[0]]: 'x', [ids[1]]: 'y', [ids[2]]: 'z' };
    const b = { [ids[0]]: 'x', [ids[1]]: 'other', [ids[3]]: 'q' };
    const result = compare(round, a, b);
    expect(result.answered).toBe(2);
    expect(result.same).toBe(1);
    expect(result.rate).toBeCloseTo(0.5);
    expect(result.chance).toBeCloseTo(1 / 6);
    expect(result.sameBooks).toEqual([ids[0]]);
  });

  it('says nothing rather than something when nobody has answered', () => {
    expect(compare(round, {}, {})).toMatchObject({ answered: 0, rate: 0, chance: 0 });
  });
});

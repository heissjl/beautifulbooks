import { describe, expect, it } from 'vitest';
import { DENSE_AT } from '../walls/dense';
import { budgetCents, budgetMail, budgetState, crossed, PHOTO_BUDGET_CENTS, spendUnits, UNITS_PER_CENT } from '../walls/photobudget';
import { denseAt } from '../walls/readphoto';
import { memoryWallStore } from '../walls/store';

const cents = (n: number) => n * UNITS_PER_CENT;

describe('the day\'s budget for reading photos (5.11a)', () => {
  it('reckons a read from its tokens at its model\'s list price: an ordinary photo about a cent and a half, a dense one about nine', () => {
    expect(spendUnits('claude-sonnet-5', 3189, 926) / UNITS_PER_CENT).toBeCloseTo(1.56, 1);
    expect(spendUnits('claude-sonnet-5', 14592, 6069) / UNITS_PER_CENT).toBeCloseTo(8.99, 1);
  });

  it('reckons a model the price table does not know at the dearest price, never at nothing', () => {
    expect(spendUnits('claude-unknown-9', 1_000_000, 0)).toBe(5 * 100 * UNITS_PER_CENT);
  });

  it('takes the budget from the environment, and the default when that says nothing sensible', () => {
    expect(budgetCents({})).toBe(PHOTO_BUDGET_CENTS);
    expect(budgetCents({ PHOTO_BUDGET_CENTS: '50' })).toBe(50);
    expect(budgetCents({ PHOTO_BUDGET_CENTS: 'lots' })).toBe(PHOTO_BUDGET_CENTS);
    expect(budgetCents({ PHOTO_BUDGET_CENTS: '0' })).toBe(PHOTO_BUDGET_CENTS);
  });

  it('is open, then past half (one look only), then used up', () => {
    expect(budgetState(cents(99.9), 200)).toBe('open');
    expect(budgetState(cents(100), 200)).toBe('half');
    expect(budgetState(cents(199.9), 200)).toBe('half');
    expect(budgetState(cents(200), 200)).toBe('full');
  });

  it('names the thresholds a read crossed, each once', () => {
    expect(crossed(cents(10), cents(20), 200)).toEqual([]);
    expect(crossed(cents(95), cents(108), 200)).toEqual(['half']);
    expect(crossed(cents(150), cents(160), 200)).toEqual([]);
    expect(crossed(cents(195), cents(208), 200)).toEqual(['full']);
    // A budget so small that one dense photo passes both.
    expect(crossed(0, cents(13), 10)).toEqual(['half', 'full']);
  });

  it('writes a mail with the numbers, what happens now and how to change it — nothing about a reader', () => {
    const half = budgetMail('half', { day: '2026-10-04', spentCents: 101.3, budget: 200, photos: 41, site: 'Site' });
    expect(half.subject).toBe("Site: half of today's photo budget is spent");
    expect(half.text).toContain('101.3 ct of 200 ct');
    expect(half.text).toContain('read once instead of twice');
    const full = budgetMail('full', { day: '2026-10-04', spentCents: 200.4, budget: 200, photos: 90, site: 'Site' });
    expect(full.subject).toContain('photos are off for today');
    expect(full.text).toContain('PHOTO_BUDGET_CENTS');
    expect(full.text).toContain('Anthropic console');
  });

  it('adds up a day in the store, and only asks with 0', async () => {
    const store = memoryWallStore();
    expect(await store.spendPhoto('2026-10-04', 0)).toBe(0);
    expect(await store.spendPhoto('2026-10-04', 2350)).toBe(2350);
    expect(await store.spendPhoto('2026-10-04', 13480)).toBe(15830);
    expect(await store.spendPhoto('2026-10-04', 0)).toBe(15830);
    expect(await store.spendPhoto('2026-10-05', 0)).toBe(0);
  });

  it('reads a photo twice from thirty books on, unless the environment says otherwise or off', () => {
    expect(DENSE_AT).toBe(30);
    expect(denseAt({})).toBe(30);
    expect(denseAt({ PHOTO_DENSE_AT: '60' })).toBe(60);
    expect(denseAt({ PHOTO_DENSE_AT: 'off' })).toBeUndefined();
    expect(denseAt({ PHOTO_DENSE_AT: '0' })).toBeUndefined();
    expect(denseAt({ PHOTO_DENSE_AT: 'many' })).toBe(30);
  });
});

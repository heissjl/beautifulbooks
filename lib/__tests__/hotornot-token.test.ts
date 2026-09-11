import { describe, expect, it } from 'vitest';
import { PAIR_TTL_SECONDS, pairSecret, signPair, verifyPair } from '../hotornot/token';

const secret = pairSecret('store-token');
const now = Date.UTC(2026, 8, 11, 12);

describe('signed pairs', () => {
  it('accept the pair they were issued for', () => {
    const token = signPair(secret, 'mix', 'ol:1', 'ol:2', now);
    expect(verifyPair(secret, 'mix', 'ol:1', 'ol:2', token, now + 5000)).toBe(true);
  });

  it('refuse another pair, another order, another pool or another key', () => {
    const token = signPair(secret, 'mix', 'ol:1', 'ol:2', now);
    expect(verifyPair(secret, 'mix', 'ol:1', 'ol:3', token, now)).toBe(false);
    expect(verifyPair(secret, 'mix', 'ol:2', 'ol:1', token, now)).toBe(false);
    expect(verifyPair(secret, 'other', 'ol:1', 'ol:2', token, now)).toBe(false);
    expect(verifyPair(pairSecret('another-store'), 'mix', 'ol:1', 'ol:2', token, now)).toBe(false);
  });

  it('refuse a token whose nonce was swapped', () => {
    const [issued, , mac] = signPair(secret, 'mix', 'ol:1', 'ol:2', now).split('.');
    expect(verifyPair(secret, 'mix', 'ol:1', 'ol:2', `${issued}.AAAAAAAAAAAA.${mac}`, now)).toBe(false);
  });

  // Two players shown the same pair in the same second must both be able to vote.
  it('are a new token every time, even for the same pair in the same second', () => {
    const first = signPair(secret, 'mix', 'ol:1', 'ol:2', now);
    const second = signPair(secret, 'mix', 'ol:1', 'ol:2', now);
    expect(first).not.toBe(second);
    expect(verifyPair(secret, 'mix', 'ol:1', 'ol:2', first, now)).toBe(true);
    expect(verifyPair(secret, 'mix', 'ol:1', 'ol:2', second, now)).toBe(true);
  });

  it('expire after an hour, and refuse anything that is not a token', () => {
    const token = signPair(secret, 'mix', 'ol:1', 'ol:2', now);
    expect(verifyPair(secret, 'mix', 'ol:1', 'ol:2', token, now + (PAIR_TTL_SECONDS + 1) * 1000)).toBe(false);
    for (const bad of ['', 'nodot', 'a.b', '.x.y', 'abc.def.ghi', `${Math.floor(now / 1000)}..x`, `${Math.floor(now / 1000)}.n.`]) {
      expect(verifyPair(secret, 'mix', 'ol:1', 'ol:2', bad, now)).toBe(false);
    }
  });

  it('share one key across instances of a deployment, and keep one per process without a store', () => {
    expect(pairSecret('store-token').equals(pairSecret('store-token'))).toBe(true);
    expect(pairSecret(undefined).equals(pairSecret(undefined))).toBe(true);
    expect(pairSecret(undefined).equals(pairSecret('store-token'))).toBe(false);
  });
});

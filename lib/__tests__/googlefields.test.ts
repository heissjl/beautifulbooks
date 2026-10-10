/**
 * Google's field search answering nothing (ROADMAP 1.13, lib/googlefields.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANARY_ISBNS, FIELD_BROKEN_MS, FIELD_OK_MS, fieldSearchBroken, fieldSearchKnownBroken, resetGoogleFields } from '../googlefields';

const T0 = 1_700_000_000_000;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetGoogleFields();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('fieldSearchBroken', () => {
  it('holds the field search broken for an hour when both canaries answer nothing, and logs once', async () => {
    const asked: string[] = [];
    const empty = async (isbn: string) => { asked.push(isbn); return 0; };
    expect(await fieldSearchBroken(empty, T0)).toBe(true);
    expect(asked).toEqual([...CANARY_ISBNS]);
    expect(fieldSearchKnownBroken(T0 + FIELD_BROKEN_MS - 1)).toBe(true);
    expect(fieldSearchKnownBroken(T0 + FIELD_BROKEN_MS)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('field-search-empty');
    // While broken, nothing is asked again.
    expect(await fieldSearchBroken(empty, T0 + 1000)).toBe(true);
    expect(asked).toHaveLength(2);
  });

  it('trusts an empty answer when a canary is listed, for a day', async () => {
    const asked: string[] = [];
    const first = async (isbn: string) => { asked.push(isbn); return isbn === CANARY_ISBNS[0] ? 3 : 0; };
    expect(await fieldSearchBroken(first, T0)).toBe(false);
    expect(asked).toHaveLength(1);
    expect(await fieldSearchBroken(first, T0 + FIELD_OK_MS - 1)).toBe(false);
    expect(asked).toHaveLength(1);
    expect(fieldSearchKnownBroken(T0)).toBe(false);
  });

  it('one canary listed is enough: the day Google drops one, the breaker stays shut', async () => {
    const second = async (isbn: string) => (isbn === CANARY_ISBNS[1] ? 1 : 0);
    expect(await fieldSearchBroken(second, T0)).toBe(false);
  });

  it('a failing canary is no evidence, and concurrent callers share one check', async () => {
    let asks = 0;
    const failing = async () => { asks += 1; throw new Error('503'); };
    const [a, b] = await Promise.all([fieldSearchBroken(failing, T0), fieldSearchBroken(failing, T0)]);
    expect(a).toBe(false);
    expect(b).toBe(false);
    expect(asks).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });
});

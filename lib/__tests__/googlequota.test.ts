/**
 * The Google quota breaker (SPEC §8.7 point 5, lib/googlequota.ts).
 *
 * The quota read from the Cloud console on 2026-09-07 is 1,000 requests a
 * day, so running into it is a question of when, not whether. What matters
 * here is that the breaker opens on the right refusal and stays shut on the
 * wrong one: a bad API key must not disable Google for a day.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyQuotaError, googleAvailable, googlePausedFor, noteGoogleFailure,
  pacificMsUntilReset, RATE_PAUSE_MS, resetGoogleQuota,
} from '../googlequota';
import { HttpError } from '../sources/http';

const DAILY = JSON.stringify({
  error: { code: 403, errors: [{ reason: 'dailyLimitExceeded', message: 'Daily Limit Exceeded' }] },
});
const RATE = JSON.stringify({
  error: { code: 403, errors: [{ reason: 'userRateLimitExceeded' }] },
});
const BAD_KEY = JSON.stringify({
  error: { code: 403, errors: [{ reason: 'forbidden', message: 'API key not valid' }] },
});

/**
 * The breaker writes an ungated line when it opens, so every test that opens
 * it would print into the run. The spy keeps the output readable and gives the
 * log test something to look at.
 */
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  resetGoogleQuota();
});

describe('classifyQuotaError', () => {
  it('tells an exhausted day from a busy minute, by the reason not the status', () => {
    expect(classifyQuotaError(new HttpError(403, 'u', DAILY))).toBe('daily');
    // Google sends the same reason with either status; the reason decides.
    expect(classifyQuotaError(new HttpError(429, 'u', DAILY))).toBe('daily');
    expect(classifyQuotaError(new HttpError(403, 'u', RATE))).toBe('rate');
  });

  it('leaves a bad key alone, so it fails loudly instead of silently', () => {
    expect(classifyQuotaError(new HttpError(403, 'u', BAD_KEY))).toBe('other');
    expect(classifyQuotaError(new HttpError(503, 'u', ''))).toBe('other');
    expect(classifyQuotaError(new Error('network'))).toBe('other');
  });

  it('treats an unexplained 429 as busy, never as the day being over', () => {
    expect(classifyQuotaError(new HttpError(429, 'u', ''))).toBe('rate');
  });
});

describe('noteGoogleFailure', () => {
  it('shuts Google out for the rest of the Pacific day', () => {
    const now = Date.UTC(2026, 8, 7, 12, 0, 0);
    expect(noteGoogleFailure(new HttpError(403, 'u', DAILY), now)).toBe('daily');
    expect(googleAvailable(now)).toBe(false);
    expect(googleAvailable(now + 60 * 60 * 1000)).toBe(false);
    // Never longer than a day, whatever the timezone arithmetic says.
    expect(googleAvailable(now + 25 * 60 * 60 * 1000)).toBe(true);
  });

  it('pauses only briefly for a rate limit', () => {
    const now = 1_000_000;
    expect(noteGoogleFailure(new HttpError(403, 'u', RATE), now)).toBe('rate');
    expect(googleAvailable(now)).toBe(false);
    expect(googlePausedFor(now)).toBe(RATE_PAUSE_MS / 1000);
    expect(googleAvailable(now + RATE_PAUSE_MS)).toBe(true);
  });

  it('does not open on anything else', () => {
    const now = 2_000_000;
    expect(noteGoogleFailure(new HttpError(403, 'u', BAD_KEY), now)).toBe('other');
    expect(noteGoogleFailure(new HttpError(503, 'u', ''), now)).toBe('other');
    expect(googleAvailable(now)).toBe(true);
  });

  it('never shortens a pause that is already longer', () => {
    const now = Date.UTC(2026, 8, 7, 12, 0, 0);
    noteGoogleFailure(new HttpError(403, 'u', DAILY), now);
    const remaining = googlePausedFor(now);
    noteGoogleFailure(new HttpError(403, 'u', RATE), now);
    expect(googlePausedFor(now)).toBe(remaining);
  });
});

describe('the line the breaker writes', () => {
  it('says which limit and how long, once per opening', () => {
    const now = Date.UTC(2026, 8, 7, 12, 0, 0);
    noteGoogleFailure(new HttpError(403, 'u', DAILY), now);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(line.startsWith('bb.google ')).toBe(true);
    const payload = JSON.parse(line.slice('bb.google '.length));
    expect(payload.event).toBe('daily-limit');
    expect(payload.pausedForS).toBe(Math.round(pacificMsUntilReset(new Date(now)) / 1000));
    // A second refusal inside the same pause is the same event, not a new one.
    noteGoogleFailure(new HttpError(403, 'u', DAILY), now + 1000);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a refusal that is not about the quota', () => {
    noteGoogleFailure(new HttpError(403, 'u', BAD_KEY), 3_000_000);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('pacificMsUntilReset', () => {
  it('counts to the next midnight in Los Angeles, not here', () => {
    // 09:30 UTC on 7 September is 02:30 in Los Angeles (PDT, UTC-7).
    vi.useFakeTimers();
    const ms = pacificMsUntilReset(new Date(Date.UTC(2026, 8, 7, 9, 30, 0)));
    expect(Math.round(ms / 60000)).toBe(21 * 60 + 30);
    vi.useRealTimers();
  });

  it('always returns something between nothing and a full day', () => {
    for (const hour of [0, 5, 11, 17, 23]) {
      const ms = pacificMsUntilReset(new Date(Date.UTC(2026, 8, 7, hour, 0, 0)));
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    }
  });
});

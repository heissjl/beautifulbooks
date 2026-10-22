/** The uptime report (ROADMAP 2.18g, lib/health.ts). */
import { describe, expect, it } from 'vitest';
import { healthReport } from '../health';

describe('healthReport', () => {
  it('is ok when the store answers, whatever Google does', () => {
    const r = healthReport({ redisConfigured: true, redisMs: 34, googlePausedS: 3600, googleFieldsBroken: false });
    expect(r.ok).toBe(true);
    expect(r.text).toContain('status: ok');
    expect(r.text).toContain('redis: ok (34 ms)');
    expect(r.text).toContain('google: paused 3600 s');
  });
  it('is degraded when the store is silent or missing', () => {
    expect(healthReport({ redisConfigured: true, redisMs: null, googlePausedS: 0, googleFieldsBroken: false })).toMatchObject({ ok: false });
    const missing = healthReport({ redisConfigured: false, redisMs: null, googlePausedS: 0, googleFieldsBroken: true });
    expect(missing.ok).toBe(false);
    expect(missing.text).toContain('redis: not configured');
    expect(missing.text).toContain('google: field search answers nothing');
  });
  it('never says ok in a degraded report, so a keyword monitor cannot be fooled', () => {
    const r = healthReport({ redisConfigured: true, redisMs: null, googlePausedS: 0, googleFieldsBroken: false });
    expect(r.text).not.toMatch(/status: ok/);
  });
  it('adds the fill level as lines of numbers, and a list over its line as one more — status untouched (2.18g)', () => {
    const fill = { keys: 12, votes: 2_500_000, walls: 3, drafts: 2, suggestions: 1, contentBytes: 2048 };
    const r = healthReport({ redisConfigured: true, redisMs: 20, googlePausedS: 0, googleFieldsBroken: false, fill });
    expect(r.ok).toBe(true);
    expect(r.text).toContain('store: 12 keys, votes 2500000, walls 3, drafts 2, suggestions 1, published drafts 2 KB');
    expect(r.text).toContain('fill: votes 2500000 over 2000000');
    const quiet = healthReport({ redisConfigured: true, redisMs: 20, googlePausedS: 0, googleFieldsBroken: false, fill: null });
    expect(quiet.text).not.toContain('store:');
  });
});

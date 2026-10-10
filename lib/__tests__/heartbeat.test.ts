/** The morning mail (ROADMAP 2.18g, lib/heartbeat.ts). */
import { describe, expect, it } from 'vitest';
import { heartbeatMail } from '../heartbeat';

describe('heartbeatMail', () => {
  it('names yesterday’s two totals and the state of store and Google', () => {
    const m = heartbeatMail({ day: '2026-10-09', bookVisits: 42, shopClicks: 3, redisMs: 30, googlePausedS: 0, googleFieldsBroken: true });
    expect(m.subject).toContain('42 book visits, 3 shop clicks');
    expect(m.subject).not.toContain('off');
    expect(m.text).toContain('the store answered in 30 ms');
    expect(m.text).toContain('field search answers nothing');
  });
  it('says so in the subject when the store could not be read, never a zero', () => {
    const m = heartbeatMail({ day: '2026-10-09', bookVisits: null, shopClicks: null, redisMs: null, googlePausedS: 0, googleFieldsBroken: false });
    expect(m.subject).toContain('could not be read');
    expect(m.subject).toContain('something is off');
    expect(m.text).not.toMatch(/visits: 0/);
  });
});

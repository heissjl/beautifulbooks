import { beforeEach, describe, expect, it } from 'vitest';
import { googleQuotaMail, resetAlerts, sendAlert } from '../alerts';

const mail = { subject: 'S', text: 'T' };
const env = { RESEND_API_KEY: 'k', IMPRINT_EMAIL: 'j@x.test' };
const recorder = () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response('{}');
  }) as unknown as typeof fetch;
  return { calls, fake };
};

describe('alerts: a mail when something limited runs out', () => {
  beforeEach(() => resetAlerts());

  it('sends nothing, and says so, without a key or an address', async () => {
    const { calls, fake } = recorder();
    expect(await sendAlert('a:1', mail, { IMPRINT_EMAIL: 'j@x.test' }, fake, null)).toBe('not-configured');
    expect(await sendAlert('a:1', mail, { RESEND_API_KEY: 'k' }, fake, null)).toBe('not-configured');
    expect(calls).toHaveLength(0);
  });

  it('sends once per key, to ALERT_TO before the other addresses', async () => {
    const { calls, fake } = recorder();
    expect(await sendAlert('photo-full:2026-10-04', mail, { ...env, ALERT_TO: 'alerts@x.test', WALLS_REPORT_TO: 'r@x.test' }, fake, null)).toBe('sent');
    expect(await sendAlert('photo-full:2026-10-04', mail, env, fake, null)).toBe('already');
    expect(await sendAlert('photo-full:2026-10-05', mail, env, fake, null)).toBe('sent');
    expect(calls.map((c) => c.body.to)).toEqual([['alerts@x.test'], ['j@x.test']]);
    expect(calls[0].body).toMatchObject({ subject: 'S', text: 'T' });
  });

  it('asks the store, so a second instance does not send again', async () => {
    const { calls, fake } = recorder();
    const taken = { setNx: async () => null };
    expect(await sendAlert('k:1', mail, env, fake, taken)).toBe('already');
    expect(calls).toHaveLength(0);
    const free = { setNx: async () => 'OK' };
    expect(await sendAlert('k:2', mail, env, fake, free)).toBe('sent');
  });

  it('sends rather than stays silent when the store does not answer, and reports a failed mail as failed', async () => {
    const { calls, fake } = recorder();
    const down = { setNx: async () => { throw new Error('down'); } };
    expect(await sendAlert('k:3', mail, env, fake, down)).toBe('sent');
    expect(calls).toHaveLength(1);
    const refuse = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
    expect(await sendAlert('k:4', mail, env, refuse, null)).toBe('failed');
  });

  it('says what stops and what does not when the Google quota is gone, and nothing it has not checked', () => {
    const m = googleQuotaMail(new Date('2026-10-05T07:00:00Z'));
    expect(m.text).toContain('2026-10-05T07:00:00.000Z');
    expect(m.text).toContain('never "no image on record"');
    expect(m.text).not.toMatch(/\b(all|every|complete)\b/i);
  });
});

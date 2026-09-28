import { describe, expect, it } from 'vitest';
import { afterReport, AUTO_HIDE_REPORTS, moderate, type PublicWall } from '../walls/model';
import { reportMailText, sendReportMail } from '../walls/notify';

const shown: PublicWall = { id: 'aaaaaaaaaa', title: 'Train reading', columns: 4, tiles: [], createdOn: 'd', updatedAt: 't', showcase: 'shown' };

describe('reports (5.13d)', () => {
  it('takes a collection down at the fifth report and marks why', () => {
    expect(afterReport(shown, AUTO_HIDE_REPORTS - 1, 'n')).toBe(shown);
    expect(afterReport(shown, undefined as unknown as number, 'n')).toBe(shown);
    expect(afterReport(shown, Number.NaN, 'n')).toBe(shown);
    expect(afterReport(shown, AUTO_HIDE_REPORTS, 'n')).toMatchObject({ showcase: 'hidden', hiddenBy: 'reports' });
    expect(moderate(afterReport(shown, 5, 'n'), 'shown', 'n')).not.toHaveProperty('hiddenBy');
    expect(moderate(shown, 'hidden', 'n').hiddenBy).toBe('julian');
  });

  it('writes a mail that names the collection and the way to act, nothing about the reporter', () => {
    const first = reportMailText({ id: 'aaaaaaaaaa', title: 'Train reading', reports: 1, hidden: false, origin: 'https://x.test' });
    expect(first.subject).toBe('A collection was reported: Train reading');
    expect(first.text).toContain('https://x.test/c/aaaaaaaaaa');
    expect(first.text).toContain('https://x.test/create/review');
    expect(reportMailText({ id: 'a', title: 'T', reports: 5, hidden: true, origin: '' }).subject).toContain('taken down after 5 reports');
  });

  it('sends nothing, and says so, without a key', async () => {
    const calls: unknown[] = [];
    const fake = (async (...a: unknown[]) => { calls.push(a); return new Response('{}'); }) as typeof fetch;
    const mail = { id: 'a', title: 'T', reports: 1, hidden: false, origin: '' };
    expect(await sendReportMail(mail, { IMPRINT_EMAIL: 'j@x.test' }, fake)).toBe('not-configured');
    expect(calls).toHaveLength(0);
    expect(await sendReportMail(mail, { RESEND_API_KEY: 'k', IMPRINT_EMAIL: 'j@x.test' }, fake)).toBe('sent');
    const body = JSON.parse(String((calls[0] as [string, RequestInit])[1].body));
    expect(body.to).toEqual(['j@x.test']);
    expect(await sendReportMail(mail, { RESEND_API_KEY: 'k', IMPRINT_EMAIL: 'j@x.test' }, (async () => new Response('', { status: 500 })) as typeof fetch)).toBe('failed');
  });
});

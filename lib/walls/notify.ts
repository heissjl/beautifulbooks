/**
 * A mail to Julian when a reader's collection is reported (ROADMAP 5.13d;
 * Julian, 2026-09-28: „ab 1 meldung eine mail an mich, ab 5 vorerst
 * runternehmen“). Server only.
 *
 * Sent through Resend, the email integration of the Vercel Marketplace, with
 * the variable it provides (`RESEND_API_KEY`). To `WALLS_REPORT_TO`, else the
 * imprint address. Without a key nothing is sent and the caller is told so:
 * the review page is then the only place a report shows (N12 — never say a
 * mail went out when none did). The mail names the collection and the count,
 * nothing about who reported it.
 */
export interface ReportMail {
  id: string;
  title: string;
  reports: number;
  hidden: boolean;
  origin: string;
}

export type MailResult = 'sent' | 'not-configured' | 'failed';

type Env = Record<string, string | undefined>;

export function reportMailText(m: ReportMail): { subject: string; text: string } {
  const subject = m.hidden
    ? `Collection taken down after ${m.reports} reports: ${m.title}`
    : `A collection was reported: ${m.title}`;
  const text = [
    m.hidden
      ? `"${m.title}" had ${m.reports} reports and is off Collections by readers until you look at it.`
      : `"${m.title}" was reported for the first time. It is still shown.`,
    '',
    `The collection: ${m.origin}/c/${m.id}`,
    `Take it down or put it back: ${m.origin}/create/review`,
  ].join('\n');
  return { subject, text };
}

export async function sendReportMail(m: ReportMail, env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<MailResult> {
  const key = env.RESEND_API_KEY?.trim();
  const to = (env.WALLS_REPORT_TO || env.IMPRINT_EMAIL)?.trim();
  if (!key || !to) return 'not-configured';
  const { subject, text } = reportMailText(m);
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.WALLS_REPORT_FROM || 'Beautiful Books <onboarding@resend.dev>', to: [to], subject, text }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

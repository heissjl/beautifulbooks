/**
 * A mail to Julian when the site uses up something that is limited or costs
 * money (Julian, 2026-10-04: „die website braucht einen stopp falls wir zu
 * viel traffic oder verbrauch bekommen. zb eine email an mich als info“).
 * Server only.
 *
 * Two things can run out: the day's budget for reading photos, which is the
 * one thing the site pays for per use (lib/walls/photobudget.ts), and the
 * Google Books quota of 1,000 requests a day, which is what real traffic
 * exhausts first (lib/googlequota.ts). Both already stop by themselves; this
 * says that they did.
 *
 * Sent through Resend like the report mail (lib/walls/notify.ts), to
 * `ALERT_TO`, else `WALLS_REPORT_TO`, else the imprint address. Each alert
 * goes out once: its key is set in the store with a two-day life, and a
 * second instance or a second request finds it there. Without a store the
 * memory of this instance has to do. Without a key nothing is sent and the
 * caller is told so (N12). A mail names numbers and settings, never a reader.
 */
import { commandsFromEnv, type RedisCommands } from './hotornot/store';
import { SITE_NAME } from './seo';

export type AlertResult = 'sent' | 'already' | 'not-configured' | 'failed';

export interface AlertMail {
  subject: string;
  text: string;
}

type Env = Record<string, string | undefined>;

const TWO_DAYS = 2 * 24 * 3600;

// Under `next dev`, routes and pages get separate copies of a module; the set lives on globalThis like the dev stores.
const sentHere = ((globalThis as { __bbAlerts?: Set<string> }).__bbAlerts ??= new Set<string>());

/** For tests. */
export function resetAlerts(): void {
  sentHere.clear();
}

/**
 * Sends `mail` unless an alert with this `key` already went out. The key
 * carries its day ("photo-full:2026-10-04"), so tomorrow's is a new one.
 */
export async function sendAlert(
  key: string,
  mail: AlertMail,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
  commands: Pick<RedisCommands, 'setNx'> | null = commandsFromEnv(env),
): Promise<AlertResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const to = (env.ALERT_TO || env.WALLS_REPORT_TO || env.IMPRINT_EMAIL)?.trim();
  if (!apiKey || !to) return 'not-configured';
  if (sentHere.has(key)) return 'already';
  sentHere.add(key);
  if (commands) {
    try {
      if (String(await commands.setNx(`alerts:${key}`, '1', TWO_DAYS)) !== 'OK') return 'already';
    } catch {
      // A silent store must not swallow the alert: better two mails than none.
    }
  }
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.WALLS_REPORT_FROM || `${SITE_NAME} <onboarding@resend.dev>`, to: [to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

/** The Google Books quota is used up for today: what stops, what does not, when it comes back. */
export function googleQuotaMail(until: Date): AlertMail {
  return {
    subject: `${SITE_NAME}: the Google Books quota is used up for today`,
    text: [
      'Google reported the daily limit of 1,000 requests as exceeded.',
      '',
      `Until ${until.toISOString()} (midnight Pacific) the site asks Google nothing: book pages show Open Library's covers only, and a selected cover gets no verdict ("could not be checked", never "no image on record").`,
      'Search, collections and the game do not use Google and go on.',
      '',
      'A day of about 500 cold book pages does this — real readers, or a crawler. The Vercel log (bb.google, kept about an hour) says when it happened.',
    ].join('\n'),
  };
}

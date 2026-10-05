/**
 * Whether "The books that inspired me" is on (ROADMAP 5.18b).
 *
 * The same rule as the cover game (`lib/hotornot/switch.ts`, E20):
 * `INSPIRATION=on` or `off` decides wherever it is set; unset means on
 * everywhere except Vercel's production, so previews and a laptop have the
 * page and production stays dark until someone switches it on on purpose.
 * Any other value fails loudly.
 */
type Env = Record<string, string | undefined>;

export function inspirationEnabled(env: Env = process.env): boolean {
  const raw = (env.INSPIRATION ?? '').trim().toLowerCase();
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  if (raw !== '') throw new Error(`INSPIRATION must be "on" or "off", got "${env.INSPIRATION}"`);
  return env.VERCEL_ENV !== 'production';
}

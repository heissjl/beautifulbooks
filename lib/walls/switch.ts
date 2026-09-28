/**
 * Whether readers' own walls are on (ROADMAP 5.13a), by the cover game's rule
 * (lib/hotornot/switch.ts, E20): `WALLS=on` or `off` decides where it is set;
 * unset means on everywhere except Vercel's production, so a forgotten
 * variable never makes it public. Any other value fails loudly.
 */
export function wallsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env.WALLS ?? '').trim().toLowerCase();
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  if (raw !== '') throw new Error(`WALLS must be "on" or "off", got "${env.WALLS}"`);
  return env.VERCEL_ENV !== 'production';
}

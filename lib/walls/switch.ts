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

/**
 * Whether the optional sign-in for readers' collections is on (ROADMAP 5.13h,
 * SPEC F9.11). Same rule as `WALLS`, and only where walls are on at all:
 * `WALLS_SIGNIN=on|off`; unset means on except in Vercel's production. Being
 * on is not enough for a button to show — its provider needs credentials too
 * (`signinOptions` in lib/walls/account.ts).
 */
export function signinEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (!wallsEnabled(env)) return false;
  const raw = (env.WALLS_SIGNIN ?? '').trim().toLowerCase();
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  if (raw !== '') throw new Error(`WALLS_SIGNIN must be "on" or "off", got "${env.WALLS_SIGNIN}"`);
  return env.VERCEL_ENV !== 'production';
}

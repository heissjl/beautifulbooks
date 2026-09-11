/**
 * Whether the cover game is on (ROADMAP 5.8a).
 *
 * `HOTORNOT=on` or `off` decides wherever it is set. Unset means on
 * everywhere except Vercel's production (`VERCEL_ENV=production`): previews
 * and a laptop play, production stays dark until someone switches it on on
 * purpose. That is E20's rule — a forgotten variable can never make something
 * public — and it means the preview needs no variable of its own beyond the
 * store.
 *
 * Any other value is a configuration error and fails loudly: a typo that
 * silently meant "off" would hide itself until someone wondered why the game
 * never appeared.
 */
type Env = Record<string, string | undefined>;

export function versusEnabled(env: Env = process.env): boolean {
  const raw = (env.HOTORNOT ?? '').trim().toLowerCase();
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  if (raw !== '') throw new Error(`HOTORNOT must be "on" or "off", got "${env.HOTORNOT}"`);
  return env.VERCEL_ENV !== 'production';
}

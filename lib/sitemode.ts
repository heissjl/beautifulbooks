/**
 * The operating mode (SPEC E20, PLAN-2-mvp-hobby).
 *
 * `hobby` is the public site until Phase 4: retailer links stay, but they are
 * neutral — affiliate variables are ignored even when set — the availability
 * check is off, and nothing on the page says a link can earn anything.
 * `shop` switches all of that on and runs locally or on a preview until the
 * full legal notice and a commercial hosting plan are in place.
 *
 * Unset means `hobby`, so a forgotten variable can never turn commerce on.
 * Any other value is a configuration error and fails loudly: a build that
 * silently fell back to `hobby` would hide a typo until someone wondered why
 * the affiliate tags never appeared.
 *
 * One variable serves server and client. It is `NEXT_PUBLIC_` so that the
 * bundler inlines it for client components; the literal member access below
 * is what makes that inlining work, so do not read it through a dynamic key.
 */
export type SiteMode = 'hobby' | 'shop';

export const DEFAULT_SITE_MODE: SiteMode = 'hobby';

export function siteMode(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_MODE): SiteMode {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '' || value === 'hobby') return 'hobby';
  if (value === 'shop') return 'shop';
  throw new Error(`NEXT_PUBLIC_SITE_MODE must be "hobby" or "shop", got "${raw}"`);
}

/** Affiliate parameters and commission wording: shop mode only. */
export function commerceEnabled(raw?: string | undefined): boolean {
  return siteMode(raw === undefined ? process.env.NEXT_PUBLIC_SITE_MODE : raw) === 'shop';
}

/**
 * The availability check (SPEC F2.10, ROADMAP 0.1) has a switch of its own,
 * `NEXT_PUBLIC_AVAILABILITY_CHECK=on`, and needs shop mode as well. Julian,
 * 2026-10-05: „eigener schalter". Turning the site into a shop must not turn
 * the probe on with it: four of the six shops disallow the probed path in
 * robots.txt and Amazon's Associates terms forbid automated access, so the
 * probe stays off until someone decides it may run. Anything but `on` is off.
 * Literal member access, as above, so the bundler inlines it for the client.
 */
export function availabilityEnabled(
  mode?: string | undefined,
  raw: string | undefined = process.env.NEXT_PUBLIC_AVAILABILITY_CHECK,
): boolean {
  return commerceEnabled(mode) && (raw ?? '').trim().toLowerCase() === 'on';
}

/**
 * What reading photos may cost in a day (ROADMAP 5.11a; Julian, 2026-10-04:
 * „damit wir nicht aus versehen viel ausgeben … einen stopp“). Pure and
 * client-safe; the counting is the store's (`WallStore.spendPhoto`), the
 * mail is lib/alerts.ts.
 *
 * Reading a photo is the one thing the site pays for per use: about 2 ct an
 * ordinary photo, 9–13 ct a dense one read twice (measured on the test set,
 * 2026-10-04). The day's spend is added up from the tokens each read
 * reports. At half the budget dense photos get one look instead of two; at
 * the whole budget photos are off until the next day (UTC). Each threshold
 * sends Julian one mail.
 */

/** A day's budget in cents when `PHOTO_BUDGET_CENTS` says nothing. Two euros: a hundred ordinary photos, or about twenty dense ones. */
export const PHOTO_BUDGET_CENTS = 200;

/** List prices the spend is reckoned with, US cents per million tokens (Sonnet, as in PLAN-5.11a). A dearer model needs these changed, or the budget buys less than it says. */
export const CENTS_PER_MILLION_IN = 300;
export const CENTS_PER_MILLION_OUT = 1500;

/** The store counts in thousandths of a cent, so that a 1.2 ct photo is not rounded away. */
export const UNITS_PER_CENT = 1000;

export function budgetCents(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.PHOTO_BUDGET_CENTS);
  return Number.isFinite(n) && n > 0 ? n : PHOTO_BUDGET_CENTS;
}

/** What a read cost, in the store's units. */
export function spendUnits(tokensIn: number, tokensOut: number): number {
  return Math.round(((tokensIn * CENTS_PER_MILLION_IN + tokensOut * CENTS_PER_MILLION_OUT) / 1_000_000) * UNITS_PER_CENT);
}

export type BudgetState = 'open' | 'half' | 'full';

/** Where the day stands: open, past half (one look only), or used up (no photos). */
export function budgetState(spentUnits: number, budget: number): BudgetState {
  const cents = spentUnits / UNITS_PER_CENT;
  return cents >= budget ? 'full' : cents >= budget / 2 ? 'half' : 'open';
}

/** The thresholds a read carried the day's spend across, for the mails: none, half, full, or both at once. */
export function crossed(beforeUnits: number, afterUnits: number, budget: number): ('half' | 'full')[] {
  const order: BudgetState[] = ['open', 'half', 'full'];
  const from = order.indexOf(budgetState(beforeUnits, budget));
  const to = order.indexOf(budgetState(afterUnits, budget));
  return (['half', 'full'] as const).filter((level) => order.indexOf(level) > from && order.indexOf(level) <= to);
}

/** The mail for a threshold: what was spent, what happens now, how to change it. */
export function budgetMail(level: 'half' | 'full', facts: { day: string; spentCents: number; budget: number; photos: number; site: string }): { subject: string; text: string } {
  const spent = facts.spentCents.toFixed(1);
  const head =
    level === 'full'
      ? `Reading photos is off until midnight UTC: ${spent} ct of today's ${facts.budget} ct are spent.`
      : `Half of today's budget for reading photos is spent: ${spent} ct of ${facts.budget} ct.`;
  const now =
    level === 'full'
      ? 'Until then a reader who chooses a photo is told that today’s photos are used up. Everything else on the site goes on.'
      : 'From here on a dense shelf is read once instead of twice, which costs about a third. At the whole budget photos are switched off for the day.';
  return {
    subject: level === 'full' ? `${facts.site}: photos are off for today (budget spent)` : `${facts.site}: half of today's photo budget is spent`,
    text: [
      head,
      '',
      `${facts.photos} reads on ${facts.day} (a dense photo counts as several).`,
      now,
      '',
      'To change it, set on Vercel and redeploy: PHOTO_BUDGET_CENTS (cents a day, default 200), PHOTO_DENSE_AT (books in the first look from which a photo is read twice; "off" for never).',
      'The hard limit that does not depend on this site is the monthly spend limit in the Anthropic console.',
    ].join('\n'),
  };
}

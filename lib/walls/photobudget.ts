/**
 * What reading photos may cost in a day (ROADMAP 5.11a; Julian, 2026-10-04:
 * „damit wir nicht aus versehen viel ausgeben … einen stopp“). Pure and
 * client-safe; the counting is the store's (`WallStore.spendPhoto`), the
 * mail is lib/alerts.ts.
 *
 * Reading a photo is the one thing the site pays for per use: about 1.5 ct
 * an ordinary photo, 6–9 ct a dense one read twice (measured on the test
 * set, 2026-10-04, at the list price in lib/insights/prices.ts). The day's spend is added up from the tokens each read
 * reports. At half the budget dense photos get one look instead of two; at
 * the whole budget photos are off until the next day (UTC). Each threshold
 * sends Julian one mail.
 */
import { costUsd, MODEL_PRICES } from '@/lib/insights/prices';

/** A day's budget in cents when `PHOTO_BUDGET_CENTS` says nothing. Two dollars: about 130 ordinary photos, or 25 dense ones. */
export const PHOTO_BUDGET_CENTS = 200;

/** The store counts in thousandths of a cent, so that a 1.2 ct photo is not rounded away. */
export const UNITS_PER_CENT = 1000;

export function budgetCents(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.PHOTO_BUDGET_CENTS);
  return Number.isFinite(n) && n > 0 ? n : PHOTO_BUDGET_CENTS;
}

/** The dearest model of the price table, in USD: what a read on a model the table does not know is reckoned at — a guard errs on the dear side. */
function dearestUsd(tokensIn: number, tokensOut: number): number {
  return Math.max(...Object.values(MODEL_PRICES).map((p) => (tokensIn * p.inputPerMTok + tokensOut * p.outputPerMTok) / 1_000_000));
}

/**
 * What a read cost, in the store's units, at the list price of its model
 * (lib/insights/prices.ts — one table for the analytics and for this guard,
 * so the two cannot disagree about a photo).
 */
export function spendUnits(model: string, tokensIn: number, tokensOut: number): number {
  const usd = costUsd(model, tokensIn, tokensOut) ?? dearestUsd(tokensIn, tokensOut);
  return Math.round(usd * 100 * UNITS_PER_CENT);
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

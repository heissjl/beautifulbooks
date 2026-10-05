/**
 * What the site costs (ROADMAP 2.18m, K15): fixed costs from a table, and the
 * costs of use that the site can measure itself. Pure.
 *
 * **Not an invoice.** Vercel's bill is in its dashboard and `vercel usage`;
 * the site has no token to read it, on purpose (a Vercel token is not limited
 * to reading). What stands here is: what is fixed, what the functions' CPU
 * time and calls come to at list price (lib/insights/cpu.ts), and what the
 * image model was paid (lib/insights/prices.ts). What is not measured is
 * named as not measured, never shown as zero (N12).
 *
 * Two currencies, never converted: a rate would be a guess that ages.
 */
import type { CpuSummary } from './cpu';

/** Vercel's list prices for Frankfurt (fra1), read 2026-10-05 from vercel.com/docs/pricing/regional-pricing/fra1. */
export const VERCEL_PRICES = {
  asOf: '2026-10-05',
  cpuUsdPerHour: 0.184,
  usdPerMillionInvocations: 0.6,
  /** Usage the Pro plan's monthly fee already covers. */
  monthlyCreditUsd: 20,
} as const;

export type Currency = 'USD' | 'EUR';

export interface FixedCost {
  id: string;
  label: string;
  amount: number;
  currency: Currency;
  per: 'month' | 'year';
  /** First day it is paid for, `YYYY-MM-DD`. */
  since: string;
  note?: string;
}

/**
 * Add a line when something is booked, with the day; a plan that was only
 * decided is not a cost yet. The Redis store is on its free plan until Julian
 * moves it (ROADMAP 2.18, J4).
 */
export const FIXED_COSTS: readonly FixedCost[] = [
  { id: 'vercel-pro', label: 'Vercel Pro', amount: 20, currency: 'USD', per: 'month', since: '2026-10-05', note: 'ein Platz; deckt 20 USD Nutzung im Monat' },
  { id: 'domains', label: 'Sechs Domains bei INWX', amount: 73.46, currency: 'EUR', per: 'year', since: '2026-10-02', note: 'erstes Jahr; Verlängerungen weichen ab (docs/domain-recherche.md)' },
];

const DAYS = { month: 30.4375, year: 365.25 } as const;

export interface CostLine {
  label: string;
  amount: number;
  currency: Currency;
  kind: 'fixed' | 'measured';
  note?: string;
}

export interface CostSummary {
  lines: CostLine[];
  totals: Record<Currency, number>;
  /** Vercel usage at list price before the plan's credit, and how much of it the credit covers in this range. */
  vercelUsageUsd: number;
  vercelCreditUsd: number;
  notMeasured: string[];
}

/** Days of `days` on which a cost that began on `since` was already being paid. */
function paidDays(days: readonly string[], since: string): number {
  return days.filter(day => day >= since).length;
}

export function summarizeCosts(
  days: readonly string[],
  cpu: Pick<CpuSummary, 'cpu' | 'n'>,
  photosUsd: number,
  fixed: readonly FixedCost[] = FIXED_COSTS,
): CostSummary {
  const lines: CostLine[] = [];
  for (const cost of fixed) {
    const paid = paidDays(days, cost.since);
    if (paid === 0) continue;
    lines.push({ label: cost.label, amount: (cost.amount / DAYS[cost.per]) * paid, currency: cost.currency, kind: 'fixed', ...(cost.note ? { note: cost.note } : {}) });
  }
  const cpuUsd = (cpu.cpu / 3_600_000_000) * VERCEL_PRICES.cpuUsdPerHour;
  const callsUsd = (cpu.n / 1_000_000) * VERCEL_PRICES.usdPerMillionInvocations;
  const vercelUsageUsd = cpuUsd + callsUsd;
  // The credit belongs to a month; a range gets the share of its days on Pro.
  const pro = fixed.find(cost => cost.id === 'vercel-pro');
  const creditForRange = pro ? (VERCEL_PRICES.monthlyCreditUsd / DAYS.month) * paidDays(days, pro.since) : 0;
  const vercelCreditUsd = Math.min(vercelUsageUsd, creditForRange);
  lines.push({ label: 'Vercel: Rechenzeit der Funktionen', amount: cpuUsd, currency: 'USD', kind: 'measured', note: `${VERCEL_PRICES.cpuUsdPerHour} USD je CPU-Stunde` });
  lines.push({ label: 'Vercel: Funktionsaufrufe', amount: callsUsd, currency: 'USD', kind: 'measured', note: `${VERCEL_PRICES.usdPerMillionInvocations} USD je Million` });
  if (vercelCreditUsd > 0) lines.push({ label: 'Vercel: vom Guthaben des Plans gedeckt', amount: -vercelCreditUsd, currency: 'USD', kind: 'measured' });
  lines.push({ label: 'Anthropic: gelesene Fotos', amount: photosUsd, currency: 'USD', kind: 'measured', note: 'Tokens × Listenpreis' });
  const totals: Record<Currency, number> = { USD: 0, EUR: 0 };
  for (const line of lines) totals[line.currency] += line.amount;
  return {
    lines,
    totals,
    vercelUsageUsd,
    vercelCreditUsd,
    notMeasured: [
      'Vercel: CDN-Anfragen und Übertragung (auf Pro pauschal, wenn „Flat Rate CDN“ gilt), Speicher der Funktionen, ISR, der Proxy',
      'Anthropic: was mit demselben Schlüssel außerhalb der Seite gefragt wird',
      'Redis, Google Books, Open Library, Resend: heute ohne Rechnung',
    ],
  };
}

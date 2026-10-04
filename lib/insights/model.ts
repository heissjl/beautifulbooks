/**
 * The analytics' pure half (ROADMAP 3.1a, docs/plans/PLAN-3.1-analyse.md):
 * which keys hold what, which fields are allowed, and how daily totals add up
 * to the numbers the view shows. No Redis, no `next`; tested on its own.
 *
 * What is stored is a **sum per day**, never an event: a click becomes +1 on
 * the field `provider|market|kind` of that day's hash. No ISBN, no time of
 * day, nothing about the reader (E14, N11) — there is no list of clicks that
 * could be joined to anything.
 *
 * Only `/go/` is counted on the server, because it is the only route the CDN
 * never answers by itself (`no-store`); the search, work and ISBN routes are
 * cached for a day, and a counter there would see cache misses, not readers
 * (plan §2).
 */
import type { Market } from '../market';

export const INSIGHTS_PREFIX = 'ins';

/** A daily hash lives this long, then Redis drops it (plan §5). */
export const RETENTION_DAYS = 400;
export const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;

/** The longest range the view asks for; more would read hundreds of hashes per page view. */
export const MAX_RANGE_DAYS = 90;

export type InsightsHash = 'clicks' | 'ops' | 'book' | 'works' | 'search' | 'empty' | 'photos' | 'landing';

/** Searches that found nothing are kept as words, so for a shorter time (Julian, 2026-10-04). */
export const EMPTY_RETENTION_SECONDS = 90 * 24 * 60 * 60;

/**
 * Events of the operation that the code can actually see (K11). Not the
 * Google request count: the Next data cache hides which calls left the
 * machine (CLAUDE.md), so that number lives in the Cloud console only.
 */
export const OPS = ['google-stop', 'ol-failed'] as const;
export type Op = (typeof OPS)[number];

export type ClickKind = 'product' | 'search';

export interface ClickCount {
  provider: string;
  market: Market;
  kind: ClickKind;
}

const MARKETS: ReadonlySet<string> = new Set(['us', 'uk', 'de']);
const KINDS: ReadonlySet<string> = new Set(['product', 'search']);
const PROVIDER = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** UTC day of a moment, `YYYY-MM-DD`; days change at UTC midnight, which the view says. */
export function dayOf(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export function insightsKey(day: string, hash: InsightsHash): string {
  return `${INSIGHTS_PREFIX}:${day}:${hash}`;
}

/**
 * The field a click adds to, or null for anything that is not a known shape.
 * The provider comes from the retailer table already (the route looks it up
 * before counting); checking it again keeps a stray value out of the store.
 */
export function clickField(click: ClickCount): string | null {
  if (!PROVIDER.test(click.provider) || !MARKETS.has(click.market) || !KINDS.has(click.kind)) return null;
  return `${click.provider}|${click.market}|${click.kind}`;
}

export function parseClickField(field: string): ClickCount | null {
  const [provider, market, kind, ...rest] = field.split('|');
  if (rest.length > 0 || provider === undefined || market === undefined || kind === undefined) return null;
  const click = { provider, market: market as Market, kind: kind as ClickKind };
  return clickField(click) === field ? click : null;
}

/** The `days` UTC days ending with `end`'s day, oldest first. */
export function lastDays(end: Date, days: number): string[] {
  const n = Math.max(1, Math.min(MAX_RANGE_DAYS, Math.floor(days)));
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayOf(new Date(end.getTime() - i * 86_400_000)));
  return out;
}

/** One day as Redis gave it back: field → count, values possibly strings. */
export type DayHash = Record<string, unknown>;

function count(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export interface ProviderRow {
  provider: string;
  market: Market;
  clicks: number;
  /** Of these, how many opened one book's page rather than a list of results. */
  product: number;
}

export interface ClickSummary {
  total: number;
  /** Per day, in the order of the days asked for; a missing day is 0, not absent. */
  perDay: Array<{ day: string; clicks: number }>;
  byMarket: Record<Market, number>;
  /** Largest first; ties by provider name, so the table does not reshuffle. */
  rows: ProviderRow[];
}

/**
 * Adds up the click hashes of the given days. `market` narrows everything to
 * one market; unknown fields are skipped, not guessed.
 */
export function summarizeClicks(days: string[], hashes: ReadonlyArray<DayHash | null>, market?: Market): ClickSummary {
  const byMarket: Record<Market, number> = { us: 0, uk: 0, de: 0 };
  const rows = new Map<string, ProviderRow>();
  const perDay = days.map((day, i) => {
    let dayTotal = 0;
    for (const [field, value] of Object.entries(hashes[i] ?? {})) {
      const click = parseClickField(field);
      const n = count(value);
      if (!click || n === 0 || (market && click.market !== market)) continue;
      dayTotal += n;
      byMarket[click.market] += n;
      const key = `${click.provider}|${click.market}`;
      const row = rows.get(key) ?? { provider: click.provider, market: click.market, clicks: 0, product: 0 };
      row.clicks += n;
      if (click.kind === 'product') row.product += n;
      rows.set(key, row);
    }
    return { day, clicks: dayTotal };
  });
  return {
    total: perDay.reduce((sum, d) => sum + d.clicks, 0),
    perDay,
    byMarket,
    rows: [...rows.values()].sort((a, b) => b.clicks - a.clicks || a.provider.localeCompare(b.provider) || a.market.localeCompare(b.market)),
  };
}

export interface OpsSummary {
  /** Days on which the event happened at least once, per event. */
  daysWith: Record<Op, string[]>;
  totals: Record<Op, number>;
}

export function summarizeOps(days: string[], hashes: ReadonlyArray<DayHash | null>): OpsSummary {
  const daysWith = { 'google-stop': [], 'ol-failed': [] } as Record<Op, string[]>;
  const totals = { 'google-stop': 0, 'ol-failed': 0 } as Record<Op, number>;
  days.forEach((day, i) => {
    for (const op of OPS) {
      const n = count((hashes[i] ?? {})[op]);
      if (n === 0) continue;
      totals[op] += n;
      daysWith[op].push(day);
    }
  });
  return { daysWith, totals };
}

/**
 * Change against the period before, or null when there is nothing to compare
 * with — a rise from zero is not "+∞ %", it is "new".
 */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/** Below this many clicks in a range, shares are noise and the view greys them (plan §7). */
export const FEW_CLICKS = 30;

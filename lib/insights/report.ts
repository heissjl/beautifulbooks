/**
 * What `/admin/insights` and `/api/insights` show (ROADMAP 3.1a, K3 and K11):
 * the click totals of a range, the range before it for comparison, and the
 * days on which the operation stumbled. Server only.
 */
import { buyLinksFor } from '../buylinks';
import type { RedisCommands } from '../hotornot/store';
import type { Market } from '../market';
import { change, FEW_CLICKS, lastDays, MAX_RANGE_DAYS, summarizeClicks, summarizeOps, type ClickSummary, type OpsSummary } from './model';
import { readDays } from './store';

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export function parseRange(raw: string | null | undefined): RangeDays {
  const n = Number(raw);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

export function parseMarket(raw: string | null | undefined): Market | undefined {
  return raw === 'us' || raw === 'uk' || raw === 'de' ? raw : undefined;
}

export type InsightsReport =
  | {
      ok: true;
      days: RangeDays;
      market?: Market;
      from: string;
      to: string;
      clicks: ClickSummary;
      previousTotal: number;
      /** Relative change against the range before; null when that range had none. */
      change: number | null;
      /** Fewer clicks than this make shares noise (plan §7). */
      few: boolean;
      ops: OpsSummary;
      labels: Record<string, string>;
    }
  | { ok: false; reason: 'no-store' | 'failed' };

/** A shop's name as the reader sees it; the id when the table no longer knows it. */
function labelsFor(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const market of ['us', 'uk', 'de'] as const) {
    // Any valid ISBN-13: the labels do not depend on it.
    for (const link of buyLinksFor({ isbn13: '9780141036144' }, market)) labels[link.provider] ??= link.label;
  }
  return labels;
}

export async function buildReport(
  days: RangeDays,
  market: Market | undefined,
  commands: RedisCommands | null | undefined,
  now: Date = new Date(),
): Promise<InsightsReport> {
  const span = Math.min(days, MAX_RANGE_DAYS);
  const current = lastDays(now, span);
  const previous = lastDays(new Date(now.getTime() - span * 86_400_000), span);
  // `undefined` lets `readDays` take this deployment's store; `null` means none.
  const [clickRead, previousRead, opsRead] = await Promise.all([
    readDays(current, 'clicks', commands),
    readDays(previous, 'clicks', commands),
    readDays(current, 'ops', commands),
  ]);
  if (!clickRead.ok) return { ok: false, reason: clickRead.reason };
  if (!previousRead.ok) return { ok: false, reason: previousRead.reason };
  if (!opsRead.ok) return { ok: false, reason: opsRead.reason };
  const clicks = summarizeClicks(current, clickRead.hashes, market);
  const previousTotal = summarizeClicks(previous, previousRead.hashes, market).total;
  return {
    ok: true,
    days,
    ...(market ? { market } : {}),
    from: current[0] ?? '',
    to: current[current.length - 1] ?? '',
    clicks,
    previousTotal,
    change: change(clicks.total, previousTotal),
    few: clicks.total < FEW_CLICKS,
    ops: summarizeOps(current, opsRead.hashes),
    labels: labelsFor(),
  };
}

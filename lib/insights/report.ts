/**
 * What `/admin/insights` and `/api/insights` show (ROADMAP 3.1a, K3 and K11):
 * the click totals of a range, the range before it for comparison, and the
 * days on which the operation stumbled. Server only.
 */
import { buyLinksFor, isWordsProvider, searchLinksFor, titleSearchLinksFor } from '../buylinks';
import type { RedisCommands } from '../hotornot/store';
import { LOCAL_COUNTRIES, localShopLinks } from '../localshops';
import type { Market } from '../market';
import { change, FEW_CLICKS, lastDays, MAX_RANGE_DAYS, summarizeClicks, summarizeOps, type ClickSummary, type OpsSummary } from './model';
import { readDays } from './store';
import { emptySearches, summarizePhotos, summarizeBooks, summarizeSearches, topWorks, type BookSummary, type PhotoSummary, type SearchSummary, type WorkRow } from './visits';
import { costUsd } from './prices';
import { PUBLISHED_WORKS } from '../published';

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
      /** From the browser's signals (3.1b). */
      books: BookSummary;
      previousBooks: BookSummary;
      searches: SearchSummary;
      works: Array<WorkRow & { title?: string }>;
      empty: Array<{ q: string; n: number }>;
      /** K13: shelf photos read by the image model, and what they cost. */
      photos: PhotoSummary;
    }
  | { ok: false; reason: 'no-store' | 'failed' };

/** A shop's name as the reader sees it; the id when the table no longer knows it. */
function labelsFor(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const market of ['us', 'uk', 'de'] as const) {
    // Any valid ISBN-13: the labels do not depend on it.
    for (const link of buyLinksFor({ isbn13: '9780141036144' }, market)) labels[link.provider] ??= link.label;
    // Shops searched by words (ROADMAP 3.1): which question was put to them.
    for (const link of searchLinksFor({ title: 'x' }, market)) {
      if (isWordsProvider(link.provider)) labels[link.provider] ??= `${link.label} · diese Ausgabe nach Titel`;
    }
    for (const link of titleSearchLinksFor({ title: 'x' }, market, {})) labels[link.provider] ??= `${link.label} · andere Ausgabe`;
  }
  // "Buy from a local bookshop" (5.12), counted as `local-<service>` since 3.1.
  for (const { id } of LOCAL_COUNTRIES) {
    for (const link of localShopLinks(id, {})) labels[`local-${link.id.replace(/-finder$/, '')}`] ??= `${link.label} · lokale Buchhandlung`;
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
  const reads = await Promise.all([
    readDays(current, 'clicks', commands),
    readDays(previous, 'clicks', commands),
    readDays(current, 'ops', commands),
    readDays(current, 'book', commands),
    readDays(previous, 'book', commands),
    readDays(current, 'search', commands),
    readDays(current, 'works', commands),
    readDays(current, 'empty', commands),
    readDays(current, 'photos', commands),
  ]);
  const failed = reads.find(r => !r.ok);
  if (failed && !failed.ok) return { ok: false, reason: failed.reason };
  const [clickRead, previousRead, opsRead, bookRead, previousBookRead, searchRead, worksRead, emptyRead, photoRead] = reads.map(r => (r.ok ? r.hashes : []));
  const clicks = summarizeClicks(current, clickRead, market);
  const previousTotal = summarizeClicks(previous, previousRead, market).total;
  const titles = new Map(PUBLISHED_WORKS.map(w => [w.id, w.title]));
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
    ops: summarizeOps(current, opsRead),
    labels: labelsFor(),
    books: summarizeBooks(bookRead, market),
    previousBooks: summarizeBooks(previousBookRead, market),
    searches: summarizeSearches(searchRead),
    works: topWorks(worksRead).map(w => ({ ...w, title: titles.get(w.work) })),
    empty: emptySearches(emptyRead),
    photos: summarizePhotos(current, photoRead, costUsd),
  };
}

/**
 * Adding up the browser's signals (ROADMAP 3.1b, K1, K2, K4–K10). Pure; the
 * report reads the day hashes and hands them here.
 */
import type { Market } from '../market';
import type { DayHash } from './model';
import { ORIGINS, POSITIONS, readField, SEEN, VERDICTS, type Origin } from './signals';

function n(value: unknown): number {
  const v = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export interface BookSummary {
  visits: number;
  /** Visits with at least one click to a shop. */
  bought: number;
  /** bought ÷ visits, or null without visits. */
  rate: number | null;
  /** K4: visits that reached each step. */
  funnel: { visits: number; wall: number; picked: number; bought: number };
  /** K9 */
  origins: Record<Origin, number>;
  /** K7: tiles at least half in view, in classes. */
  seen: Record<(typeof SEEN)[number], number>;
  /** K7: visits that left before a second page of the wall arrived. */
  onePageOrLess: number;
  /** K8: per verdict shown, visits and how many of them clicked to a shop. */
  verdicts: Record<(typeof VERDICTS)[number], { visits: number; bought: number }>;
  /** Visits with a click on an image search or catalogue. */
  found: number;
}

const zeros = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map(k => [k, 0])) as Record<K, number>;

export function summarizeBooks(hashes: ReadonlyArray<DayHash | null>, market?: Market): BookSummary {
  const s: BookSummary = {
    visits: 0, bought: 0, rate: null,
    funnel: { visits: 0, wall: 0, picked: 0, bought: 0 },
    origins: zeros(ORIGINS), seen: zeros(SEEN), onePageOrLess: 0,
    verdicts: Object.fromEntries(VERDICTS.map(v => [v, { visits: 0, bought: 0 }])) as BookSummary['verdicts'],
    found: 0,
  };
  for (const hash of hashes) {
    for (const [field, value] of Object.entries(hash ?? {})) {
      const f = readField(field);
      const k = n(value);
      if (!f || k === 0 || (market && f.market !== market)) continue;
      if (!(f.from in s.origins) || !(f.seen in s.seen) || !(f.verdict in s.verdicts)) continue;
      const bought = f.bought === '1';
      s.visits += k;
      s.funnel.visits += k;
      if (f.pages !== '0') s.funnel.wall += k;
      if (f.picked === '1') s.funnel.picked += k;
      if (bought) { s.bought += k; s.funnel.bought += k; }
      s.origins[f.from as Origin] += k;
      s.seen[f.seen as (typeof SEEN)[number]] += k;
      if (f.pages === '0' || f.pages === '1') s.onePageOrLess += k;
      const v = s.verdicts[f.verdict as (typeof VERDICTS)[number]];
      v.visits += k;
      if (bought) v.bought += k;
      if (f.found === '1') s.found += k;
    }
  }
  s.rate = s.visits > 0 ? s.bought / s.visits : null;
  return s;
}

export interface SearchSummary {
  searches: number;
  empty: number;
  failed: number;
  /** K6: among searches with results, which position was clicked. */
  positions: Record<(typeof POSITIONS)[number], number>;
  modes: Record<string, number>;
}

export function summarizeSearches(hashes: ReadonlyArray<DayHash | null>): SearchSummary {
  const s: SearchSummary = { searches: 0, empty: 0, failed: 0, positions: zeros(POSITIONS), modes: {} };
  for (const hash of hashes) {
    for (const [field, value] of Object.entries(hash ?? {})) {
      const f = readField(field);
      const k = n(value);
      if (!f || k === 0) continue;
      s.searches += k;
      s.modes[f.mode] = (s.modes[f.mode] ?? 0) + k;
      if (f.outcome === 'empty') s.empty += k;
      else if (f.outcome === 'failed') s.failed += k;
      else if (f.clicked in s.positions) s.positions[f.clicked as (typeof POSITIONS)[number]] += k;
    }
  }
  return s;
}

export interface WorkRow { work: string; visits: number; bought: number }

/** K10: the most visited works, with how many visits went to a shop. */
export function topWorks(hashes: ReadonlyArray<DayHash | null>, limit = 20): WorkRow[] {
  const rows = new Map<string, WorkRow>();
  for (const hash of hashes) {
    for (const [field, value] of Object.entries(hash ?? {})) {
      const [work, bought] = field.split('|');
      const k = n(value);
      if (!/^OL\d+W$/.test(work ?? '') || k === 0) continue;
      const row = rows.get(work) ?? { work, visits: 0, bought: 0 };
      row.visits += k;
      if (bought === '1') row.bought += k;
      rows.set(work, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.visits - a.visits || a.work.localeCompare(b.work)).slice(0, limit);
}

/** Searches that found nothing, shown only from this many equal ones on (Julian, 2026-10-04). */
export const EMPTY_SHOWN_FROM = 2;

export function emptySearches(hashes: ReadonlyArray<DayHash | null>, limit = 30): Array<{ q: string; n: number }> {
  const totals = new Map<string, number>();
  for (const hash of hashes) for (const [q, value] of Object.entries(hash ?? {})) totals.set(q, (totals.get(q) ?? 0) + n(value));
  return [...totals.entries()]
    .filter(([, k]) => k >= EMPTY_SHOWN_FROM)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([q, k]) => ({ q, n: k }));
}

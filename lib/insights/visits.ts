/**
 * Adding up the browser's signals (ROADMAP 3.1b, K1, K2, K4–K10). Pure; the
 * report reads the day hashes and hands them here.
 */
import type { Market } from '../market';
import type { DayHash } from './model';
import { ENTRIES, LANDINGS, ORIGINS, POSITIONS, readField, SEEN, VERDICTS, type Entry, type Landing, type Origin } from './signals';

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

export interface ChannelRow {
  entry: Entry;
  /** Visits that began with this channel: a landing page or a book page as the tab's first page. */
  entries: number;
  /** Of these, how many opened a book — the first page was one, or a book was opened from it. */
  opened: number;
  /** Book page visits, at any depth, in visits that began with this channel. */
  bookVisits: number;
  /** Of these, how many clicked through to a shop. */
  bought: number;
}

export interface ChannelSummary {
  /** Channels with at least one entry or book visit; most entries first. */
  rows: ChannelRow[];
  entries: number;
  /** Entries from outside per day (everything but `direct` and `site`): a launch day shows as a peak. */
  perDay: Array<{ day: string; clicks: number }>;
  /** Per kind of landing page: visits, how many were a tab's first page, how many opened a book. */
  landings: Record<Landing, { visits: number; first: number; opened: number }>;
  /** Book visits counted before 5.6a, which carry no channel. */
  unattributed: number;
}

const QUIET: ReadonlySet<string> = new Set(['direct', 'site']);

/**
 * K14 (5.6a): which channels bring readers, and whether those readers open a
 * book and go on to a shop. `bookHashes` and `landingHashes` are the days'
 * `book` and `landing` hashes, in the order of `days`. Not narrowed by market:
 * a landing page does not know the reader's market.
 */
export function summarizeChannels(days: string[], bookHashes: ReadonlyArray<DayHash | null>, landingHashes: ReadonlyArray<DayHash | null>): ChannelSummary {
  const rows = new Map<Entry, ChannelRow>();
  const row = (entry: Entry) => {
    let r = rows.get(entry);
    if (!r) rows.set(entry, (r = { entry, entries: 0, opened: 0, bookVisits: 0, bought: 0 }));
    return r;
  };
  const landings = Object.fromEntries(LANDINGS.map(l => [l, { visits: 0, first: 0, opened: 0 }])) as ChannelSummary['landings'];
  const isEntry = (v: string | undefined): v is Entry => v !== undefined && (ENTRIES as readonly string[]).includes(v);
  let unattributed = 0;
  const perDay = days.map((day, i) => {
    let outside = 0;
    for (const [field, value] of Object.entries(landingHashes[i] ?? {})) {
      const f = readField(field);
      const k = n(value);
      if (!f || k === 0 || !isEntry(f.entry) || !(f.page in landings)) continue;
      const l = landings[f.page as Landing];
      l.visits += k;
      if (f.opened === '1') l.opened += k;
      if (f.first !== '1') continue;
      l.first += k;
      const r = row(f.entry);
      r.entries += k;
      if (f.opened === '1') r.opened += k;
      if (!QUIET.has(f.entry)) outside += k;
    }
    for (const [field, value] of Object.entries(bookHashes[i] ?? {})) {
      const f = readField(field);
      const k = n(value);
      if (!f || k === 0) continue;
      if (!isEntry(f.entry)) {
        unattributed += k;
        continue;
      }
      const r = row(f.entry);
      r.bookVisits += k;
      if (f.bought === '1') r.bought += k;
      // A book page reached from outside was the tab's first page.
      if (isEntry(f.from)) {
        r.entries += k;
        r.opened += k;
        if (!QUIET.has(f.entry)) outside += k;
      }
    }
    return { day, clicks: outside };
  });
  const list = [...rows.values()].sort((a, b) => b.entries - a.entries || b.bookVisits - a.bookVisits || a.entry.localeCompare(b.entry));
  return { rows: list, entries: list.reduce((sum, r) => sum + r.entries, 0), perDay, landings, unattributed };
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

export interface PhotoSummary {
  /** Photos the model read. */
  read: number;
  /** Photos the model did not answer. */
  failed: number;
  /** Photos turned away by the day's limit, before the model was asked. */
  capped: number;
  books: number;
  found: number;
  maybe: number;
  /** Tokens per model. */
  tokens: Record<string, { input: number; output: number; costUsd: number | null }>;
  /** Total cost in USD of the tokens whose model has a price. */
  costUsd: number;
  /** Tokens of models without a price: their cost is unknown, not zero (N12). */
  unpricedTokens: number;
  /** Cost per day in USD, in the order of the days asked for. */
  perDay: Array<{ day: string; costUsd: number; read: number }>;
}

/**
 * K13: what reading shelf photos used and cost. `price` is
 * `costUsd` from `prices.ts`, passed in so this stays a pure sum.
 */
export function summarizePhotos(
  days: string[],
  hashes: ReadonlyArray<DayHash | null>,
  price: (model: string, input: number, output: number) => number | null,
): PhotoSummary {
  const s: PhotoSummary = { read: 0, failed: 0, capped: 0, books: 0, found: 0, maybe: 0, tokens: {}, costUsd: 0, unpricedTokens: 0, perDay: [] };
  days.forEach((day, i) => {
    const hash = hashes[i] ?? {};
    const dayTokens: Record<string, { input: number; output: number }> = {};
    for (const [field, value] of Object.entries(hash)) {
      const k = n(value);
      if (k === 0) continue;
      const [kind, model] = field.split('|');
      if ((kind === 'in' || kind === 'out') && model) {
        const t = (dayTokens[model] ??= { input: 0, output: 0 });
        if (kind === 'in') t.input += k;
        else t.output += k;
      } else if (kind === 'read' || kind === 'failed' || kind === 'capped' || kind === 'books' || kind === 'found' || kind === 'maybe') {
        s[kind] += k;
      }
    }
    let dayCost = 0;
    for (const [model, t] of Object.entries(dayTokens)) {
      const total = (s.tokens[model] ??= { input: 0, output: 0, costUsd: 0 });
      total.input += t.input;
      total.output += t.output;
      const cost = price(model, t.input, t.output);
      if (cost === null) {
        total.costUsd = null;
        s.unpricedTokens += t.input + t.output;
      } else {
        if (total.costUsd !== null) total.costUsd += cost;
        dayCost += cost;
      }
    }
    s.costUsd += dayCost;
    s.perDay.push({ day, costUsd: dayCost, read: n(hash.read) });
  });
  return s;
}

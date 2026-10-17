/**
 * How full the store is allowed to get before someone looks (ROADMAP 2.18g;
 * 2.20 (3)). Pure: the lines, the words for the health text and the morning
 * mail, the one mail a day for a list over its line, and the note of what
 * became of the last morning mail. `lib/operations.ts` does the reading.
 *
 * Each list that grows with use has a line it must not cross unnoticed:
 * 90 % of its cap where there is one — readers' saved collections
 * (`WALLS_CAP`), the friends' drafts and suggestions (2.20) — and two million
 * where there is none: the game's votes, about 80 bytes each, so the 250 MB
 * store would hold some three million, and the standings count the list by
 * position, which is why it is not trimmed. A list over its line is a
 * warning line and a mail, never "degraded": only a silent store is that,
 * and the uptime monitor must not page anyone for a full list at night.
 */
import type { AlertMail, AlertResult } from './alerts';
import { SITE_NAME } from './seo';
import { WALLS_CAP } from './walls/model';

/** Drafts on /curate at most (ROADMAP 2.20); beyond it a new draft is refused with a sentence, never a 500. */
export const DRAFTS_CAP = 200;
/** Suggestions kept at most (ROADMAP 2.20); beyond it /suggest refuses until Julian has taken some into the file. */
export const SUGGESTIONS_CAP = 1000;
/** Votes in the cover game before someone decides about the log; there is no cap (2.20 (3)). */
export const VOTES_LINE = 2_000_000;

/** Where a list is full enough to look at. */
export const FILL_LINES = {
  votes: VOTES_LINE,
  walls: Math.floor(WALLS_CAP * 0.9),
  drafts: Math.floor(DRAFTS_CAP * 0.9),
  suggestions: Math.floor(SUGGESTIONS_CAP * 0.9),
} as const;
export type FillList = keyof typeof FILL_LINES;

export interface FillFacts {
  /** Keys in the store (`DBSIZE`), or null when it could not be read. */
  keys: number | null;
  /** Votes over every log of the game. */
  votes: number | null;
  /** Saved readers' collections (`walls:all`). */
  walls: number | null;
  drafts: number | null;
  suggestions: number | null;
  /** Bytes of the published drafts (`collections:content`), the one value that grows with the collections. */
  contentBytes: number | null;
}

export interface FillWarning {
  list: FillList;
  n: number;
  line: number;
}

export function fillWarnings(f: FillFacts): FillWarning[] {
  const out: FillWarning[] = [];
  for (const list of Object.keys(FILL_LINES) as FillList[]) {
    const n = f[list];
    if (n !== null && n >= FILL_LINES[list]) out.push({ list, n, line: FILL_LINES[list] });
  }
  return out;
}

const said = (v: number | null) => (v === null ? '?' : String(v));

/** One line for the health text and the morning mail: counts, with `?` where the store did not say (N12). */
export function fillLine(f: FillFacts): string {
  const content = f.contentBytes === null ? '?' : `${Math.round(f.contentBytes / 1024)} KB`;
  return `store: ${said(f.keys)} keys, votes ${said(f.votes)}, walls ${said(f.walls)}, drafts ${said(f.drafts)}, suggestions ${said(f.suggestions)}, published drafts ${content}`;
}

export function warningLine(w: FillWarning): string {
  return `fill: ${w.list} ${w.n} over ${w.line}`;
}

/** The one mail a day for a list over its line (`sendAlert` key `fill:<list>:<day>`). Numbers and settings, nothing about a reader. */
export function fillMail(w: FillWarning, f: FillFacts): AlertMail {
  const what: Record<FillList, string> = {
    votes: `The cover game holds ${w.n} votes, over the line of ${w.line}. A vote is about 80 bytes; the store of 250 MB would hold some three million. The standings count the log by position, so it is not trimmed (2.20) — decide whether to archive the log and start a new pool.`,
    walls: `Readers have saved ${w.n} collections, over the line of ${w.line}; at ${WALLS_CAP} the site refuses new ones (2.20). Decide whether to raise WALLS_CAP or leave it.`,
    drafts: `There are ${w.n} drafts on /curate, over the line of ${w.line}; at ${DRAFTS_CAP} a new draft is refused (2.20). Publish or delete some.`,
    suggestions: `There are ${w.n} suggestions, over the line of ${w.line}; at ${SUGGESTIONS_CAP} /suggest refuses new ones (2.20). Take them into the file or decide them.`,
  };
  return {
    subject: `${SITE_NAME}: the store's ${w.list} list is at ${w.n}`,
    text: [what[w.list], '', fillLine(f), '', 'Sent once a day while the list stays over its line. /admin/insights shows the numbers.'].join('\n'),
  };
}

/** Where the heartbeat route notes what became of the morning mail, so a `failed` is seen by someone (2.18g). */
export const HEARTBEAT_LAST_KEY = 'ops:heartbeat:last';

export interface HeartbeatRecord {
  /** The day the mail reported on. */
  day: string;
  result: AlertResult;
  /** When the route ran, ISO. */
  at: string;
}

const RESULTS: ReadonlySet<string> = new Set<AlertResult>(['sent', 'already', 'not-configured', 'failed']);

export function heartbeatRecord(day: string, result: AlertResult, at: Date): string {
  return JSON.stringify({ day, result, at: at.toISOString() } satisfies HeartbeatRecord);
}

export function parseHeartbeatRecord(raw: unknown): HeartbeatRecord | null {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as Partial<HeartbeatRecord>;
    if (typeof v.day !== 'string' || typeof v.at !== 'string' || typeof v.result !== 'string' || !RESULTS.has(v.result)) return null;
    return { day: v.day, at: v.at, result: v.result as AlertResult };
  } catch {
    return null;
  }
}

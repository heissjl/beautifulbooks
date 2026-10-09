/**
 * Where the functions' computing time goes (ROADMAP 2.18l, K14): CPU time per
 * route class and per kind of caller, as a sum per day. Pure; the clock is
 * passed in, the store and `next` live elsewhere (`store.ts`, `app/api/measure.ts`).
 *
 * Why the site measures this itself: on 2026-10-04 Vercel reported 90 % of the
 * Hobby plan's four CPU hours used, and nothing the site could read said by
 * what. Vercel's own figures answered only after the move to Pro — ClaudeBot
 * had asked for 31,657 of 44,438 images and 6,776 of 8,281 book pages in two
 * days. Routes and callers are fixed classes, never a path or a user agent
 * string, and a crawler is not a reader: nothing here is about a person.
 *
 * The CPU of a process cannot be read per request, only for the process. So
 * the meter splits each stretch of process CPU evenly among the requests that
 * were in flight during it; a stretch with none goes to `idle` (start-up,
 * module loading, the runtime's own work). The classes then add up to exactly
 * what the process used, which is what Vercel bills as Active CPU — less the
 * proxy, which runs as a function of its own and is not measured here.
 */
import type { DayHash } from './model';

export const CPU_ROUTES = [
  'img', 'works', 'works-summary', 'search', 'isbn', 'authors', 'similar', 'seen', 'go',
  'walls', 'photo', 'versus', 'curate', 'og', 'portrait', 'portrait-picture',
  'page-home', 'page-book', 'page-cover', 'page-decades', 'page-collections', 'page-wall', 'page-create', 'page-versus', 'page-portrait',
  'other', 'idle',
] as const;
export type CpuRoute = (typeof CPU_ROUTES)[number];

/**
 * Who asked. `page` is a rendered page: an ISR page must not read the request
 * headers (it would turn dynamic and lose its prerender), so its caller is
 * not known here — `vercel metrics … --group-by clientUserAgent` says it.
 */
export const CPU_AGENTS = ['browser', 'claudebot', 'gptbot', 'googlebot', 'bingbot', 'bot', 'page', 'none'] as const;
export type CpuAgent = (typeof CPU_AGENTS)[number];

const NAMED_BOTS: ReadonlyArray<[RegExp, CpuAgent]> = [
  [/claudebot|claude-user|claude-searchbot|anthropic-ai/i, 'claudebot'],
  [/gptbot|chatgpt-user|oai-searchbot/i, 'gptbot'],
  [/googlebot|google-inspectiontool|googleother|storebot-google/i, 'googlebot'],
  [/bingbot|bingpreview|msnbot/i, 'bingbot'],
];
const ANY_BOT = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|preview|monitor|curl\/|wget\/|python-requests|node-fetch|undici|go-http-client|headless/i;

/** The class of a user agent string; the string itself is never kept. */
export function agentClass(userAgent: string | null | undefined): CpuAgent {
  const ua = (userAgent ?? '').trim();
  if (!ua) return 'none';
  for (const [pattern, agent] of NAMED_BOTS) if (pattern.test(ua)) return agent;
  return ANY_BOT.test(ua) ? 'bot' : 'browser';
}

export interface CpuTotal {
  /** Microseconds of CPU, as `process.cpuUsage()` counts them. */
  cpu: number;
  /** Requests finished. */
  n: number;
  /** Milliseconds from the start of a request to its end. */
  ms: number;
}

const ROUTE_SET: ReadonlySet<string> = new Set(CPU_ROUTES);
const AGENT_SET: ReadonlySet<string> = new Set(CPU_AGENTS);
const MEASURES = ['cpu', 'n', 'ms'] as const;
type Measure = (typeof MEASURES)[number];

export function cpuKey(route: CpuRoute, agent: CpuAgent): string {
  return `${route}|${agent}`;
}

function parseField(field: string): { route: CpuRoute; agent: CpuAgent; measure: Measure } | null {
  const [route, agent, measure, ...rest] = field.split('|');
  if (rest.length > 0 || !ROUTE_SET.has(route ?? '') || !AGENT_SET.has(agent ?? '')) return null;
  if (!(MEASURES as readonly string[]).includes(measure ?? '')) return null;
  return { route: route as CpuRoute, agent: agent as CpuAgent, measure: measure as Measure };
}

/** Splits the CPU of one process among the requests in flight. One per function instance. */
export class CpuMeter {
  private readonly active = new Map<number, string>();
  private readonly totals = new Map<string, CpuTotal>();
  private next = 1;
  /** Zero, not "now": what the process used before its first request is its start-up and counts as `idle`. */
  private last = 0;

  constructor(private readonly cpuMicros: () => number) {}

  private total(key: string): CpuTotal {
    let total = this.totals.get(key);
    if (!total) this.totals.set(key, (total = { cpu: 0, n: 0, ms: 0 }));
    return total;
  }

  private settle(): void {
    const now = this.cpuMicros();
    const spent = now - this.last;
    this.last = now;
    if (!(spent > 0)) return;
    if (this.active.size === 0) {
      this.total(cpuKey('idle', 'none')).cpu += spent;
      return;
    }
    const share = spent / this.active.size;
    for (const key of this.active.values()) this.total(key).cpu += share;
  }

  start(route: CpuRoute, agent: CpuAgent): number {
    this.settle();
    const token = this.next++;
    this.active.set(token, cpuKey(route, agent));
    return token;
  }

  end(token: number, wallMs: number): void {
    const key = this.active.get(token);
    if (key === undefined) return;
    this.settle();
    this.active.delete(token);
    const total = this.total(key);
    total.n += 1;
    total.ms += Math.max(0, wallMs);
  }

  /** What was measured since the last take, as store increments; the meter starts again from nothing. */
  take(): Array<[field: string, by: number]> {
    this.settle();
    const out: Array<[string, number]> = [];
    for (const [key, total] of this.totals) {
      for (const measure of MEASURES) {
        const by = Math.round(total[measure]);
        if (by > 0) out.push([`${key}|${measure}`, by]);
      }
    }
    this.totals.clear();
    return out;
  }
}

export interface CpuRow extends CpuTotal {
  route: CpuRoute;
  agent: CpuAgent;
}

export interface CpuSummary {
  /** Microseconds of CPU over the range. */
  cpu: number;
  n: number;
  /** Sorted by CPU, largest first. */
  rows: CpuRow[];
  byRoute: Array<CpuTotal & { route: CpuRoute }>;
  byAgent: Array<CpuTotal & { agent: CpuAgent }>;
  perDay: Array<{ day: string; cpu: number }>;
}

function number(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Daily hashes into the totals of the range. A field outside the lists is skipped, never guessed into a class. */
export function summarizeCpu(days: string[], hashes: ReadonlyArray<DayHash | null>): CpuSummary {
  const rows = new Map<string, CpuRow>();
  const perDay = days.map((day, i) => {
    let cpu = 0;
    for (const [field, value] of Object.entries(hashes[i] ?? {})) {
      const parsed = parseField(field);
      if (!parsed) continue;
      const key = cpuKey(parsed.route, parsed.agent);
      let row = rows.get(key);
      if (!row) rows.set(key, (row = { route: parsed.route, agent: parsed.agent, cpu: 0, n: 0, ms: 0 }));
      row[parsed.measure] += number(value);
      if (parsed.measure === 'cpu') cpu += number(value);
    }
    return { day, cpu };
  });
  const sorted = [...rows.values()].sort((a, b) => b.cpu - a.cpu);
  const byRoute = new Map<CpuRoute, CpuTotal & { route: CpuRoute }>();
  const byAgent = new Map<CpuAgent, CpuTotal & { agent: CpuAgent }>();
  const addTo = (total: CpuTotal, row: CpuRow) => {
    total.cpu += row.cpu;
    total.n += row.n;
    total.ms += row.ms;
  };
  for (const row of sorted) {
    if (!byRoute.has(row.route)) byRoute.set(row.route, { route: row.route, cpu: 0, n: 0, ms: 0 });
    if (!byAgent.has(row.agent)) byAgent.set(row.agent, { agent: row.agent, cpu: 0, n: 0, ms: 0 });
    addTo(byRoute.get(row.route)!, row);
    addTo(byAgent.get(row.agent)!, row);
  }
  const largestFirst = (a: CpuTotal, b: CpuTotal) => b.cpu - a.cpu;
  return {
    cpu: sorted.reduce((sum, r) => sum + r.cpu, 0),
    n: sorted.reduce((sum, r) => sum + r.n, 0),
    rows: sorted,
    byRoute: [...byRoute.values()].sort(largestFirst),
    byAgent: [...byAgent.values()].sort(largestFirst),
    perDay,
  };
}

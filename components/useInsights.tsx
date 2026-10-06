'use client';

/**
 * The browser half of the analytics (ROADMAP 3.1b, docs/plans/PLAN-3.1-analyse.md §4).
 *
 * One summary per page a reader leaves, sent with `navigator.sendBeacon` to
 * `/api/seen`. **Nothing is written to or read from the reader's device** —
 * no cookie, no localStorage, no sessionStorage (§ 25 TDDDG, plan §6): what
 * the summary needs is held in memory while the page is open, and the
 * previous address within the site is kept in this module's memory, which a
 * reload forgets.
 */
import { createContext, useContext, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Market } from '@/lib/market';
import {
  countClass,
  emptyQuery,
  entryOf,
  landingOf,
  originOf,
  pagesClass,
  positionClass,
  seenClass,
  type BookSignal,
  type Entry,
  type Landing,
  type LandingSignal,
  type Origin,
  type SearchSignal,
  type VERDICTS,
} from '@/lib/insights/signals';

type Location = { path: string; search: string };

/*
  The last two addresses inside the site, in memory only. A client-side
  navigation leaves `document.referrer` as it was when the tab first loaded,
  so where a book page was reached from has to be remembered here.
*/
let current: Location | null = null;
let previous: Location | null = null;

/*
  The channel this tab's visit began with (5.6a), worked out once from the
  first page's `?via=` mark or `document.referrer`, and kept in memory like
  the addresses: a reload asks again, nothing is stored.
*/
let entry: Entry | null = null;

function visitEntry(): Entry {
  entry ??= entryOf(window.location.search, document.referrer, window.location.host);
  return entry;
}

/* The landing page open now (5.6a), summarised when it is left. */
let landing: { page: Landing; first: boolean; opened: boolean; sent: boolean } | null = null;

function flushLanding(): void {
  if (!landing || landing.sent) return;
  landing.sent = true;
  send({ t: 'landing', page: landing.page, entry: visitEntry(), first: landing.first, opened: landing.opened });
}

/**
 * Keeps the two addresses up to date, and summarises each landing page
 * (home, search results, collections, a reader's collection) when it is left.
 * Rendered once, in the root layout.
 */
export function NavMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const here = { path: window.location.pathname, search: window.location.search };
    const first = current === null;
    const moved = current !== null && (current.path !== here.path || current.search !== here.search);
    if (moved) previous = current;
    current = here;
    if (!first && !moved) return;
    visitEntry();
    flushLanding();
    const page = landingOf(here.path, here.search);
    landing = page ? { page, first, opened: false, sent: false } : null;
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.type === 'auxclick' && event.button !== 1) return;
      const href = (event.target as Element | null)?.closest?.('a')?.getAttribute('href');
      if (landing && href?.startsWith('/book/')) landing.opened = true;
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushLanding();
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushLanding);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onClick, true);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushLanding);
    };
  }, []);
  return null;
}

/** The address before this page, whichever of the effects ran first. */
function arrivedFrom(): Location | null {
  const path = window.location.pathname;
  return current && current.path === path ? previous : current;
}

function send(signal: BookSignal | SearchSignal | LandingSignal): void {
  try {
    const body = JSON.stringify(signal);
    if (navigator.sendBeacon) navigator.sendBeacon('/api/seen', new Blob([body], { type: 'text/plain' }));
    else void fetch('/api/seen', { method: 'POST', body, keepalive: true });
  } catch {
    // A number is never worth an error in the reader's console.
  }
}

/**
 * Calls `flush` once when the page is left: the tab hidden, the page
 * unloaded, or the component unmounted by a navigation inside the site.
 */
function useOnLeave(flush: () => void, key: string): void {
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      flushRef.current();
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') once();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', once);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', once);
      once();
    };
  }, [key]);
}

/** Image searches and catalogues: not shops, counted as "found" (plan §4). */
const FINDERS = /(^|\.)(lens\.google\.com|tineye\.com|worldcat\.org|openlibrary\.org)$/;

type Verdict = (typeof VERDICTS)[number];

/** Lets the sidebar say which verdict it showed, without the page reading the DOM. */
export const VerdictReport = createContext<(status: Verdict) => void>(() => {});

export function useReportVerdict(status: Verdict | undefined): void {
  const report = useContext(VerdictReport);
  useEffect(() => {
    if (status) report(status);
  }, [status, report]);
}

interface BookVisit {
  workId: string;
  market: Market;
  pagesLoaded: number;
  picked: boolean;
}

/**
 * The book page's summary (signal `book`). Returns the function the sidebar
 * reports its verdict through.
 */
export function useBookSignal({ workId, market, pagesLoaded, picked }: BookVisit): (status: Verdict) => void {
  const visit = useRef({ from: 'direct' as Origin, entry: 'direct' as Entry, pages: 0, picked: false, verdict: 'none' as Verdict, bought: false, found: false, seen: new Set<string>(), market });

  // Where the reader came from, and the channel the visit began with: once, when the page opens.
  useEffect(() => {
    const before = arrivedFrom();
    visit.current.from = originOf(before, document.referrer, window.location.host, before ? '' : window.location.search);
    visit.current.entry = visitEntry();
  }, [workId]);

  useEffect(() => {
    const v = visit.current;
    v.pages = Math.max(v.pages, pagesLoaded);
    v.picked ||= picked;
    v.market = market;
  });

  // Tiles at least half in view, as the wall grows page by page.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = visit.current.seen;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.coverId;
        if (e.isIntersecting && id) seen.add(id);
      }
    }, { threshold: 0.5 });
    const watch = () => document.querySelectorAll('[data-cover-id]').forEach(el => io.observe(el));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [workId]);

  // A click on a shop goes through /go/; an image search or catalogue does not.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.type === 'auxclick' && event.button !== 1) return;
      const a = (event.target as Element | null)?.closest?.('a');
      const href = a?.getAttribute('href');
      if (!href) return;
      if (href.startsWith('/go/')) visit.current.bought = true;
      else {
        try {
          if (FINDERS.test(new URL(href, window.location.href).host)) visit.current.found = true;
        } catch {
          // not a URL
        }
      }
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onClick, true);
    };
  }, [workId]);

  useOnLeave(() => {
    const v = visit.current;
    send({
      t: 'book',
      work: workId,
      from: v.from,
      market: v.market,
      pages: pagesClass(v.pages),
      seen: seenClass(v.seen.size),
      picked: v.picked,
      verdict: v.verdict,
      bought: v.bought,
      found: v.found,
      entry: v.entry,
    });
  }, workId);

  const reportRef = useRef((status: Verdict) => {
    visit.current.verdict = status;
  });
  return reportRef.current;
}

export interface SearchVisit {
  /** The request this summary is about; a new one ends the old summary. */
  key: string;
  outcome: SearchSignal['outcome'] | null;
  results: number;
  mode: SearchSignal['mode'];
  query: string;
  /** Hrefs of the result cards, in the order shown. */
  hrefs: () => string[];
}

/** The result list's summary (signal `search`). */
export function useSearchSignal(search: SearchVisit): void {
  const state = useRef<{ search: SearchVisit; clicked: number | null }>({ search, clicked: null });
  useEffect(() => {
    state.current.search = search;
  });

  useEffect(() => {
    state.current.clicked = null;
    const onClick = (event: MouseEvent) => {
      if (event.type === 'auxclick' && event.button !== 1) return;
      const href = (event.target as Element | null)?.closest?.('a')?.getAttribute('href');
      if (!href?.startsWith('/book/') || state.current.clicked !== null) return;
      const path = href.split('?')[0];
      const order = [...new Set(state.current.search.hrefs().map(h => h.split('?')[0]))];
      const i = order.indexOf(path);
      if (i >= 0) state.current.clicked = i + 1;
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onClick, true);
    };
  }, [search.key]);

  useOnLeave(() => {
    const { search: s, clicked } = state.current;
    if (!s.key || !s.outcome) return;
    const q = s.outcome === 'empty' ? emptyQuery(s.query) : undefined;
    send({
      t: 'search',
      outcome: s.outcome,
      count: countClass(s.results),
      clicked: positionClass(clicked),
      mode: s.mode,
      ...(q ? { q } : {}),
    });
  }, search.key);
}

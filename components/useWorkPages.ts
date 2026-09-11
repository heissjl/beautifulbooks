'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WorkPageResponse } from '@/app/api/works/[id]/route';
import type { Market } from '@/lib/market';
import type { BuyLink, EditionView, Work } from '@/lib/model';
import { mergeWorkPages, type MergedWork, type Truncation, type WorkPageData } from '@/lib/pages';

/** Wait before retrying a page that failed once. */
const RETRY_DELAY_MS = 2000;

export interface WorkPagesState {
  status: 'loading' | 'notfound' | 'error' | 'ready';
  message?: string;
  work?: Work;
  market?: Market;
  /** The market's own shops searched by the work's title (ROADMAP 1.11). */
  anyEditionLinks: BuyLink[];
  merged: MergedWork<EditionView> | null;
  /** Covers of page 0, for the loading scene. */
  firstCovers: WorkPageData['covers'] | null;
  /** Page 0 has been hashed, so the scene may end (SPEC 8.1). */
  page0Hashed: boolean;
  /**
   * How many pages have arrived. A statement about the whole work — the span
   * of years, the number of publishers — is only safe once more than one is
   * in, because page 0 holds the newest records alone (ROADMAP 1.1).
   */
  pagesLoaded: number;
}

interface Progress {
  key: string;
  status: WorkPagesState['status'];
  message?: string;
  work?: Work;
  market?: Market;
  pages: Array<WorkPageResponse>;
  page0Hashed: boolean;
  done: boolean;
  truncated: Truncation;
}

const EMPTY: WorkPagesState = {
  status: 'loading', anyEditionLinks: [], merged: null, firstCovers: null, page0Hashed: false, pagesLoaded: 0,
};

/**
 * Walks that finished, kept for the length of the tab (Julian, 2026-09-09:
 * „wenn ich von decade zu cover wall zurückgehe brauche ich den
 * ladebildschirm nicht, die bilder sollten schnell da stehen").
 *
 * Going back used to replay the whole sequence — every page fetched again,
 * the loading scene again, and the folding built up from nothing again, even
 * though the browser still had every image. Only a **finished** walk is kept,
 * so a run abandoned half way is not mistaken for the whole work.
 *
 * Deliberately not `sessionStorage`: this holds parsed objects worth
 * megabytes, it is worthless after a reload (the images are re-fetched
 * anyway), and a quota error in the middle of a navigation would be a poor
 * trade for a cache that is only a convenience.
 */
const FINISHED = new Map<string, Progress>();
/** Enough for a few books' worth of going back and forth; the oldest goes first. */
const FINISHED_LIMIT = 5;

function remember(key: string, p: Progress) {
  if (FINISHED.has(key)) FINISHED.delete(key);
  FINISHED.set(key, p);
  while (FINISHED.size > FINISHED_LIMIT) {
    const oldest = FINISHED.keys().next().value;
    if (oldest === undefined) break;
    FINISHED.delete(oldest);
  }
}

/**
 * Loads a work page by page (SPEC §9.3 step 11).
 *
 * Open Library orders editions by record age, so page 0 holds the most
 * recently catalogued printings and little else: for The Great Gatsby it
 * carries 6 of the work's 379 covers. The hook therefore keeps asking for
 * the next page in the background and hands the caller everything that has
 * arrived. Page 0 is fetched twice, first without hashing so the loading
 * scene starts immediately, then with signatures so duplicates can be
 * folded; every later page is fetched with signatures directly.
 *
 * Pages load one after the other on purpose: Open Library does not answer
 * parallel edition requests any faster, and sequential requests fill the
 * shared response cache page by page for the next visitor.
 */
export function useWorkPages(workId: string, lang: string, market: Market | undefined): WorkPagesState {
  const requestKey = `${workId} ${lang} ${market ?? ''}`;
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKey;
    const query = (id: string, offset: number, signatures: boolean, sibling: boolean) => {
      const base = `/api/works/${encodeURIComponent(id)}`;
      const params = new URLSearchParams();
      if (offset > 0) params.set('offset', String(offset));
      if (signatures) params.set('signatures', '1');
      if (sibling) params.set('sibling', '1');
      if (market) params.set('market', market);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    };

    /** Resolves to the page, or null when the work is gone; throws on transport errors. */
    const loadPage = async (
      offset: number, signatures: boolean, id = workId, sibling = false,
    ): Promise<WorkPageResponse | null> => {
      const res = await fetch(query(id, offset, signatures, sibling), { signal: controller.signal });
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
      return (await res.json()) as WorkPageResponse;
    };

    /**
     * Open Library answers a slow editions request in 13 s now and then, past
     * the 12 s timeout, and a single such request used to leave the whole
     * page dead with "data source unavailable" (seen on Mumbo Jumbo,
     * 2026-09-07). One retry costs a moment and the second attempt is served
     * from the cache the first one filled.
     */
    const loadFirstPage = async (): Promise<WorkPageResponse | null> => {
      try {
        return await loadPage(0, false);
      } catch (err) {
        if (controller.signal.aborted) throw err;
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        if (controller.signal.aborted) throw err;
        return loadPage(0, false);
      }
    };

    // Already walked in this tab: nothing to fetch, nothing to assemble.
    if (FINISHED.has(key)) return;

    /*
      The walk owns this key, so it can keep the progress locally and hand
      React a finished object each time. That also gives the end of the walk
      something to remember without reading state back out of React.
    */
    let state: Progress | null = null;
    const put = (p: Progress) => {
      if (controller.signal.aborted) return;
      state = p;
      setProgress(p);
    };
    const update = (fn: (p: Progress) => Progress) => {
      if (!state || controller.signal.aborted) return;
      put(fn(state));
    };
    const finish = () => {
      if (state && state.status === 'ready' && !controller.signal.aborted) remember(key, state);
    };

    (async () => {
      let first: WorkPageResponse | null;
      try {
        first = await loadFirstPage();
      } catch (err) {
        if (controller.signal.aborted) return;
        put({
          key, status: 'error', message: err instanceof Error ? err.message : 'Request failed',
          pages: [], page0Hashed: false, done: true, truncated: 'error',
        });
        return;
      }
      if (controller.signal.aborted) return;
      if (!first) {
        put({ key, status: 'notfound', pages: [], page0Hashed: false, done: true, truncated: null });
        return;
      }
      put({
        key, status: 'ready', work: first.work, market: first.market, pages: [first],
        page0Hashed: false, done: first.page.nextOffset === undefined, truncated: null,
      });

      // Same page again, this time hashed: the data is cached, only the
      // hashing costs time, and the loading scene may end once it lands.
      try {
        const hashed = await loadPage(0, true);
        if (hashed) update(p => ({ ...p, pages: [hashed, ...p.pages.slice(1)], page0Hashed: true }));
        else update(p => ({ ...p, page0Hashed: true }));
      } catch {
        // Hashing failed: fold nothing, but never leave the scene hanging.
        update(p => ({ ...p, page0Hashed: true }));
      }
      if (controller.signal.aborted) return;

      /** One record's pages from `start` on; false when it stopped on errors. */
      const walk = async (id: string, start: number | undefined, sibling: boolean): Promise<boolean> => {
        let next = start;
        let retried = false;
        while (next !== undefined && !controller.signal.aborted) {
          let page: WorkPageResponse | null;
          try {
            page = await loadPage(next, true, id, sibling);
            retried = false;
          } catch {
            if (controller.signal.aborted) return true;
            if (!retried) {
              retried = true;
              await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
              continue;
            }
            return false;
          }
          if (controller.signal.aborted || !page) return true;
          const loaded = page;
          const offset: number = next;
          const following = loaded.page.nextOffset;
          update(p => ({
            ...p,
            pages: p.pages.some(q => q.work.id === loaded.work.id && q.page.offset === offset) ? p.pages : [...p.pages, loaded],
            // No next offset while records remain means the scan cap stopped us.
            truncated: following === undefined && offset + loaded.page.limit < loaded.page.total ? 'cap' : p.truncated,
          }));
          next = following;
        }
        return true;
      };

      /*
        The work's own pages first, then the other records of the same book
        (ROADMAP 6.13): the card that led here merged them, and a wall that
        loaded only this record showed 8 of the 14 editions its card named.
        Siblings come last because they are mostly a page each, while the
        lead can hold a thousand editions the reader came for.
      */
      const complete = await walk(workId, first.page.nextOffset, false)
        && await (async () => {
          for (const s of first.siblings ?? []) {
            if (!(await walk(s.id, 0, true))) return false;
          }
          return true;
        })();
      if (controller.signal.aborted) return;
      // Twice in a row without an answer: stop loading, keep what we have and say so.
      update(p => ({ ...p, done: true, truncated: complete ? p.truncated : 'error' }));
      finish();
    })();

    return () => controller.abort();
  }, [requestKey, workId, market]);

  return useMemo<WorkPagesState>(() => {
    /*
      A finished walk from earlier in this tab counts as the current one, so
      going back to a book shows it whole and folded immediately instead of
      replaying the loading scene. Read during render rather than copied into
      state: a walk this hook did not start has nothing to set.
    */
    const known = progress && progress.key === requestKey ? progress : FINISHED.get(requestKey);
    if (!known) return EMPTY;
    if (known.status !== 'ready') {
      return { ...EMPTY, status: known.status, message: known.message };
    }
    const pages: WorkPageData<EditionView>[] = known.pages;
    // The count under the title names the book, not the record: the card
    // that led here added its siblings' editions too (ROADMAP 6.13).
    const siblings = known.pages[0]?.siblings ?? [];
    const work = known.work && siblings.length > 0
      ? { ...known.work, editionCount: siblings.reduce((n, s) => n + (s.editionCount ?? 0), known.work.editionCount ?? 0) || undefined }
      : known.work;
    return {
      status: 'ready',
      work,
      market: known.market,
      anyEditionLinks: known.pages[0]?.anyEditionLinks ?? [],
      merged: mergeWorkPages(pages, { done: known.done, truncated: known.truncated }),
      firstCovers: known.pages[0]?.covers ?? null,
      page0Hashed: known.page0Hashed,
      pagesLoaded: pages.length,
    };
  }, [progress, requestKey]);
}

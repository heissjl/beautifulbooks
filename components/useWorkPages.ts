'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WorkPageResponse } from '@/app/api/works/[id]/route';
import type { Market } from '@/lib/market';
import type { EditionView, Work } from '@/lib/model';
import { mergeWorkPages, type MergedWork, type Truncation, type WorkPageData } from '@/lib/pages';

/** Wait before retrying a page that failed once. */
const RETRY_DELAY_MS = 2000;

export interface WorkPagesState {
  status: 'loading' | 'notfound' | 'error' | 'ready';
  message?: string;
  work?: Work;
  market?: Market;
  merged: MergedWork<EditionView> | null;
  /** Covers of page 0, for the loading scene. */
  firstCovers: WorkPageData['covers'] | null;
  /** Page 0 has been hashed, so the scene may end (SPEC 8.1). */
  page0Hashed: boolean;
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
  status: 'loading', merged: null, firstCovers: null, page0Hashed: false,
};

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
    const base = `/api/works/${encodeURIComponent(workId)}`;
    const query = (offset: number, signatures: boolean) => {
      const params = new URLSearchParams();
      if (offset > 0) params.set('offset', String(offset));
      if (signatures) params.set('signatures', '1');
      if (market) params.set('market', market);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    };

    /** Resolves to the page, or null when the work is gone; throws on transport errors. */
    const loadPage = async (offset: number, signatures: boolean): Promise<WorkPageResponse | null> => {
      const res = await fetch(query(offset, signatures), { signal: controller.signal });
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
      return (await res.json()) as WorkPageResponse;
    };

    const update = (fn: (p: Progress) => Progress) => {
      if (controller.signal.aborted) return;
      setProgress(prev => (prev && prev.key === key ? fn(prev) : prev));
    };

    (async () => {
      let first: WorkPageResponse | null;
      try {
        first = await loadPage(0, false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setProgress({
          key, status: 'error', message: err instanceof Error ? err.message : 'Request failed',
          pages: [], page0Hashed: false, done: true, truncated: 'error',
        });
        return;
      }
      if (controller.signal.aborted) return;
      if (!first) {
        setProgress({ key, status: 'notfound', pages: [], page0Hashed: false, done: true, truncated: null });
        return;
      }
      setProgress({
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

      let next = first.page.nextOffset;
      let retried = false;
      while (next !== undefined && !controller.signal.aborted) {
        let page: WorkPageResponse | null;
        try {
          page = await loadPage(next, true);
          retried = false;
        } catch {
          if (controller.signal.aborted) return;
          if (!retried) {
            retried = true;
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          // Twice in a row: stop loading, keep what we have and say so.
          update(p => ({ ...p, done: true, truncated: 'error' }));
          return;
        }
        if (controller.signal.aborted) return;
        if (!page) break;
        const offset: number = next;
        const following = page.page.nextOffset;
        update(p => ({
          ...p,
          pages: p.pages.some(q => q.page.offset === offset) ? p.pages : [...p.pages, page],
          done: following === undefined,
          // No next offset while records remain means the scan cap stopped us.
          truncated: following === undefined && offset + page.page.limit < page.page.total ? 'cap' : p.truncated,
        }));
        next = following;
      }
      update(p => ({ ...p, done: true }));
    })();

    return () => controller.abort();
  }, [requestKey, workId, market]);

  return useMemo<WorkPagesState>(() => {
    if (!progress || progress.key !== requestKey) return EMPTY;
    if (progress.status !== 'ready') {
      return { ...EMPTY, status: progress.status, message: progress.message };
    }
    const pages: WorkPageData<EditionView>[] = progress.pages;
    return {
      status: 'ready',
      work: progress.work,
      market: progress.market,
      merged: mergeWorkPages(pages, { done: progress.done, truncated: progress.truncated }),
      firstCovers: progress.pages[0]?.covers ?? null,
      page0Hashed: progress.page0Hashed,
    };
  }, [progress, requestKey]);
}

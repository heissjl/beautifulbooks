'use client';

import { useEffect, useState } from 'react';
import type { IsbnCoversResponse } from '@/app/api/isbn/[isbn]/route';
import type { Cover } from '@/lib/model';
import type { ImageSignature } from '@/lib/imagesig';

export interface IsbnCoverResult {
  /** Covers the trade shows, ready to be merged into the wall. */
  covers: Cover[];
  signatures: Map<string, ImageSignature>;
  /** ISBNs asked for so far, so callers can tell "no image" from "not asked". */
  asked: Set<string>;
  /** Cover ids the shop shows, per ISBN; empty when it shows none. */
  byIsbn: Map<string, string[]>;
}

const EMPTY: IsbnCoverResult = { covers: [], signatures: new Map(), asked: new Set(), byIsbn: new Map() };

interface Store {
  key: string;
  byIsbn: Map<string, IsbnCoversResponse>;
  /** Edition ids to attach to each ISBN's covers, learned from the wall. */
  editionsByIsbn: Map<string, string[]>;
}

/**
 * Asks what a shop currently shows for the ISBNs of the selected cover
 * (SPEC §9.3 step 13a).
 *
 * This used to run for ten ISBNs while the work loaded, which spent six to
 * ten Google requests per page view on editions nobody clicked (§8.7). Now
 * one ISBN is asked when its cover is selected, the answer is remembered for
 * the rest of the visit, and the images join the wall where they belong.
 *
 * `resetKey` clears the memory when the work or market changes.
 */
export function useIsbnCovers(resetKey: string, isbns: readonly string[], editionIdsByIsbn: ReadonlyMap<string, string[]>): IsbnCoverResult {
  const [store, setStore] = useState<Store>({ key: '', byIsbn: new Map(), editionsByIsbn: new Map() });
  const wanted = isbns.filter(Boolean).join(',');

  useEffect(() => {
    const controller = new AbortController();
    const list = wanted ? wanted.split(',') : [];

    (async () => {
      for (const isbn of list) {
        try {
          const res = await fetch(`/api/isbn/${encodeURIComponent(isbn)}?signatures=1`, { signal: controller.signal });
          if (!res.ok) continue;
          const data = (await res.json()) as IsbnCoversResponse;
          if (controller.signal.aborted) return;
          // The source was down, not silent: forget it so a later selection
          // asks again instead of reporting "no cover on record".
          if (data.unavailable) continue;
          setStore(prev => {
            const byIsbn = new Map(prev.key === resetKey ? prev.byIsbn : []);
            if (byIsbn.has(data.isbn13)) return prev;
            byIsbn.set(data.isbn13, data);
            const editionsByIsbn = new Map(prev.key === resetKey ? prev.editionsByIsbn : []);
            editionsByIsbn.set(data.isbn13, editionIdsByIsbn.get(data.isbn13) ?? []);
            return { key: resetKey, byIsbn, editionsByIsbn };
          });
        } catch {
          // Offline or aborted: the wall simply keeps the covers it has.
        }
      }
    })();

    return () => controller.abort();
    // editionIdsByIsbn is read at fetch time only; it must not restart the requests.
  }, [resetKey, wanted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (store.key !== resetKey) return EMPTY;

  const covers: Cover[] = [];
  const signatures = new Map<string, ImageSignature>();
  const byIsbn = new Map<string, string[]>();
  for (const [isbn, data] of store.byIsbn) {
    const editionIds = store.editionsByIsbn.get(isbn) ?? [];
    byIsbn.set(isbn, data.covers.map(c => c.id));
    if (editionIds.length === 0) continue;
    for (const cover of data.covers) covers.push({ ...cover, editionIds });
    for (const [id, sig] of Object.entries(data.signatures ?? {})) signatures.set(id, sig);
  }
  return { covers, signatures, asked: new Set(store.byIsbn.keys()), byIsbn };
}

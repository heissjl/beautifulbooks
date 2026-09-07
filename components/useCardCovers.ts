'use client';

import { useEffect, useRef, useState } from 'react';
import type { WorkSummaryResponse } from '@/app/api/works/[id]/route';
import { withSlot } from './coverQueue';

const MOSAIC_MAX = 4;

/**
 * Fills a search card's mosaic with covers of several editions
 * (SPEC §9.3 step 14).
 *
 * The search itself cannot supply them: Open Library returns one cover per
 * work, and the Google Books call attached a second one to 17 of 129 cards in
 * the measurement behind §9.1 D, so nearly every card showed a single image.
 * Each card therefore asks for its work's first edition page. That page is
 * the same cached response the detail page loads first, so the request is
 * also a head start on the click.
 *
 * The plan said to ask only for cards in view, via IntersectionObserver.
 * That is dropped: a result page holds at most twenty cards, `coverQueue`
 * already limits the traffic to eight requests at a time, and every answer is
 * cached for a day on the server. Waiting for a card to scroll into view
 * bought little and added a failure mode — the observer does not fire at all
 * in some embedded browsers, which left most cards with a single cover and
 * no way to tell why (2026-09-07).
 */
export function useCardCovers(workId: string, initial: readonly string[]): string[] {
  const [loaded, setLoaded] = useState<{ id: string; urls: string[] } | null>(null);
  const asked = useRef('');

  useEffect(() => {
    if (asked.current === workId) return;
    asked.current = workId;
    withSlot(async () => {
      // Deliberately not abortable: the answer is cheap, cached, and warms
      // the detail page even when the reader has moved on.
      const res = await fetch(`/api/works/${encodeURIComponent(workId)}?summary=1`);
      return res.ok ? ((await res.json()) as WorkSummaryResponse) : null;
    })
      .then(data => {
        if (data?.coverUrls?.length) setLoaded({ id: workId, urls: data.coverUrls });
      })
      .catch(() => {
        // A card that keeps its single cover is a small loss; never surface it.
      });
  }, [workId]);

  // The search's own cover leads: it is the one Open Library picked for the
  // work, and swapping it out after the fact would make the grid jump.
  const merged = [...initial];
  if (loaded?.id === workId) {
    for (const url of loaded.urls) {
      if (merged.length >= MOSAIC_MAX) break;
      if (!merged.includes(url)) merged.push(url);
    }
  }
  return merged.slice(0, MOSAIC_MAX);
}

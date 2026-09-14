'use client';

import { useEffect, useRef, useState } from 'react';
import type { WorkSummaryResponse } from '@/app/api/works/[id]/route';
import { withSlot } from './coverQueue';
import { distinctCovers } from './coverHash';
import { MOSAIC_CANDIDATES, MOSAIC_COVERS } from '@/lib/works';

/** Pause before the second attempt at a card's mosaic, the same as a tile's (6.31). */
const MOSAIC_RETRY_MS = 1500;

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
 *
 * **No repeats by image** (ROADMAP 6.34). The route tells printings apart by
 * publisher and year only, and on 2026-09-11 three of eight cards for "David
 * Foster Wallace" showed one picture twice under two Open Library ids (hash
 * distance 0, 2 and 8). So the route sends up to eight candidates, the browser
 * hashes them as the wall would, and the card shows the first four that
 * differ. Until that is decided the card keeps its single search cover, so no
 * tile is swapped in front of the reader.
 */
export function useCardCovers(workId: string, initial: readonly string[]): string[] {
  const [loaded, setLoaded] = useState<{ id: string; urls: string[] } | null>(null);
  const asked = useRef('');

  useEffect(() => {
    if (asked.current === workId) return;
    asked.current = workId;
    // Deliberately not abortable: the answer is cheap, cached, and warms the
    // detail page even when the reader has moved on.
    const ask = () => withSlot(async () => {
      const res = await fetch(`/api/works/${encodeURIComponent(workId)}?summary=1`);
      if (res.ok) return (await res.json()) as WorkSummaryResponse;
      // Silence from the catalogue is worth a second attempt; a 404 or a 429
      // is an answer, and asking again would only repeat it.
      if (res.status >= 500) throw new Error(`mosaic answered ${res.status}`);
      return null;
    });
    /*
      One more attempt after a pause (ROADMAP 6.5). Seen on "alice in
      wonderland", 2026-09-08: one mosaic request answered 503 and the card
      kept a single cover, which reads as a book with one cover rather than a
      source that did not answer. The retry from 1.10 sat in the search path
      only. The pause is spent outside the queue, so a failing card does not
      hold one of its eight places while it waits.
    */
    ask()
      .catch(() => new Promise(resolve => setTimeout(resolve, MOSAIC_RETRY_MS)).then(ask))
      .then(data => {
        if (data?.coverUrls?.length) setLoaded({ id: workId, urls: data.coverUrls });
      })
      .catch(() => {
        // Twice without an answer: the card keeps its search cover, which is
        // a real cover of this book — never an empty tile.
      });
  }, [workId]);

  // The search's own cover leads: it is the one Open Library picked for the
  // work, and swapping it out after the fact would make the grid jump.
  const candidates = [...initial];
  if (loaded?.id === workId) {
    for (const url of loaded.urls) {
      if (candidates.length >= MOSAIC_CANDIDATES) break;
      if (!candidates.includes(url)) candidates.push(url);
    }
  }
  const distinct = useDistinct(candidates.slice(0, MOSAIC_CANDIDATES));
  return distinct ?? initial.slice(0, MOSAIC_COVERS);
}

/**
 * The candidates without repeats, or null while they are being compared.
 * Keyed by the list itself, so a new list starts over without an effect that
 * resets state (`react-hooks/set-state-in-effect`).
 */
function useDistinct(candidates: readonly string[]): string[] | null {
  const key = candidates.join('\n');
  const [result, setResult] = useState<{ key: string; urls: string[] } | null>(null);

  useEffect(() => {
    const list = key ? key.split('\n') : [];
    if (list.length <= 1) return;
    let alive = true;
    distinctCovers(list, MOSAIC_COVERS).then(urls => {
      if (alive) setResult({ key, urls });
    });
    return () => { alive = false; };
  }, [key]);

  if (candidates.length <= 1) return [...candidates];
  return result?.key === key ? result.urls : null;
}

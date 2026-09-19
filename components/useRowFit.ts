'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

/** What `lib/rowfit.ts` needs to know about a row of pills, measured in the browser. */
export interface RowMeasure {
  /** Width of each probe pill, by its `data-k`. */
  widths: Readonly<Record<string, number>>;
  rowWidth: number;
  gap: number;
  /** Two rows on a phone, three from `sm` up (Julian, 2026-09-11). */
  maxRows: number;
  /** Width the heading takes in the first row; 0 where it has a row of its own. */
  start: number;
}

/** The site's phone/desktop breakpoint, Tailwind's `sm`. */
const DESKTOP = '(min-width: 640px)';

/**
 * Measures a wrapping row of pills and an invisible probe that holds one copy
 * of every pill, so the widths of pills that are currently hidden are known
 * too (ROADMAP 6.8).
 *
 * The same shape as `useOverflowsX`: callback refs rather than ref objects
 * (`react-hooks/refs`), and state is set only from the `ResizeObserver`
 * callback, never in an effect body (`react-hooks/set-state-in-effect`). The
 * probe is observed as well as the row, because a new pill changes the
 * probe's width while the row's may stay the same.
 */
export function useRowFit() {
  const [measure, setMeasure] = useState<RowMeasure | null>(null);
  const elements = useRef<{ row: HTMLElement | null; probe: HTMLElement | null }>({ row: null, probe: null });
  const observer = useRef<ResizeObserver | null>(null);

  const read = useCallback(() => {
    const { row, probe } = elements.current;
    if (!row || !probe) return;
    const widths: Record<string, number> = {};
    for (const child of Array.from(probe.children)) {
      const key = (child as HTMLElement).dataset.k;
      if (key) widths[key] = child.getBoundingClientRect().width;
    }
    const desktop = window.matchMedia(DESKTOP).matches;
    // The heading sits inline in the first row from `sm` up, with `mr-2`.
    const start = desktop ? (widths.kicker ?? 0) + 8 : 0;
    setMeasure({
      widths,
      rowWidth: row.clientWidth,
      gap: parseFloat(getComputedStyle(row).columnGap) || 8,
      maxRows: desktop ? 3 : 2,
      start,
    });
  }, []);

  const attach = useCallback(
    (slot: 'row' | 'probe') =>
      (element: HTMLElement | null) => {
        elements.current[slot] = element;
        if (!element || typeof ResizeObserver === 'undefined') return;
        observer.current ??= new ResizeObserver(read);
        observer.current.observe(element);
        return () => {
          observer.current?.unobserve(element);
          if (elements.current[slot] === element) elements.current[slot] = null;
        };
      },
    [read],
  );

  const row = useMemo(() => attach('row'), [attach]);
  const probe = useMemo(() => attach('probe'), [attach]);

  return { row, probe, measure };
}

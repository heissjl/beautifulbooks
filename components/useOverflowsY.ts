'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Does a column that scrolls on its own hold more below what is on screen?
 * The vertical twin of `useOverflowsX` (6.14a), for the sidebar and the
 * phone's sheet (Julian, 2026-09-26: „we have to make sure people know that
 * the sidebar is sometimes longer than one sees at first look"). On a Mac the
 * scrollbar is invisible until one scrolls, so without a sign the local
 * bookshops at the bottom are simply not there.
 *
 * Callback refs for the same reason as in `useOverflowsX`: a ref object read
 * in render trips `react-hooks/refs`. `scrollMore` is for event handlers only.
 */
export function useOverflowsY() {
  const [overflows, setOverflows] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  /** How far the column's own bottom edge lies below the window's — the hint sits this much higher. */
  const [hiddenBelow, setHiddenBelow] = useState(0);
  const elements = useRef<{ box: HTMLElement | null; inner: HTMLElement | null }>({ box: null, inner: null });
  const observer = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    const { box } = elements.current;
    if (!box) return;
    /*
      The sidebar starts lower than its sticky place until the page scrolls,
      so its bottom edge can lie below the window: measure against the part
      that is actually on screen, not the box.
    */
    const hidden = Math.max(0, Math.round(box.getBoundingClientRect().bottom - window.innerHeight));
    const visible = box.clientHeight - hidden;
    setHiddenBelow(hidden);
    setOverflows(box.scrollHeight > visible + 1);
    setAtEnd(box.scrollTop + visible >= box.scrollHeight - 8);
  }, []);

  const attach = useCallback(
    (slot: 'box' | 'inner') =>
      (element: HTMLElement | null) => {
        elements.current[slot] = element;
        if (!element || typeof ResizeObserver === 'undefined') return;
        observer.current ??= new ResizeObserver(measure);
        observer.current.observe(element);
        if (slot === 'box') {
          window.addEventListener('scroll', measure, { passive: true });
          window.addEventListener('resize', measure);
        }
        return () => {
          if (slot === 'box') {
            window.removeEventListener('scroll', measure);
            window.removeEventListener('resize', measure);
          }
          observer.current?.unobserve(element);
          if (elements.current[slot] === element) elements.current[slot] = null;
        };
      },
    [measure],
  );

  const scroller = useMemo(() => attach('box'), [attach]);
  const content = useMemo(() => attach('inner'), [attach]);
  const scrollMore = useCallback(() => {
    const box = elements.current.box;
    if (!box) return;
    const hidden = Math.max(0, box.getBoundingClientRect().bottom - window.innerHeight);
    const visible = box.clientHeight - hidden;
    // At the end of its own scroll, what is left lies below the window: scroll the page instead.
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 1) window.scrollBy({ top: Math.round(hidden + 16), behavior: 'smooth' });
    else box.scrollBy({ top: Math.round(visible * 0.7), behavior: 'smooth' });
  }, []);

  return { scroller, content, overflows, atEnd, hiddenBelow, onScroll: measure, scrollMore };
}

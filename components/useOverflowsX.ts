'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Does a row of tiles run past the box it sits in — and has the reader
 * already scrolled to its end? (ROADMAP 6.14a, and the fade the tab row on a
 * phone was noted as missing in 6.5.)
 *
 * A row that scrolls sideways needs to *say* so: without a fading edge the
 * eighth tile is simply not there, and nobody scrolls a row that looks
 * complete. But a fade over a row that fits would hide a slice of the last
 * tile for no reason, so the edge is shown only when the content is wider
 * than the box, and taken away again once the end is in view.
 *
 * Two elements are observed rather than one, because a `ResizeObserver`
 * reports *box* changes: the scroller's box changes when the column narrows,
 * the content's box changes when a tile is added. Comparing `scrollWidth`
 * inside a single observer would miss the second case.
 *
 * **Callback refs, not ref objects.** The repo's `react-hooks/refs` rule
 * refuses a ref object handed around during render, and it is right to: a
 * hook that returns `{ scroller, content }` as `useRef` objects makes the
 * component read them in render to pass them on. Callback refs are plain
 * functions, the observer attaches the moment an element mounts, and its
 * first delivery — which the browser guarantees on `observe()` — sets the
 * initial state without any effect.
 */
export function useOverflowsX() {
  const [overflows, setOverflows] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const elements = useRef<{ box: HTMLElement | null; inner: HTMLElement | null }>({ box: null, inner: null });
  const observer = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    const { box, inner } = elements.current;
    if (!box || !inner) return;
    setOverflows(inner.offsetWidth > box.clientWidth + 1);
    setAtEnd(box.scrollLeft + box.clientWidth >= box.scrollWidth - 1);
  }, []);

  const attach = useCallback(
    (slot: 'box' | 'inner') =>
      (element: HTMLElement | null) => {
        elements.current[slot] = element;
        if (!element || typeof ResizeObserver === 'undefined') return;
        observer.current ??= new ResizeObserver(measure);
        observer.current.observe(element);
        return () => {
          observer.current?.unobserve(element);
          if (elements.current[slot] === element) elements.current[slot] = null;
        };
      },
    [measure],
  );

  const scroller = useMemo(() => attach('box'), [attach]);
  const content = useMemo(() => attach('inner'), [attach]);

  return { scroller, content, overflows, atEnd, onScroll: measure };
}

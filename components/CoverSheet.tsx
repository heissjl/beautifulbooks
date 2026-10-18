'use client';

import { useEffect, useRef, useState } from 'react';
import CoverImage from './CoverImage';
import MoreBelow from './MoreBelow';
import { useOverflowsY } from './useOverflowsY';
import { useT } from './i18n';

interface CoverSheetProps {
  coverUrl: string;
  /** "Scribner 1996" style line for the selected cover. */
  caption: string;
  /** Sits beside "Details" in the bar: sharing belongs where the cover is. */
  share?: React.ReactNode;
  /**
   * In the sheet's header beside "Close", in place of the "Selected cover"
   * line (ROADMAP 6.77: "Add to collection"). The dialog keeps its
   * name for a screen reader either way.
   */
  headerAction?: React.ReactNode;
  /** The selected cover's id: closing brings its tile into view (ROADMAP 6.5). */
  selectedId?: string;
  /**
   * Leafing through the covers without leaving the sheet (ROADMAP 6.5, Julian
   * 2026-10-18: arrows with "3 of 41" between them). `prev`/`next` are cover
   * ids in the order of the wall's language group; absent at the ends.
   */
  step?: {
    prev?: string;
    next?: string;
    prevCaption?: string;
    nextCaption?: string;
    n: number;
    total: number;
    onStep: (coverId: string) => void;
  };
  children: React.ReactNode;
}

/**
 * The selected cover's details on a phone (SPEC §10 E13).
 *
 * On a wide screen the details sit in a sidebar next to the wall. On 375 px
 * there is no second column, so they end up *below* the wall — and a wall of
 * 329 covers in three columns is about 110 rows of scrolling, which makes
 * selecting a cover feel like it does nothing (measured 2026-09-07). The same
 * complaint Julian made about the desktop sidebar, only unsolvable by
 * scrolling.
 *
 * So: a bar pinned to the bottom answers "did my tap do anything?" without a
 * single scroll, and doubles as the handle of a sheet holding the details.
 */
export default function CoverSheet({ coverUrl, caption, share, headerAction, selectedId, step, children }: CoverSheetProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const prevButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  // `bodyScroller` is a callback ref; this one keeps the element for the scroll back to the top on a step.
  const bodyEl = useRef<HTMLDivElement | null>(null);
  /*
    Closing lands on the cover the reader leafed to (6.5): before, the way back
    to the wall was close, scroll, find, tap. Measured on 2026-09-07 as four
    actions where one was expected. The jump happens after the sheet is gone
    and the body may scroll again, in a handler, never in an effect.
  */
  const close = () => {
    setOpen(false);
    if (!selectedId) return;
    // After the frame in which the sheet leaves and the effect's cleanup gives the body its scroll back:
    // in the same frame (one rAF) the page did not move, measured 2026-10-18.
    requestAnimationFrame(() => setTimeout(() => {
      const tile = document.querySelector<HTMLElement>(`[data-cover-id="${CSS.escape(selectedId)}"]`);
      if (!tile) return;
      const r = tile.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) tile.scrollIntoView({ block: 'center' });
    }, 0));
  };
  const leaf = (coverId: string | undefined, pressed: 'prev' | 'next') => {
    if (!coverId || !step) return;
    step.onStep(coverId);
    // The new cover's details start at the top; a pressed arrow that is about to vanish hands its focus to the other.
    bodyEl.current?.scrollTo(0, 0);
    const atEnd = pressed === 'next' ? step.n + 1 >= step.total : step.n - 1 <= 1;
    if (atEnd) (pressed === 'next' ? prevButton : nextButton).current?.focus();
  };
  // The sheet's body scrolls; the same sign as the sidebar while there is more below.
  const { scroller: bodyScroller, content: bodyContent, overflows: bodyOverflows, atEnd: bodyAtEnd, onScroll: measureBody, scrollMore: bodyMore } = useOverflowsY();
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  /*
    The bar is fixed to the bottom and covered the footer — About, Impressum,
    Privacy — even scrolled to the end: a tap on "Impressum" landed on the bar
    (ROADMAP 6.57, browser test 2026-09-26). While the bar is there, the page
    gets exactly its height as room at the bottom. On a wide screen the bar is
    `lg:hidden`, so it measures 0 and the page gets nothing.
  */
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const body = document.body;
    const measure = () => { body.style.paddingBottom = el.offsetHeight ? `${el.offsetHeight}px` : ''; };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      body.style.paddingBottom = '';
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // The same path as the Close button, including the jump to the tile (6.5).
        closeButton.current?.click();
        return;
      }
      /*
        The sheet says aria-modal, so Tab must stay inside it (6.57): it used
        to walk out into the page hidden behind the backdrop.
      */
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = Array.from(
        dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter(el => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    // Whatever the list above misses (an element the browser tabs to that the
    // selector does not name), focus that lands outside goes back to Close.
    const onFocusIn = (event: FocusEvent) => {
      if (dialog.current && event.target instanceof Node && !dialog.current.contains(event.target)) closeButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    // The sheet covers the page; letting the wall scroll behind it means
    // closing the sheet lands somewhere else than where it was opened.
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const returnTo = opener.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = '';
      // Back to the bar that opened it, not to <body> (6.57).
      returnTo?.focus();
    };
  }, [open]);

  return (
    <>
      {/*
        The bar is a row, not one big button: the share control has to sit
        beside "Details" (Julian, 2026-09-09) and a button cannot live inside
        a button. The tappable area keeps everything except that control.
      */}
      <div ref={bar} className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-line bg-bg/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
        <button
          ref={opener}
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-surface-2">
            <CoverImage src={coverUrl} alt="" sizes="40px" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">{t('Selected cover')}</span>
            <span className="block truncate text-xs text-ink-3">{caption || t('Publisher, ISBN and where to find it')}</span>
          </span>
          <span className="btn shrink-0 py-1.5 text-xs">{t('Details')}</span>
        </button>
        {share}
      </div>

      {open && (
        <div ref={dialog} className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('Selected cover')}>
          <button
            type="button"
            aria-label={t('Close')}
            tabIndex={-1}
            className="absolute inset-0 bg-black/50"
            onClick={close}
          />
          <div className="absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-2xl bg-bg shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              {headerAction ? <div className="min-w-0">{headerAction}</div> : <p className="kicker">{t('Selected cover')}</p>}
              <button
                ref={closeButton}
                type="button"
                onClick={close}
                className="btn py-1.5 text-xs"
              >
                {t('Close')}
              </button>
            </div>
            {/*
              One thin row of its own (6.5): the header already carries "Add to
              collection" and "Close", a third group did not fit at 390 px. It
              costs the body about 36 px; measured on 2026-10-18 that the first
              shop row still shows without scrolling.
            */}
            {step && step.total > 1 && (
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-1.5 text-xs text-ink-2">
                <button
                  ref={prevButton}
                  type="button"
                  disabled={!step.prev}
                  onClick={() => leaf(step.prev, 'prev')}
                  aria-label={t('Previous cover')}
                  title={step.prevCaption}
                  className="btn px-3 py-1 text-xs disabled:opacity-30"
                >
                  ←
                </button>
                <span aria-live="polite">{t('{n} of {total}', { n: step.n, total: step.total })}</span>
                <button
                  ref={nextButton}
                  type="button"
                  disabled={!step.next}
                  onClick={() => leaf(step.next, 'next')}
                  aria-label={t('Next cover')}
                  title={step.nextCaption}
                  className="btn px-3 py-1 text-xs disabled:opacity-30"
                >
                  →
                </button>
              </div>
            )}
            <div
              ref={el => {
                bodyEl.current = el;
                return bodyScroller(el);
              }}
              onScroll={measureBody} className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-5">
              <div ref={bodyContent}>{children}</div>
              <MoreBelow show={bodyOverflows && !bodyAtEnd} onMore={bodyMore} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

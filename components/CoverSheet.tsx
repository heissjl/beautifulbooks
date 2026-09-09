'use client';

import { useEffect, useRef, useState } from 'react';
import CoverImage from './CoverImage';

interface CoverSheetProps {
  coverUrl: string;
  /** "Scribner 1996" style line for the selected cover. */
  caption: string;
  /** Sits beside "Details" in the bar: sharing belongs where the cover is. */
  share?: React.ReactNode;
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
export default function CoverSheet({ coverUrl, caption, share, children }: CoverSheetProps) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    // The sheet covers the page; letting the wall scroll behind it means
    // closing the sheet lands somewhere else than where it was opened.
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/*
        The bar is a row, not one big button: the share control has to sit
        beside "Details" (Julian, 2026-09-09) and a button cannot live inside
        a button. The tappable area keeps everything except that control.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-line bg-bg/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
        <button
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
            <span className="block text-sm font-medium text-ink">Selected cover</span>
            <span className="block truncate text-xs text-ink-3">{caption || 'Publisher, ISBN and where to find it'}</span>
          </span>
          <span className="btn shrink-0 py-1.5 text-xs">Details</span>
        </button>
        {share}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Selected cover">
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-2xl bg-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="kicker">Selected cover</p>
              <button
                ref={closeButton}
                type="button"
                onClick={() => setOpen(false)}
                className="btn py-1.5 text-xs"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-5">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

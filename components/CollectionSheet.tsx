'use client';

import { useEffect, useRef, useState } from 'react';
import CoverImage from './CoverImage';
import { coverUrlFor } from '@/lib/coverurl';
import { tileCoverId, type PublicWall } from '@/lib/walls/model';

/**
 * The collection being filled, on a phone (ROADMAP 5.13m, step 5): a bar at
 * the bottom — the last covers, "You are adding to", the title and the count
 * — that opens a sheet with the whole collection. On a wide screen the same
 * panel stands beside the covers instead; the two are exclusive
 * (`useIsDesktop`), like the book page's sidebar and `CoverSheet`, whose
 * pattern this follows: the page gets the bar's height as room at the bottom,
 * Escape closes, focus goes in and comes back.
 */
export default function CollectionSheet({ wall, fresh, children }: { wall: PublicWall; fresh: ReadonlySet<string>; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  // The fixed bar would cover the end of the page and the footer; give the page its height.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const body = document.body;
    const measure = () => {
      body.style.paddingBottom = el.offsetHeight ? `${el.offsetHeight}px` : '';
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      body.style.paddingBottom = '';
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closer.current?.focus();
    const returnTo = opener.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      returnTo?.focus();
    };
  }, [open]);

  const last = wall.tiles.slice(-3);
  return (
    <>
      <div ref={bar} className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-accent bg-surface/95 px-4 py-2.5 backdrop-blur-sm">
        <button ref={opener} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className="flex w-full items-center gap-3 text-left">
          <span className="flex shrink-0 gap-1" aria-hidden="true">
            {last.length === 0 && <span className="h-11 w-7 rounded-[2px] border border-dashed border-line" />}
            {last.map((t) => (
              <span key={t.coverId} className={`relative h-11 w-7 overflow-hidden rounded-[2px] bg-surface-2 ${fresh.has(t.coverId) ? 'ring-2 ring-accent' : ''}`}>
                <CoverImage src={coverUrlFor(tileCoverId(t), 'S') ?? ''} alt="" sizes="28px" />
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-accent">You are adding to</span>
            <span className="block truncate text-sm text-ink">
              {wall.title} <span className="text-ink-3">· {wall.tiles.length}</span>
            </span>
          </span>
          <span className="btn shrink-0 py-1.5 text-xs">Open</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`The collection ${wall.title}`}>
          <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-2xl bg-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="kicker">Your collection</p>
              <button ref={closer} type="button" onClick={() => setOpen(false)} className="btn py-1.5 text-xs">
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

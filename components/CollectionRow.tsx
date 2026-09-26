'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import CoverImage from './CoverImage';
import { useOverflowsX } from './useOverflowsX';
import { storeWorkPreview } from './useWorkPreview';
import { olCover } from '@/lib/curated';
import type { WallWork } from '@/lib/collections';
import { coverProxyPath } from '@/lib/coverurl';

/** Covers in a row on /collections before "All n →". */
export const ROW_MAX = 24;

/**
 * The "All n →" tile shows a mosaic of the collection's covers, like the
 * loading mosaics (Julian, 2026-09-26). Columns grow with the collection —
 * √n / 2.2, held between 3 and 6 — so 25 books make 3 × 5 minis of about a
 * third of the tile, 76 make 4 × 6, and 150 or more stop at 6 × 9 rather than
 * turning into dust. The covers the row does not already show come first.
 */
export function mosaicGrid(total: number): { cols: number; rows: number } {
  const cols = Math.min(6, Math.max(3, Math.round(Math.sqrt(total) / 2.2)));
  return { cols, rows: Math.round(cols * 1.5) };
}

/** Tile width: five covers and 5/6 of the sixth from `sm` (gap 1rem): row = 5⅚ tiles + 5 gaps; on a phone 2⅚ (gap 0.75rem). */
const TILE = 'shrink-0 snap-start w-[calc((100cqw-1.5rem)/2.8333)] sm:w-[calc((100cqw-5rem)/5.8333)]';
/** The fade: about one and a half tiles wide, so it starts on the fifth cover and deepens gently over the sixth. */
/** Six or fewer covers: from `sm` they all fit side by side (six columns), so nothing scrolls or fades there; on a phone the row still scrolls. */
const TILE_FEW = 'shrink-0 snap-start w-[calc((100cqw-1.5rem)/2.8333)] sm:w-[calc((100cqw-5rem)/6)]';
const FADE = 'w-[calc((100cqw-1.5rem)/2.8333*1.3)] sm:w-[calc((100cqw-5rem)/5.8333*1.5)]';

/**
 * One collection's covers as a row that scrolls sideways (Julian, 2026-09-26:
 * „can we make the collection previews on the /collections site scrollable?
 * … can be lazy loading"). The title link above it stays as it was; here each
 * tile opens its own cover, as on the collection's wall, and the last tile
 * leads to the whole collection. Images load as they scroll into view
 * (`next/image` is lazy by default), so the page does not grow by 24 covers a
 * collection. The fading edge is shown only while there is more to the
 * right, the same rule as the row of scans on a book page (6.14a).
 */
export default function CollectionRow({ slug, title, works, total }: { slug: string; title: string; works: WallWork[]; total: number }) {
  const { scroller, content, overflows, atEnd, onScroll } = useOverflowsX();
  // Julian, 2026-09-26: „when the collection is 6 covers or less, don't have a fading or scrolling. unless you are showing less items on a smaller screen".
  const tile = total <= 6 ? TILE_FEW : TILE;
  /*
    The mosaic sits at the end of a row that scrolls sideways, where lazy
    images would wait until the reader has scrolled all the way (Julian,
    2026-09-26: „make sure the mosaics are pre-loaded"). So it loads as soon
    as the row comes near the screen vertically, at low priority, and is ready
    before anyone scrolls to it.
  */
  const [warm, setWarm] = useState(false);
  const watchRow = useCallback((el: HTMLDivElement | null) => {
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setWarm(true);
        io.disconnect();
      }
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    /*
      Five covers and 5/6 of the sixth on a desktop, two and 5/6 on a phone
      (Julian, 2026-09-26: „show 5/6 of the 6th book … make the fading wider,
      more gradient, less sudden"), sized from the row's own width (container units), so the fading
      edge always lies over the sixth (third) cover (Julian, 2026-09-26: „make
      the fading less extreme on the collection row and make it happen on the
      6th book").
    */
    <div ref={watchRow} className="relative mt-4 @container">
      <div ref={scroller} onScroll={onScroll} className="snap-x overflow-x-auto pb-2 [scrollbar-width:thin]">
        <ul ref={content} className="flex w-max gap-3 sm:gap-4" aria-label={`Covers from ${title}`}>
          {works.slice(0, ROW_MAX).map(w => {
            const target = w.coverWork ?? w.id;
            return (
              <li key={w.id} className={tile}>
                <Link
                  href={`/book/${target}?cover=${encodeURIComponent(`ol:${w.coverId}`)}`}
                  onClick={() => storeWorkPreview(target, { title: w.title, authors: [w.author], coverUrls: [olCover(w.coverId, 'L')] })}
                  className="group block focus-visible:outline-none"
                >
                  <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg">
                    <CoverImage src={olCover(w.coverId, 'M')} alt={`${w.title} by ${w.author}`} sizes="160px" />
                  </div>
                </Link>
              </li>
            );
          })}
          {total > ROW_MAX && (() => {
            const { cols, rows } = mosaicGrid(total);
            const pool = [...works.slice(ROW_MAX), ...works.slice(0, ROW_MAX)];
            const minis = Array.from({ length: cols * rows }, (_, i) => pool[i % pool.length]);
            return (
              <li className={TILE}>
                <Link
                  href={`/collections/${slug}`}
                  className="group relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  <div aria-hidden className="grid h-full w-full gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                    {warm && minis.map((w, i) => (
                      // eslint-disable-next-line @next/next/no-img-element -- dozens of small thumbnails through the site's cached /img route (N8); next/image would add its own optimiser request per mini
                      <img key={`${w.id}-${i}`} src={coverProxyPath(`ol:${w.coverId}`, 'S')} alt="" loading="eager" fetchPriority="low" decoding="async" className="h-full w-full rounded-[2px] object-cover" />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45 transition-colors group-hover:bg-black/35">
                    <span className="rounded-full bg-bg/90 px-3 py-1.5 text-sm font-medium text-ink shadow">
                      All {total} <span aria-hidden="true">&rarr;</span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })()}
        </ul>
      </div>
      {overflows && !atEnd && (
        <div aria-hidden className={`pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-bg/60 via-bg/15 to-transparent ${FADE}`} />
      )}
    </div>
  );
}

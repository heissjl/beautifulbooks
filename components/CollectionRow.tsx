'use client';

import Link from 'next/link';
import CoverImage from './CoverImage';
import { useOverflowsX } from './useOverflowsX';
import { storeWorkPreview } from './useWorkPreview';
import { olCover } from '@/lib/curated';
import type { WallWork } from '@/lib/collections';

/** Covers in a row on /collections before "All n →". */
export const ROW_MAX = 24;

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
  return (
    <div className="relative mt-4">
      <div ref={scroller} onScroll={onScroll} className="snap-x overflow-x-auto pb-2 [scrollbar-width:thin]">
        <ul ref={content} className="flex w-max gap-3 sm:gap-4" aria-label={`Covers from ${title}`}>
          {works.slice(0, ROW_MAX).map(w => {
            const target = w.coverWork ?? w.id;
            return (
              <li key={w.id} className="w-28 shrink-0 snap-start sm:w-36 lg:w-40">
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
          {total > ROW_MAX && (
            <li className="w-28 shrink-0 snap-start sm:w-36 lg:w-40">
              <Link
                href={`/collections/${slug}`}
                className="flex aspect-[2/3] items-center justify-center rounded-card border border-line bg-surface text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent"
              >
                All {total} <span aria-hidden="true" className="ml-1">&rarr;</span>
              </Link>
            </li>
          )}
        </ul>
      </div>
      {overflows && !atEnd && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent" />
      )}
    </div>
  );
}

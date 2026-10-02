'use client';

import Link from 'next/link';
import CoverImage from './CoverImage';
import { storeWorkPreview } from './useWorkPreview';
import { wallCover } from '@/lib/curated';
import type { WallWork } from '@/lib/collections';
import { coverProxyPath } from '@/lib/coverurl';

/** Covers a card can show before the mosaic: two rows of five. */
export const GRID_SHOWN = 9;
/** Minis in the mosaic tile, a 3 × 3 square of the covers that come next. */
const MOSAIC = 9;

/**
 * One collection on /collections as two rows of covers with a mosaic of the
 * next ones as the last tile (ROADMAP 5.10l, variant D; Julian, 2026-09-30:
 * „setze das um“, after the mockup with its window-dependent layout).
 *
 * How many covers a row holds follows the window, so a cover never drops much
 * below 100 px: five a row on a desktop with two cards side by side (from
 * `xl`), four from `lg` where two cards leave less room, five again in one
 * column from `sm`, four on a phone. Always two rows; where a row holds four,
 * the eighth and ninth covers step aside so the mosaic stays the last tile.
 *
 * The mosaic shows the covers after the ninth — never ones already in the rows
 * (Julian, 2026-09-29: „das mosaik sollte die nächsten 9 cover zeigen“) — and
 * its label sizes itself to the tile (container units), since at 90 px a fixed
 * 14 px label crowded the tile („deutlich zu groß … bei einer kleinen
 * fenstergröße“).
 */
export default function CollectionGrid({ slug, title, works, total }: { slug: string; title: string; works: WallWork[]; total: number }) {
  const shown = works.slice(0, GRID_SHOWN);
  const more = total > shown.length;
  const next = works.slice(GRID_SHOWN);
  const pool = next.length > 0 ? next : works;
  const minis = more ? Array.from({ length: MOSAIC }, (_, i) => pool[i % pool.length]) : [];
  return (
    <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5" aria-label={`Covers from ${title}`}>
      {shown.map((w, i) => {
        const target = w.coverWork ?? w.id;
        // Where a row holds four (phone, and two cards at lg), the 8th and 9th step aside for the mosaic.
        const aside = more && i >= 7 ? 'hidden sm:block lg:hidden xl:block' : '';
        return (
          <li key={`${w.id}:${w.image ?? w.coverId}`} className={aside}>
            <Link
              href={w.image ? `/book/${target}` : `/book/${target}?cover=${encodeURIComponent(`ol:${w.coverId}`)}`}
              onClick={() => storeWorkPreview(target, { title: w.title, authors: [w.author], coverUrls: [wallCover(w, 'L')] })}
              className="group block focus-visible:outline-none"
            >
              <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg">
                <CoverImage src={wallCover(w, 'M')} alt={`${w.title} by ${w.author}`} sizes="(max-width: 640px) 25vw, (max-width: 1024px) 20vw, 120px" />
              </div>
            </Link>
          </li>
        );
      })}
      {more && (
        <li>
          <Link
            href={`/collections/${slug}`}
            className="@container group relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <div aria-hidden className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0.5">
              {minis.map((w, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- nine small thumbnails through the site's cached /img route (N8); next/image would add an optimiser request per mini
                <img key={`${w.id}-${i}`} src={w.image ?? coverProxyPath(`ol:${w.coverId}`, 'S')} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-[2px] object-cover" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 transition-colors group-hover:bg-black/35">
              <span className="max-w-[92%] whitespace-nowrap rounded-full bg-bg/90 px-[0.75em] py-[0.35em] text-[clamp(9px,10cqw,13px)] font-medium leading-tight text-ink shadow">
                All {total}
              </span>
            </div>
          </Link>
        </li>
      )}
    </ul>
  );
}

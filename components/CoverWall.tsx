'use client';

import Link from 'next/link';
import CoverImage from './CoverImage';
import { storeWorkPreview } from './useWorkPreview';
import { olCover, type CuratedWork } from '@/lib/curated';
import type { WallWork } from '@/lib/collections';
import { tileTitle } from '@/lib/normalize';

interface CoverWallProps {
  works: Array<CuratedWork | WallWork>;
}

/**
 * A wall of hand-picked covers, one per work, each linking to the work's own
 * wall: the home page's curated eighteen (SPEC §8.1) and every thematic
 * collection (SPEC F8) use the same grid, so a collection looks like the page
 * a reader already knows.
 */
export default function CoverWall({ works }: CoverWallProps) {
  return (
    <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:gap-6">
      {works.map(w => (
        <li key={w.id}>
          <Link
            href={`/book/${w.id}`}
            className="group block focus-visible:outline-none"
            onClick={() => storeWorkPreview(w.id, { title: w.title, authors: [w.author], coverUrls: [olCover(w.coverId, 'L')] })}
          >
            <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg">
              <CoverImage src={olCover(w.coverId, 'M')} alt={`${w.title} by ${w.author}`} sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw" />
            </div>
            {/*
              Two lines each, as on the result cards. One line cut 9 of 18
              titles on a phone and 1 on a desktop — "Der…" is not a
              shorter "Der Steppenwolf", it is no title (ROADMAP 6.30, N14).
            */}
            <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-accent transition-colors">{tileTitle(w.title)}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-3">{w.author}</p>
            {/*
              The cover artist, only on collections that show credits (6.52)
              and only where ISFDB names one for this printing; the page says
              where the names come from.
            */}
            {'coverArtists' in w && w.coverArtists && w.coverArtists.length > 0 && (
              <p className="mt-0.5 line-clamp-1 text-[11px] italic leading-snug text-ink-3">Cover: {w.coverArtists.join(', ')}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

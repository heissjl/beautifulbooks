'use client';

import Link from 'next/link';
import CoverImage from './CoverImage';
import { storeWorkPreview } from './useWorkPreview';
import { WALL_WORKS, olCover } from '@/lib/curated';
import { tileTitle } from '@/lib/normalize';

/** Empty-state cover wall on the home page (SPEC §8.1). */
export default function CuratedWall() {
  return (
    <section aria-labelledby="curated-heading">
      <div className="mb-5">
        <h2 id="curated-heading" className="text-2xl text-ink">Start with a classic</h2>
      </div>
      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:gap-6">
        {WALL_WORKS.map(w => (
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
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

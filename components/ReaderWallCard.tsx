import Link from 'next/link';
import CoverImage from './CoverImage';
import { coverUrlFor } from '@/lib/coverurl';
import type { PublicWall } from '@/lib/walls/model';

const SHOWN = 8;

/**
 * One reader's wall on Walls by readers (ROADMAP 5.13d): title, their lines,
 * and the first covers as the site shows covers everywhere else — no frames.
 */
export default function ReaderWallCard({ wall }: { wall: PublicWall }) {
  const more = wall.tiles.length - SHOWN;
  return (
    <Link href={`/c/${wall.id}`} className="group block">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2 className="truncate font-display text-2xl text-ink transition-colors group-hover:text-accent">{wall.title}</h2>
        <p className="shrink-0 text-sm text-ink-3">
          {wall.tiles.length} covers <span aria-hidden="true">&rarr;</span>
        </p>
      </div>
      {wall.by && <p className="mt-2 text-xs text-ink-3">by {wall.by}</p>}
      {wall.intro && <p className="mt-2 line-clamp-2 text-sm text-ink-2">{wall.intro}</p>}
      <ul className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
        {wall.tiles.slice(0, SHOWN).map((t, i) => (
          <li key={t.coverId} className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2">
            <CoverImage src={coverUrlFor(`ol:${t.coverId}`, 'M') ?? ''} alt={t.author ? `${t.title} by ${t.author}` : t.title} sizes="(max-width: 768px) 25vw, 12vw" />
            {i === SHOWN - 1 && more > 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-medium text-white">+{more}</span>
            )}
          </li>
        ))}
      </ul>
    </Link>
  );
}

import Link from 'next/link';
import CoverImage from './CoverImage';
import { coverUrlFor } from '@/lib/coverurl';
import type { PublicWall } from '@/lib/walls/model';

/** A reader's wall as a card: four covers, the title, the start of the paragraph (5.13d). */
export default function WallCard({ wall }: { wall: PublicWall }) {
  return (
    <Link href={`/w/${wall.id}`} className="group block rounded-card border border-line bg-surface p-3 transition-colors hover:border-accent">
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 4 }, (_, i) => wall.tiles[i]).map((t, i) => (
          <span key={t?.coverId ?? i} className="relative block aspect-[2/3] overflow-hidden rounded-[2px] bg-surface-2">
            {t && <CoverImage src={coverUrlFor(`ol:${t.coverId}`, 'M') ?? ''} alt="" sizes="80px" />}
          </span>
        ))}
      </div>
      <p className="mt-3 truncate font-display text-lg text-ink group-hover:text-accent">{wall.title}</p>
      {wall.intro && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{wall.intro}</p>}
      <p className="mt-1 text-xs text-ink-3">{wall.tiles.length} covers</p>
    </Link>
  );
}

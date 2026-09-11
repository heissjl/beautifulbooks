import Link from 'next/link';
import CoverImage from './CoverImage';
import HeroRondell from './HeroRondell';
import { coverUrlFor } from '@/lib/coverurl';
import { HERO_FAN, HERO_RING_IDS } from '@/lib/herofan';

/**
 * Seven covers of one book on a turning ring beside the headline (ROADMAP
 * 1.9). It began as a fan of four in the loading stage's tiles; Julian chose
 * the ring on 2026-09-11, with seven, because at an odd count the far covers
 * stand between the near ones instead of hidden right behind them.
 *
 * The whole thing is one link to the book's wall: what it shows is a way in,
 * not decoration. It renders from `lg` up only; below that the column is the
 * headline's, and a picture there would push the search field under the fold,
 * which 1.9 rules out.
 */
export default function HeroFan({ className = '' }: { className?: string }) {
  const { workId, title, author } = HERO_FAN;
  return (
    <Link
      href={`/book/${workId}`}
      className={`group block shrink-0 text-center ${className}`}
      aria-label={`${title} by ${author}: seven of its covers. Open the wall.`}
    >
      <HeroRondell
        faces={HERO_RING_IDS.map(id => (
          <div key={id} className="cover-shadow relative h-full w-full overflow-hidden rounded-[4px] bg-surface-2">
            <CoverImage src={coverUrlFor(id, 'M') ?? ''} alt="" sizes="100px" priority />
          </div>
        ))}
      />
      {/* The book, not a count (Julian 2026-09-11): the covers on the ring are plain to see. */}
      <p className="mt-3 text-xs text-ink-3 transition-colors group-hover:text-ink-2">
        <span className="text-ink-2">{title}</span> · {author}
      </p>
    </Link>
  );
}

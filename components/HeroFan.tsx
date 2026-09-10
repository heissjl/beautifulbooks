import Link from 'next/link';
import CoverImage from './CoverImage';
import { coverUrlFor } from '@/lib/coverurl';
import { HERO_FAN, HERO_FAN_TILTS } from '@/lib/herofan';

/**
 * Four covers of one book, fanned out beside the headline (ROADMAP 1.9).
 *
 * The same tiles as the loading stage (`.stage-tile` in globals.css) at a
 * third of the size, so the picture is one the site already speaks in. The
 * scale is set inline — `--stage-w` and `--spread` — which outranks the
 * stage's own media queries, so this fan does not grow with the viewport the
 * way the loading stage does.
 *
 * The whole thing is one link to the book's wall: what it shows is a way in,
 * not decoration. It renders from `lg` up only; below that the column is the
 * headline's, and a fan there would push the search field under the fold,
 * which 1.9 rules out.
 */
export default function HeroFan({ className = '' }: { className?: string }) {
  const { workId, title, author, coverIds } = HERO_FAN;
  const n = coverIds.length;
  return (
    <Link
      href={`/book/${workId}`}
      className={`group block shrink-0 text-center ${className}`}
      aria-label={`${title} by ${author}: four of its covers. Open the wall.`}
      style={{ ['--stage-w' as string]: '6.25rem', ['--spread' as string]: '38px' }}
    >
      {/* Tall enough for the outer tiles' tilt; wide enough for 1.5 spreads each side. */}
      <div className="relative mx-auto h-[10.5rem] w-[14.5rem]">
        {coverIds.map((id, i) => (
          <div
            key={id}
            className="stage-tile transition-transform duration-500 group-hover:[--spread:46px]"
            style={{ ['--i' as string]: `${i - (n - 1) / 2}`, ['--tilt' as string]: `${HERO_FAN_TILTS[i]}deg`, zIndex: i }}
          >
            <div className="cover-shadow relative h-full w-full overflow-hidden rounded-[4px] bg-surface-2">
              <CoverImage src={coverUrlFor(id, 'M') ?? ''} alt="" sizes="100px" priority />
            </div>
          </div>
        ))}
      </div>
      {/* No count: it would move with the catalogue, and §1 forbids a figure the page cannot stand behind. */}
      <p className="mt-3 text-xs text-ink-3 transition-colors group-hover:text-ink-2">
        <span className="text-ink-2">{title}</span> · four of its covers
      </p>
    </Link>
  );
}

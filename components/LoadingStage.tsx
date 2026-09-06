'use client';

import Image from 'next/image';

export interface StageCover {
  id: string;
  url: string;
}

interface LoadingStageProps {
  /** Covers whose images have arrived, in arrival order (at most a handful). */
  covers: StageCover[];
  /** Shown while nothing has arrived yet, e.g. the cover from the result card. */
  hero?: string;
  /** Total covers expected once known, for the caption. */
  expected?: number;
}

/** Slight alternating tilt so the fan reads as a stack of books. */
const TILTS = [-4, 3, -2, 5, -3, 2];

/**
 * The loading scene (SPEC 8.1): instead of an empty grid filling up, the
 * first covers that arrive are staged large, fanned like a stack. Tiles
 * carry `data-stage-cover-id` so the page can fly them to their gallery
 * slots when the scene ends.
 */
export default function LoadingStage({ covers, hero, expected }: LoadingStageProps) {
  const shown = covers.slice(-4);
  const caption =
    covers.length === 0
      ? 'Collecting covers'
      : expected
        ? `${covers.length} of ${expected} covers here`
        : `${covers.length} cover${covers.length === 1 ? '' : 's'} here`;

  return (
    <div className="relative flex min-h-[26rem] items-center justify-center py-8" aria-live="polite" aria-busy="true" aria-label="Loading covers">
      <div className="relative h-72 w-full max-w-lg sm:h-80">
        {shown.length === 0 && hero && (
          <div className="stage-in absolute left-1/2 top-1/2 h-64 w-44 -translate-x-1/2 -translate-y-1/2 sm:h-72 sm:w-48">
            <div className="cover-shadow relative h-full w-full animate-pulse overflow-hidden rounded-card bg-surface-2">
              <Image src={hero} alt="" fill sizes="192px" className="object-cover" unoptimized priority />
            </div>
          </div>
        )}
        {shown.map((c, i) => {
          const n = shown.length;
          const offset = (i - (n - 1) / 2) * 56;
          return (
            <div
              key={c.id}
              data-stage-cover-id={c.id}
              className="stage-in absolute left-1/2 top-1/2 h-64 w-44 sm:h-72 sm:w-48"
              style={{
                marginLeft: '-5.5rem',
                marginTop: '-8rem',
                transform: `translateX(${offset}px) rotate(${TILTS[i % TILTS.length]}deg)`,
                ['--tilt' as string]: `${TILTS[i % TILTS.length]}deg`,
                zIndex: i,
              }}
            >
              <div className="cover-shadow relative h-full w-full overflow-hidden rounded-card bg-surface-2">
                <Image src={c.url} alt="" fill sizes="192px" className="object-cover" unoptimized priority />
              </div>
            </div>
          );
        })}
      </div>
      <p className="stage-pulse absolute bottom-0 left-0 right-0 text-center text-sm text-ink-3">{caption}</p>
    </div>
  );
}

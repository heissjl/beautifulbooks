'use client';

import Image from 'next/image';
import { proxiedCoverSrc } from '@/lib/coverurl';
import AssemblingWall from './AssemblingWall';

export interface StageCover {
  id: string;
  url: string;
}

interface LoadingStageProps {
  /** Covers on stage, in presentation order (at most a handful). */
  covers: StageCover[];
  /** Shown while nothing has arrived yet, e.g. the cover from the result card. */
  hero?: string;
  /** Total covers expected once known, for the caption. */
  expected?: number;
}

/** Slight alternating tilt so the fan reads as a stack of books. */
const TILTS = [-4, 3, -2, 5];
/*
  The step between fanned covers lives in CSS (`--spread` on `.stage`), so it
  can shrink on a phone; here a tile only says which step it sits on.
*/

/**
 * The loading scene (SPEC 8.1): instead of an empty grid filling up, the
 * first covers that arrive are staged large, fanned like a stack. Position
 * and tilt are CSS variables so the entrance animation keeps them. Tiles
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

  /*
    Nothing of this book has arrived yet and no card sent a cover along, which
    is what every visit from outside looks like. An empty stage with a caption
    under it was measured as several seconds of blank page on a phone; the
    assembling wall fills them with the site's own picture.
  */
  if (shown.length === 0 && !hero) {
    return <AssemblingWall caption={caption} />;
  }

  return (
    <div className="stage relative flex min-h-[26rem] items-center justify-center py-6 sm:min-h-[38rem]" aria-live="polite" aria-busy="true" aria-label="Loading covers">
      <div className="relative h-[20rem] w-full max-w-3xl sm:h-[30rem]">
        {shown.length === 0 && hero && (
          <div className="stage-tile stage-in" style={{ ['--dx' as string]: '0px', ['--tilt' as string]: '0deg' }}>
            <div className="cover-shadow relative h-full w-full animate-pulse overflow-hidden rounded-card bg-surface-2">
              <Image src={proxiedCoverSrc(hero)} alt="" fill sizes="288px" className="object-cover" unoptimized priority />
            </div>
          </div>
        )}
        {shown.map((c, i) => {
          const n = shown.length;
          return (
            <div
              key={c.id}
              data-stage-cover-id={c.id}
              className="stage-tile stage-in"
              style={{ ['--i' as string]: `${i - (n - 1) / 2}`, ['--tilt' as string]: `${TILTS[i % TILTS.length]}deg`, zIndex: i }}
            >
              <div className="cover-shadow relative h-full w-full overflow-hidden rounded-card bg-surface-2">
                <Image src={proxiedCoverSrc(c.url)} alt="" fill sizes="288px" className="object-cover" unoptimized priority />
              </div>
            </div>
          );
        })}
      </div>
      <p className="stage-pulse absolute bottom-0 left-0 right-0 text-center text-sm text-ink-3">{caption}</p>
    </div>
  );
}

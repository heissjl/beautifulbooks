'use client';

import Image from 'next/image';
import { proxiedCoverSrc } from '@/lib/coverurl';
import MosaicLoader from './MosaicLoader';

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
    Nothing of this book has arrived yet and no card sent a cover along.
    **That is what every visit from outside looks like** — a search engine, a
    shared link, or the way back from the decade page — and it was measured as
    several seconds of blank page on a phone.
    
    Since 2026-09-10 those seconds get the mosaic (Julian: „Werkseite von
    außen sollte ein Mosaik bekommen und Jahrzehnte-Seite → zurück auch"),
    which is the same picture the search and the decade page wait in front of.
    `MosaicLoader` itself falls back to the small cover wall until its file is
    there, so nothing is lost on a slow connection.
  */
  if (shown.length === 0 && !hero) {
    return <MosaicLoader caption={caption} />;
  }

  return (
    /*
      The caption sits above the picture and in the flow, not laid over it
      (Julian, 2026-09-09: „der ladetext sollte grafisch über dem mosaik
      stehen, nicht als overlay"). It used to be pinned to the bottom of the
      stage, where it crossed the fanned covers on a narrow screen — and a
      line of type over a picture reads as a label for it, which is the one
      thing this text must not be: it says what is being waited for, not what
      is shown.
    */
    <div className="stage flex min-h-[26rem] flex-col items-center justify-center gap-5 py-6 sm:min-h-[38rem]" aria-live="polite" aria-busy="true" aria-label="Loading covers">
      <p className="stage-pulse text-center text-sm text-ink-3">{caption}</p>
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
    </div>
  );
}

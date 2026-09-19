'use client';

import { useState } from 'react';
import Image from 'next/image';
import { proxiedCoverSrc } from '@/lib/coverurl';
import MosaicLoader from './MosaicLoader';

export interface StageCover {
  id: string;
  /**
   * The address to render, **already through `/img`**.
   *
   * `useLoadingScene` proxies it before preloading it, so that the preload,
   * this tile and the wall tile all ask for the same thing (ROADMAP 6.25a).
   * Proxying it a second time here would be a no-op — `coverRefFromUrl`
   * returns null for our own path — but saying so is better than relying on
   * it.
   */
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
  /*
    Which staged covers have actually painted.

    The scene stages a cover once **its own** preload has loaded, which since
    2026-09-10 is the same address this tile renders — so this is normally
    true on the first frame. It is here as the guarantee rather than the
    mechanism: a frame without a picture in it is the thing Julian saw
    („hier also auch das Skelett der Animation gemacht wird, ohne dass es mit
    einem Bild befüllt ist"), and no cache reasoning should be able to bring
    it back.
  */
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const shown = covers.slice(-4);
  const heroSrc = hero ? proxiedCoverSrc(hero) : null;
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
          /*
            The card's cover, taken over from the hero above: already painted,
            so it neither enters again nor fades in from nothing — the fan
            grows out of the picture that was standing there (ROADMAP 6.25a).
          */
          const standing = heroSrc !== null && c.url === heroSrc;
          return (
            <div
              key={c.id}
              data-stage-cover-id={c.id}
              className={`stage-tile ${standing ? '' : 'stage-in'}`}
              style={{ ['--i' as string]: `${i - (n - 1) / 2}`, ['--tilt' as string]: `${TILTS[i % TILTS.length]}deg`, zIndex: i }}
            >
              <div className="cover-shadow relative h-full w-full overflow-hidden rounded-card bg-surface-2">
                <Image
                  src={c.url}
                  alt=""
                  fill
                  sizes="288px"
                  className={`object-cover transition-opacity duration-300 ${standing || loaded.has(c.id) ? 'opacity-100' : 'opacity-0'}`}
                  unoptimized
                  priority
                  onLoad={() => setLoaded(prev => (prev.has(c.id) ? prev : new Set(prev).add(c.id)))}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

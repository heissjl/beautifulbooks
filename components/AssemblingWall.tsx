'use client';

import CoverImage from './CoverImage';
import { WALL_WORKS, olCover } from '@/lib/curated';

/**
 * The picture both waits show: covers assembling into a small wall, tile by
 * tile (ROADMAP 6.19).
 *
 * Used while a search runs (1-13 s against Open Library) and during the first
 * seconds of a work's page, before any of its own covers have arrived — on a
 * link from outside, that phase used to be an empty area with the words
 * "Collecting covers" under it, measured on a phone at 2026-09-09.
 *
 * **The tiles are the covers the home page already carries.** No new asset,
 * no request on the usual path, nothing to keep in sync. And they are small,
 * dimmed and unlabelled on purpose: whatever a reader is waiting for, this
 * must not be mistaken for an answer to it (SPEC §4 N12).
 *
 * All motion is CSS (`.searching-tile`), so nothing runs on the main thread;
 * `prefers-reduced-motion` gets the block standing still.
 */
export default function AssemblingWall({ caption, tiles = 12 }: { caption: string; tiles?: number }) {
  const shown = WALL_WORKS.slice(0, tiles);
  return (
    <div className="py-10 sm:py-14" aria-busy="true" aria-live="polite" aria-label={caption}>
      {/*
        Three across on a phone, six on a desktop — the same rhythm as the
        home page's wall, so what a reader watches being built has the shape
        of the thing it is building.
      */}
      <div className="mx-auto grid max-w-[13.5rem] grid-cols-3 gap-2 sm:max-w-[27rem] sm:grid-cols-6 sm:gap-2.5">
        {shown.map((w, i) => (
          <div
            key={w.id}
            className="searching-tile cover-shadow relative aspect-[2/3] overflow-hidden rounded-[3px] bg-surface-2"
            style={{ ['--n' as string]: `${i}` }}
          >
            <CoverImage src={olCover(w.coverId, 'S')} alt="" sizes="60px" />
          </div>
        ))}
      </div>
      <p className="stage-pulse mt-6 text-center text-sm text-ink-3">{caption}</p>
    </div>
  );
}

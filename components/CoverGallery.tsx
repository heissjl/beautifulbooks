'use client';

import { useState } from 'react';
import CoverImage from './CoverImage';
import type { Cover } from '@/lib/model';
import { languageName } from '@/lib/normalize';

export interface CoverTab {
  language?: string;
  covers: Cover[];
}

interface CoverGalleryProps {
  /** Already ordered by the server (SPEC §3 F2.3). */
  groups: CoverTab[];
  /** Every cover of the wall, newest first, for the "All languages" pill (ROADMAP 6.8). */
  allCovers: readonly Cover[];
  selectedCover: Cover | null;
  onSelectCover: (cover: Cover) => void;
  /** Caption per cover id, e.g. "Scribner 1996". */
  captions: ReadonlyMap<string, string>;
  /**
   * Rendered directly under the language pills (Julian, 2026-09-09: „den link
   * unter die pillen, nicht darüber").
   *
   * A slot rather than the link itself, so the gallery keeps knowing nothing
   * about decade pages — which of them exist is `data/decade-pages.json`, and
   * that belongs to the page, not to a list of covers.
   */
  belowTabs?: React.ReactNode;
}

const tabKey = (g: CoverTab) => g.language ?? 'unknown';
/** The key of the "All languages" pill; no language code is spelled like it. */
const ALL = '*all';
/**
 * How many language tabs a phone shows before the rest stand behind "+n".
 * Six is two rows at 375-390 px with the usual names; a book with seventeen
 * translations wrapped into six rows and pushed the first cover off the
 * screen (measured 2026-09-07), which is why the row used to scroll sideways.
 */
const PHONE_TABS = 6;

export default function CoverGallery({ groups, allCovers, selectedCover, onSelectCover, captions, belowTabs }: CoverGalleryProps) {
  // The tab follows the selected cover unless the user picked a tab since
  // the selection last changed (derived state, no effect needed).
  const [picked, setPicked] = useState<{ key: string; forSelectedId: string | null } | null>(null);
  // Whether a phone shows every language tab. Once opened it stays open.
  const [expanded, setExpanded] = useState(false);
  const selectedId = selectedCover?.id ?? null;
  const owner = selectedCover ? groups.find(g => g.covers.some(c => c.id === selectedCover.id)) : undefined;
  const hasAll = groups.length > 1;
  const activeKey =
    picked && picked.forSelectedId === selectedId && (picked.key !== ALL || hasAll)
      ? picked.key
      : owner ? tabKey(owner) : groups[0] ? tabKey(groups[0]) : 'unknown';

  const showingAll = activeKey === ALL;
  const shown = showingAll ? allCovers : (groups.find(g => tabKey(g) === activeKey) ?? groups[0])?.covers ?? [];
  const total = groups.reduce((n, g) => n + g.covers.length, 0);
  // Tabs a phone keeps behind "+n": past the first six, never the active one.
  const tucked = expanded ? [] : groups.slice(PHONE_TABS).filter(g => tabKey(g) !== activeKey);
  const isTucked = (g: CoverTab) => tucked.includes(g);

  return (
    <section aria-label="Covers">
      {/*
        The pills **wrap on every screen** (ROADMAP 6.8, Julian 2026-09-11,
        "Weg 1"). Until then they scrolled sideways on a phone, and a pill at
        the end of that row — "All languages" — stood out of sight there while
        a desktop showed it (SPEC N14). What the sideways row protected against
        is kept another way: past six languages a phone tucks the rest behind
        "+n more", so seventeen translations are two rows, not six.
      */}
      <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Language">
        <span className="kicker mr-2 w-full sm:w-auto">{total} cover{total !== 1 ? 's' : ''}</span>
        {groups.map(g => (
          <button
            key={tabKey(g)}
            role="tab"
            aria-selected={tabKey(g) === activeKey}
            onClick={() => setPicked({ key: tabKey(g), forSelectedId: selectedId })}
            className={`chip shrink-0 ${isTucked(g) ? 'max-sm:hidden' : ''}`}
          >
            {languageName(g.language)}
            <span className="text-xs opacity-70">{g.covers.length}</span>
          </button>
        ))}
        {tucked.length > 0 && (
          <button type="button" onClick={() => setExpanded(true)} className="chip shrink-0 sm:hidden" aria-label={`Show ${tucked.length} more languages`}>
            +{tucked.length} more
          </button>
        )}
        {/*
          At the end, behind "Unknown": in front it would read as the default
          and undo the language order of F2.4, which exists so that the
          searched language comes first (Julian, 2026-09-07).
        */}
        {hasAll && (
          <button
            role="tab"
            aria-selected={showingAll}
            onClick={() => setPicked({ key: ALL, forSelectedId: selectedId })}
            className="chip shrink-0"
          >
            All languages
            <span className="text-xs opacity-70">{total}</span>
          </button>
        )}
      </div>
      {/* 5 px, one more than the 4 the link had above the pills. */}
      {belowTabs && <div className="mt-[5px]">{belowTabs}</div>}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-5" role="tabpanel">
        {shown.map((cover, index) => {
          const selected = selectedCover?.id === cover.id;
          const caption = captions.get(cover.id) ?? '';
          return (
            <button
              key={cover.id}
              data-cover-id={cover.id}
              style={{ animationDelay: `${Math.min(index, 24) * 35}ms` }}
              onClick={() => {
                // Picking a cover in the whole wall keeps the whole wall; it
                // must not jump to that cover's language tab.
                if (showingAll) setPicked({ key: ALL, forSelectedId: cover.id });
                onSelectCover(cover);
              }}
              aria-pressed={selected}
              aria-label={caption ? `Cover, ${caption}` : 'Cover'}
              className={`tile-in group relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 text-left transition-transform duration-300 ease-out focus-visible:outline-none ${
                selected
                  ? 'cover-shadow ring-2 ring-accent ring-offset-2 ring-offset-bg'
                  : 'cover-shadow hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
              }`}
            >
              <CoverImage
                src={cover.urlSmall ?? cover.url}
                alt={caption ? `Cover, ${caption}` : 'Cover'}
                sizes="(max-width: 640px) 33vw, (max-width: 1280px) 20vw, 12vw"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-left text-[11px] font-medium leading-tight text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                {caption}
              </div>
              {cover.similarIds && cover.similarIds.length > 0 && (
                <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white" title={`${cover.similarIds.length} more scan${cover.similarIds.length > 1 ? 's' : ''} of this cover`}>
                  +{cover.similarIds.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

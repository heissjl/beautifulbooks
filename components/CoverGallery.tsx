'use client';

import { useState } from 'react';
import CoverImage from './CoverImage';
import type { Cover } from '@/lib/model';
import { languageName } from '@/lib/normalize';

export interface CoverTab {
  /** ISO 639-1, undefined for "Unknown", or `ALL_LANGUAGES` for the whole wall. */
  language?: string;
  covers: Cover[];
}

/**
 * The tab that shows every cover at once (ROADMAP 6.8). Not a language code,
 * so it can never collide with one, and never written to the address: `?lang=`
 * there is the search filter, where `all` already means "no filter".
 */
export const ALL_LANGUAGES = '*';

const tabLabel = (g: CoverTab) => (g.language === ALL_LANGUAGES ? 'All languages' : languageName(g.language));

interface CoverGalleryProps {
  /** Already ordered by the server (SPEC §3 F2.3). */
  groups: CoverTab[];
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

/**
 * Keeps the active tab in view in the scrolling row. A ref callback rather
 * than an effect: it runs when the active tab changes, which is exactly when
 * the row may need to move, and it never reads a ref during render (that rule
 * is an error in this repo).
 */
function scrollIntoView(node: HTMLButtonElement | null): void {
  node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export default function CoverGallery({ groups, selectedCover, onSelectCover, captions, belowTabs }: CoverGalleryProps) {
  // The tab follows the selected cover unless the user picked a tab since
  // the selection last changed (derived state, no effect needed).
  const [picked, setPicked] = useState<{ key: string; forSelectedId: string | null } | null>(null);
  const selectedId = selectedCover?.id ?? null;
  const owner = selectedCover ? groups.find(g => g.covers.some(c => c.id === selectedCover.id)) : undefined;
  const activeKey =
    picked && picked.forSelectedId === selectedId
      ? picked.key
      : owner ? tabKey(owner) : groups[0] ? tabKey(groups[0]) : 'unknown';

  const active = groups.find(g => tabKey(g) === activeKey) ?? groups[0];
  const total = groups.reduce((n, g) => n + g.covers.length, 0);

  return (
    <section aria-label="Covers">
      {/*
        A book with many translations has seventeen tabs, which wrap into six
        rows on a phone and push the first cover off the screen (measured
        375 px, 2026-09-07). Below `sm` the row scrolls sideways instead;
        `sm:contents` dissolves the scroller again so the wide layout is
        exactly what it was.
      */}
      <div className="mb-4">
      <div className="sm:flex sm:flex-wrap sm:items-center sm:gap-2" role="tablist" aria-label="Language">
        <span className="kicker mb-2 block sm:mb-0 sm:mr-2 sm:inline">{total} cover{total !== 1 ? 's' : ''}</span>
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:contents">
          {groups.map(g => (
            <button
              key={tabKey(g)}
              role="tab"
              aria-selected={tabKey(g) === activeKey}
              onClick={() => setPicked({ key: tabKey(g), forSelectedId: selectedId })}
              className="chip shrink-0"
              ref={tabKey(g) === activeKey ? scrollIntoView : undefined}
            >
              {tabLabel(g)}
              <span className="text-xs opacity-70">{g.covers.length}</span>
            </button>
          ))}
        </div>
      </div>
      {/* 5 px, one more than the 4 the link had above the pills. */}
      {belowTabs && <div className="mt-[5px]">{belowTabs}</div>}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-5" role="tabpanel">
        {active?.covers.map((cover, index) => {
          const selected = selectedCover?.id === cover.id;
          const caption = captions.get(cover.id) ?? '';
          return (
            <button
              key={cover.id}
              data-cover-id={cover.id}
              style={{ animationDelay: `${Math.min(index, 24) * 35}ms` }}
              onClick={() => onSelectCover(cover)}
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

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
  selectedCover: Cover | null;
  onSelectCover: (cover: Cover) => void;
  /** Caption per cover id, e.g. "Scribner 1996". */
  captions: ReadonlyMap<string, string>;
}

const tabKey = (g: CoverTab) => g.language ?? 'unknown';

export default function CoverGallery({ groups, selectedCover, onSelectCover, captions }: CoverGalleryProps) {
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
    <section aria-label="All covers">
      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Language">
        <span className="kicker mr-2">{total} cover{total !== 1 ? 's' : ''}</span>
        {groups.map(g => (
          <button
            key={tabKey(g)}
            role="tab"
            aria-selected={tabKey(g) === activeKey}
            onClick={() => setPicked({ key: tabKey(g), forSelectedId: selectedId })}
            className="chip"
          >
            {languageName(g.language)}
            <span className="text-xs opacity-70">{g.covers.length}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-5" role="tabpanel">
        {active?.covers.map(cover => {
          const selected = selectedCover?.id === cover.id;
          const caption = captions.get(cover.id) ?? '';
          return (
            <button
              key={cover.id}
              onClick={() => onSelectCover(cover)}
              aria-pressed={selected}
              aria-label={caption ? `Cover, ${caption}` : 'Cover'}
              className={`group relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 text-left transition-transform duration-300 ease-out focus-visible:outline-none ${
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
            </button>
          );
        })}
      </div>
    </section>
  );
}

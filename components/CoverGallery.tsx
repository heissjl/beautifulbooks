'use client';

import { useState } from 'react';
import Image from 'next/image';
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
    <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">All Covers</h2>
        <p className="text-gray-600 text-sm">
          {total} cover{total !== 1 ? 's' : ''} across {groups.length} language{groups.length !== 1 ? 's' : ''}
        </p>
      </div>

      {groups.length > 1 && (
        <div className="mb-6 border-b border-gray-200">
          <div className="flex flex-wrap gap-2 -mb-px" role="tablist">
            {groups.map(g => (
              <button
                key={tabKey(g)}
                role="tab"
                aria-selected={tabKey(g) === activeKey}
                onClick={() => setPicked({ key: tabKey(g), forSelectedId: selectedId })}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  tabKey(g) === activeKey
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {languageName(g.language)}
                <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{g.covers.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
        {active?.covers.map(cover => {
          const selected = selectedCover?.id === cover.id;
          const caption = captions.get(cover.id) ?? '';
          return (
            <button
              key={cover.id}
              onClick={() => onSelectCover(cover)}
              aria-pressed={selected}
              className={`group relative aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 ${
                selected ? 'ring-4 ring-amber-500 scale-105' : ''
              }`}
            >
              <Image
                src={cover.urlSmall ?? cover.url}
                alt={caption ? `Cover, ${caption}` : 'Cover'}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 12.5vw"
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
                <p className="text-white text-xs text-left line-clamp-2">{caption}</p>
              </div>
              {selected && (
                <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full p-1 shadow-lg">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

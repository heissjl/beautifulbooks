'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import type { BookEdition } from '@/types/book';

interface EditionsByLanguageProps {
  editions: BookEdition[];
  selectedEdition: BookEdition | null;
  onSelectEdition: (edition: BookEdition) => void;
}

export default function EditionsByLanguage({
  editions,
  selectedEdition,
  onSelectEdition,
}: EditionsByLanguageProps) {
  // Group editions by language
  const editionsByLanguage = useMemo(() => {
    const groups = new Map<string, BookEdition[]>();

    editions.forEach((edition) => {
      const lang = edition.language || 'unknown';
      const langName = getLanguageName(lang);

      if (!groups.has(langName)) {
        groups.set(langName, []);
      }
      groups.get(langName)!.push(edition);
    });

    // Sort languages: English first, then alphabetically
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'English') return -1;
      if (b === 'English') return 1;
      return a.localeCompare(b);
    });

    return sorted;
  }, [editions]);

  const [activeLanguage, setActiveLanguage] = useState<string>(
    editionsByLanguage[0]?.[0] || 'English'
  );

  const activeEditions = useMemo(() => {
    return editionsByLanguage.find(([lang]) => lang === activeLanguage)?.[1] || [];
  }, [editionsByLanguage, activeLanguage]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          All Editions & Covers
        </h2>
        <p className="text-gray-600 text-sm">
          {editions.length} edition{editions.length > 1 ? 's' : ''} across {editionsByLanguage.length} language{editionsByLanguage.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Language Tabs */}
      {editionsByLanguage.length > 1 && (
        <div className="mb-6 border-b border-gray-200">
          <div className="flex flex-wrap gap-2 -mb-px">
            {editionsByLanguage.map(([langName, langEditions]) => (
              <button
                key={langName}
                onClick={() => setActiveLanguage(langName)}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeLanguage === langName
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {langName}
                <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                  {langEditions.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editions Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
        {activeEditions.map((edition) => (
          <button
            key={edition.id}
            onClick={() => onSelectEdition(edition)}
            className={`group relative aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 ${
              selectedEdition?.id === edition.id
                ? 'ring-4 ring-amber-500 scale-105'
                : ''
            }`}
          >
            {edition.coverImage ? (
              <Image
                src={edition.coverImage}
                alt={`${edition.title} edition`}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 12.5vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
              <div className="text-white text-xs">
                {edition.publishedDate && (
                  <p className="font-semibold">{edition.publishedDate}</p>
                )}
                {edition.publisher && (
                  <p className="line-clamp-1">{edition.publisher}</p>
                )}
              </div>
            </div>

            {/* Selected indicator */}
            {selectedEdition?.id === edition.id && (
              <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full p-1 shadow-lg">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    eng: 'English',
    es: 'Spanish',
    spa: 'Spanish',
    fr: 'French',
    fra: 'French',
    fre: 'French',
    de: 'German',
    ger: 'German',
    deu: 'German',
    it: 'Italian',
    ita: 'Italian',
    pt: 'Portuguese',
    por: 'Portuguese',
    ru: 'Russian',
    rus: 'Russian',
    ja: 'Japanese',
    jpn: 'Japanese',
    zh: 'Chinese',
    chi: 'Chinese',
    zho: 'Chinese',
    ar: 'Arabic',
    ara: 'Arabic',
    hi: 'Hindi',
    hin: 'Hindi',
    unknown: 'Unknown',
  };

  return languages[code.toLowerCase()] || code.toUpperCase();
}

'use client';

import Link from 'next/link';
import CoverMosaic from './CoverMosaic';
import type { WorkSummary } from '@/lib/model';

interface BookWorkCardProps {
  work: WorkSummary;
  /** Current search state, carried to the detail page for the back link. */
  searchHref?: string;
  language?: string;
}

export default function BookWorkCard({ work, language }: BookWorkCardProps) {
  const editionCount = work.editionCount ?? work.coverUrls.length;
  const href = language && language !== 'all' ? `/book/${work.id}?lang=${language}` : `/book/${work.id}`;

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]">
        <CoverMosaic coverUrls={work.coverUrls} title={work.title} />

        {editionCount > 1 && (
          <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
            {editionCount} editions
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-xs font-medium">
              {work.languages.length > 1 ? `${work.languages.length} languages` : 'Explore editions'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-amber-600 transition-colors">
          {work.title}
        </h3>
        <p className="text-xs text-gray-600 line-clamp-1">{work.authors.join(', ')}</p>
        {work.firstPublishYear && (
          <p className="text-xs text-gray-500">First published {work.firstPublishYear}</p>
        )}
      </div>
    </Link>
  );
}

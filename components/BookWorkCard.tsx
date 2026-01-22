'use client';

import Link from 'next/link';
import CoverMosaic from './CoverMosaic';
import type { NormalizedBook } from '@/lib/sources/base';

interface BookWorkCardProps {
  work: NormalizedBook;
}

export default function BookWorkCard({ work }: BookWorkCardProps) {
  // Safety check: ensure work has editions
  if (!work.editions || work.editions.length === 0) {
    return null;
  }

  // Use primaryEdition for linking (the edition that defined this work)
  // Fall back to first edition if primaryEdition is not set
  const linkEdition = work.primaryEdition || work.editions[0];
  const firstEdition = work.editions[0];

  return (
    <Link
      href={`/book/${linkEdition.id}`}
      className="group block"
    >
      <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]">
        <CoverMosaic editions={work.editions} title={work.title} />

        {/* Edition count badge */}
        {work.editions.length > 1 && (
          <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
            {work.editions.length} editions
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-xs font-medium">
              Click to explore {work.editions.length} edition{work.editions.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Book Info */}
      <div className="mt-3 space-y-1">
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-amber-600 transition-colors">
          {work.title}
        </h3>
        {work.authors && work.authors.length > 0 && (
          <p className="text-xs text-gray-600 line-clamp-1">
            {work.authors.join(', ')}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {firstEdition.publishedDate && (
            <span>{firstEdition.publishedDate.split('-')[0]}</span>
          )}
          {firstEdition.publisher && firstEdition.publishedDate && (
            <span>•</span>
          )}
          {firstEdition.publisher && (
            <span className="line-clamp-1">{firstEdition.publisher}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

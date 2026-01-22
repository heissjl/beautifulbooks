'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { BookEdition } from '@/types/book';

interface BookCardProps {
  book: BookEdition;
}

export default function BookCard({ book }: BookCardProps) {
  return (
    <Link
      href={`/book/${book.id}`}
      className="group block"
    >
      <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]">
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={`${book.title} cover`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-2 text-gray-400"
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
              <p className="text-xs text-gray-500 font-medium">No Cover</p>
            </div>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-xs font-medium">Click to view details</p>
          </div>
        </div>
      </div>

      {/* Book Info */}
      <div className="mt-3 space-y-1">
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-amber-600 transition-colors">
          {book.title}
        </h3>
        {book.authors && book.authors.length > 0 && (
          <p className="text-xs text-gray-600 line-clamp-1">
            {book.authors.join(', ')}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {book.publishedDate && (
            <span>{book.publishedDate}</span>
          )}
          {book.publisher && book.publishedDate && (
            <span>•</span>
          )}
          {book.publisher && (
            <span className="line-clamp-1">{book.publisher}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

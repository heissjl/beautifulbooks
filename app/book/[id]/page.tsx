'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { bookAggregator } from '@/lib/aggregator';
import type { BookEdition } from '@/types/book';

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [mainBook, setMainBook] = useState<BookEdition | null>(null);
  const [editions, setEditions] = useState<BookEdition[]>([]);
  const [selectedEdition, setSelectedEdition] = useState<BookEdition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBook = async () => {
      if (!params.id || typeof params.id !== 'string') {
        return;
      }

      setLoading(true);
      try {
        const [bookData, allEditions] = await Promise.all([
          bookAggregator.getBookDetails(params.id),
          bookAggregator.getAllEditions(params.id),
        ]);

        setMainBook(bookData);
        setEditions(allEditions);
        setSelectedEdition(bookData);
      } catch (error) {
        console.error('Error fetching book details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBook();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-24 mb-8"></div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="bg-gray-200 rounded-2xl h-96"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!mainBook) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <p className="text-gray-600">Book not found</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 text-amber-600 hover:text-amber-700"
            >
              Return home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayBook = selectedEdition || mainBook;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <header className="border-b border-amber-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-amber-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to search
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {mainBook.title}
          </h1>
          {mainBook.authors && mainBook.authors.length > 0 && (
            <p className="text-xl text-gray-600">
              by {mainBook.authors.join(', ')}
            </p>
          )}
        </div>

        {/* All Editions Gallery - COVERS FIRST */}
        {editions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden p-6 sm:p-8 mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                All Editions & Covers
              </h2>
              <p className="text-gray-600 text-sm">
                {editions.length} different edition{editions.length > 1 ? 's' : ''} found. Click any cover to view its details below.
              </p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
              {editions.map((edition) => (
                <button
                  key={edition.id}
                  onClick={() => setSelectedEdition(edition)}
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
        )}

        {/* Selected Edition Details */}
        <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden">
          <div className="p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Edition Details
            </h2>

            <div className="grid md:grid-cols-5 gap-8">
              {/* Large Cover */}
              <div className="md:col-span-2">
                <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-xl sticky top-24">
                  {displayBook.coverImage ? (
                    <Image
                      src={displayBook.coverImage}
                      alt={`${displayBook.title} cover`}
                      fill
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover"
                      unoptimized
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-20 h-20 text-gray-400"
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
                </div>
              </div>

              {/* Edition Info */}
              <div className="md:col-span-3 space-y-6">
                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-4 p-6 bg-amber-50 rounded-xl">
                  {displayBook.publishedDate && (
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Published</p>
                      <p className="text-gray-900 font-semibold">{displayBook.publishedDate}</p>
                    </div>
                  )}
                  {displayBook.publisher && (
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Publisher</p>
                      <p className="text-gray-900 font-semibold">{displayBook.publisher}</p>
                    </div>
                  )}
                  {displayBook.pageCount && (
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Pages</p>
                      <p className="text-gray-900 font-semibold">{displayBook.pageCount}</p>
                    </div>
                  )}
                  {displayBook.isbn && (
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">ISBN</p>
                      <p className="text-gray-900 font-mono text-sm font-semibold">{displayBook.isbn}</p>
                    </div>
                  )}
                  {displayBook.language && (
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Language</p>
                      <p className="text-gray-900 font-semibold uppercase">{displayBook.language}</p>
                    </div>
                  )}
                </div>

                {/* Description */}
                {displayBook.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Description
                    </h3>
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                      {displayBook.description.replace(/<[^>]*>/g, '')}
                    </div>
                  </div>
                )}

                {/* Buy Links */}
                {displayBook.buyLinks && displayBook.buyLinks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Find this edition
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {displayBook.buyLinks.map((link, index) => (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md hover:shadow-lg font-medium"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                            />
                          </svg>
                          {link.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview Link */}
                {displayBook.previewLink && (
                  <div className="pt-4 border-t border-gray-200">
                    <a
                      href={displayBook.previewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      Preview on Google Books
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import BookWorkCard from './BookWorkCard';
import { bookAggregator } from '@/lib/aggregator';
import type { NormalizedBook } from '@/lib/sources/base';

interface BookGridProps {
  searchQuery: string;
  language: string;
}

export default function BookGrid({ searchQuery, language }: BookGridProps) {
  const [works, setWorks] = useState<NormalizedBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchQuery) {
      setWorks([]);
      return;
    }

    const fetchBooks = async () => {
      setLoading(true);
      setError(null);

      try {
        const results = await bookAggregator.search(searchQuery, {
          language: language || undefined,
          includeAudiobooks: false,
        });
        setWorks(results);
      } catch (err) {
        setError('Failed to fetch books. Please try again.');
        console.error('Error fetching books:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [searchQuery, language]);

  if (!searchQuery) {
    return (
      <div className="text-center py-20">
        <div className="inline-block p-8 bg-white rounded-2xl shadow-sm border border-amber-100">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-amber-400"
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
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Start Your Search
          </h2>
          <p className="text-gray-600 text-sm">
            Enter a book title or author to discover different editions and covers
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
          >
            <div className="aspect-[2/3] bg-gray-200 rounded-lg mb-3"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="inline-block p-8 bg-red-50 rounded-2xl border border-red-200">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (works.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-block p-8 bg-white rounded-2xl shadow-sm border border-amber-100">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            No books found
          </h2>
          <p className="text-gray-600 text-sm">
            Try searching for a different title or author
          </p>
        </div>
      </div>
    );
  }

  const totalEditions = works.reduce((sum, work) => sum + work.editions.length, 0);

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-gray-600">
          Found <span className="font-semibold text-gray-900">{works.length}</span> {works.length === 1 ? 'book' : 'books'} with{' '}
          <span className="font-semibold text-gray-900">{totalEditions}</span> total editions
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {works.map((work) => (
          <BookWorkCard key={work.workId} work={work} />
        ))}
      </div>
    </div>
  );
}

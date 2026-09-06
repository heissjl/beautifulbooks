'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import BookGrid from '@/components/BookGrid';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [language, setLanguage] = useState('en');

  // Initialize from URL on mount
  useEffect(() => {
    const query = searchParams.get('q') || '';
    const lang = searchParams.get('lang') || 'en';
    setSearchQuery(query);
    setLanguage(lang);
  }, [searchParams]);

  // Update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) {
      params.set('q', searchQuery);
    }
    if (language && language !== 'en') {
      params.set('lang', language);
    }

    const newUrl = params.toString() ? `/?${params.toString()}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [searchQuery, language, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <header className="border-b border-amber-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Beautiful Books
              </h1>
              <p className="text-sm text-gray-600 hidden sm:block">
                Discover every edition
              </p>
            </div>
            <p className="text-gray-600 text-sm max-w-2xl">
              Explore different covers and editions of your favorite books, beautifully displayed with links to find and purchase them.
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Section */}
        <div className="mb-8">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            language={language}
            setLanguage={setLanguage}
          />
        </div>

        {/* Results Section */}
        <BookGrid searchQuery={searchQuery} language={language} />
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-amber-200 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-sm text-gray-500">
            Built with Next.js • Data from Google Books & Open Library
          </p>
        </div>
      </footer>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary for static prerendering.
export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import BookGrid from '@/components/BookGrid';

/**
 * The URL is the single source of truth for search state (SPEC §3 F1.5):
 * /?q=<query>&lang=<iso>. Back button and sharing work by construction.
 */
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const language = searchParams.get('lang') ?? '';

  const navigate = useCallback((q: string, lang: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (lang && lang !== 'all') params.set('lang', lang);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/', { scroll: false });
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <header className="border-b border-amber-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Beautiful Books
              </h1>
              <p className="text-sm text-gray-600 hidden sm:block">Discover every edition</p>
            </div>
            <p className="text-gray-600 text-sm max-w-2xl">
              Explore different covers and editions of your favorite books, beautifully displayed with links to find and purchase them.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={q => navigate(q, language)}
            language={language}
            setLanguage={lang => navigate(searchQuery, lang)}
          />
        </div>
        <BookGrid searchQuery={searchQuery} language={language} />
      </main>

      <footer className="mt-20 border-t border-amber-200 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-sm text-gray-500">
            Built with Next.js • Data from Open Library &amp; Google Books
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

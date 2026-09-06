'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import BookGrid from '@/components/BookGrid';
import SiteHeader from '@/components/SiteHeader';

/**
 * The URL is the single source of truth for search state (SPEC §3 F1.5):
 * /?q=<query>&lang=<iso>. Back button and sharing work by construction.
 */
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const language = searchParams.get('lang') ?? '';
  const isHero = !searchQuery;

  const navigate = useCallback((q: string, lang: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (lang && lang !== 'all') params.set('lang', lang);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/', { scroll: false });
  }, [router]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className={`${isHero ? 'pb-12 pt-16 sm:pt-24' : 'pb-8 pt-8'} transition-[padding]`}>
          {isHero && (
            <div className="mb-8 max-w-2xl">
              <h1 className="text-4xl leading-[1.1] text-ink sm:text-5xl">
                Every cover of every edition, <em className="text-accent">in one place.</em>
              </h1>
              <p className="mt-4 max-w-xl text-base text-ink-2 sm:text-lg">
                Search a book, compare all the covers it has ever had, and find the edition you actually want to own.
              </p>
            </div>
          )}
          <div className={isHero ? 'max-w-3xl' : 'max-w-3xl'}>
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={q => navigate(q, language)}
              language={language}
              setLanguage={lang => navigate(searchQuery, lang)}
              hero={isHero}
            />
          </div>
        </section>

        <section className="pb-24">
          <BookGrid searchQuery={searchQuery} language={language} />
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-ink-3 sm:px-6 lg:px-8">
          <p>Data from Open Library and Google Books. Cover images belong to their publishers.</p>
          <p>Purchase links may earn us a commission.</p>
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

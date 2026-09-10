'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import BookGrid from '@/components/BookGrid';
import HeroFan from '@/components/HeroFan';
import SiteFooter from '@/components/SiteFooter';
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
            /*
              The headline on the left, and from `lg` up the promise as a
              picture on the right (ROADMAP 1.9): four covers of one book,
              fanned out where the first screen used to be empty. Below `lg`
              the fan is not rendered at all, so the search field stays where
              it was on a phone.
            */
            <div className="mb-8 flex items-start justify-between gap-8">
              <div className="min-w-0 max-w-2xl">
                <h1 className="text-4xl leading-[1.1] text-ink sm:text-5xl">
                  Judge a book <em className="text-accent">by its covers.</em>
                </h1>
                <p className="mt-4 max-w-xl text-base text-ink-2 sm:text-lg">
                  Type a title and see the covers it has been printed with, by language and year.
                  Then find the edition you&rsquo;d actually want on your shelf.
                </p>
              </div>
              <HeroFan className="hidden lg:block lg:-mt-2 lg:mr-6 xl:mr-16" />
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

      <SiteFooter />
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

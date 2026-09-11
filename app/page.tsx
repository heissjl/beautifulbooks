'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import BookGrid from '@/components/BookGrid';
import HeroFan from '@/components/HeroFan';
import { useIsDesktop } from '@/components/useIsDesktop';
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
  const isDesktop = useIsDesktop(false);

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
          {/*
            The headline and the search field on the left, and from `lg` up
            the promise as a picture beside both (ROADMAP 1.9): seven covers
            of one book on a ring, centred on the column rather than sitting
            in the headline's row, whose height pushed the search field down.
            Below `lg` the ring is not rendered at all — not hidden with CSS,
            which still fetched its seven covers on a phone — so the search
            field stays where it was there. From `lg` an empty place of the
            ring's size is there from the first paint, so nothing moves when
            the ring arrives. The column is there in both states so that the
            search field keeps its place in the tree and is not remounted when
            a search starts.
          */}
          <div className="flex items-center justify-between gap-8">
            <div className="min-w-0 flex-1">
              {isHero && (
                <div className="mb-8 max-w-2xl">
                  <h1 className="text-4xl leading-[1.1] text-ink sm:text-5xl">
                    Judge a book <em className="text-accent">by its covers.</em>
                  </h1>
                  <p className="mt-4 max-w-xl text-base text-ink-2 sm:text-lg">
                    Type a title and see the covers it has been printed with, by language and year.
                    Then find the edition you&rsquo;d actually want on your shelf.
                  </p>
                </div>
              )}
              <div className="max-w-3xl">
                <SearchBar
                  searchQuery={searchQuery}
                  setSearchQuery={q => navigate(q, language)}
                  language={language}
                  setLanguage={lang => navigate(searchQuery, lang)}
                  hero={isHero}
                />
              </div>
            </div>
            {isHero && (
              <div className="hidden min-h-[14.25rem] w-[19rem] shrink-0 lg:mr-6 lg:block xl:mr-16">
                {isDesktop && <HeroFan />}
              </div>
            )}
          </div>
        </section>

        {/* Air before the footer on a desktop; on a phone 96 px was an eighth of the screen, empty (6.30). */}
        <section className="pb-10 sm:pb-24">
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

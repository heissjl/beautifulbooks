import Link from 'next/link';
import BookGrid from '@/components/BookGrid';
import HeroSlot from '@/components/HeroSlot';
import HomeSearchBar from '@/components/HomeSearchBar';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';

/**
 * The URL is the single source of truth for search state (SPEC §3 F1.5):
 * /?q=<query>&lang=<iso>. Back button and sharing work by construction.
 *
 * **The page reads that URL on the server** (ROADMAP 6.49). It used to be a
 * client component calling `useSearchParams` inside a `<Suspense>` without a
 * fallback, and Next then skips the whole subtree while prerendering: measured
 * on 2026-09-23, the built page was 9,838 bytes with no headline and not one
 * link to a book, while the same page with that single call removed was 29,774
 * bytes with eighteen. Everything a reader or a crawler reads — headline,
 * promise, the way into the cover game, the curated wall — is rendered here,
 * and only what needs the browser is a client component: `HomeSearchBar` (it
 * changes the address while someone types) and `HeroSlot` (the ring belongs to
 * wide screens only). Reading `searchParams` makes this route dynamic; it
 * costs one render per visit and no external request, because the tiles fetch
 * their covers from the browser as before.
 */
interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const searchQuery = first(params.q);
  const language = first(params.lang);
  const isHero = !searchQuery;

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
                  {/*
                    The way into the cover game (ROADMAP 5.8a, SPEC F7): under the promise,
                    not in the header — it is an invitation, not a part of the search. One
                    line, so the search field keeps the page.
                  */}
                  <p className="mt-5 text-sm">
                    <Link
                      href="/versus"
                      className="inline-flex items-center gap-1.5 text-accent underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
                    >
                      Or help us find the prettiest cover of all time!
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </p>
                </div>
              )}
              <div className="max-w-3xl">
                <HomeSearchBar searchQuery={searchQuery} language={language} hero={isHero} />
              </div>
            </div>
            {isHero && (
              <div className="hidden min-h-[14.25rem] w-[19rem] shrink-0 lg:mr-6 lg:block xl:mr-16">
                <HeroSlot />
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

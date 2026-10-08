import type { Metadata } from 'next';
import Link from '@/components/Link';
import { notFound } from 'next/navigation';
import CollectionGrid from '@/components/CollectionGrid';
import WallsInvite from '@/components/WallsInvite';
import ReaderWallCard from '@/components/ReaderWallCard';
import { POPULAR_VIEWS, toPublic } from '@/lib/walls/model';
import { shownWalls, wallStoreFromEnv } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { liveCollections } from '@/lib/collections-live';
import { SITE_URL } from '@/lib/seo';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/translate';
import { introText } from '@/lib/introlinks';
import { measure } from '@/app/api/measure';

/**
 * Every collection the file holds (ROADMAP 5.10, SPEC F8), each with its title
 * link and two rows of its covers with a mosaic of the next ones (`CollectionGrid`); two cards side by side from `lg` (5.10l). With none published this is a 404 on a production build,
 * so the footer never points at an empty shelf.
 */
export const metadata: Metadata = {
  title: 'Collections',
  description: 'Books gathered around a theme or a series, one cover each.',
  alternates: { canonical: `${SITE_URL}/collections` },
};

// Per request: a collection can be published from /curate without a deploy (5.10g).
export const dynamic = 'force-dynamic';

export default async function CollectionsPage({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  measure('page-collections');
  const t = translator(locale);
  const collections = await liveCollections();
  if (collections.length === 0) notFound();
  // Popular walls by readers stand among the collections (5.13d); a silent store just leaves them out.
  const store = wallsEnabled() ? wallStoreFromEnv() : null;
  const popular = store
    ? (await shownWalls(store).catch(() => []))
        .filter((s) => s.views >= POPULAR_VIEWS)
        .sort((a, b) => b.views - a.views)
        .slice(0, 3)
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">{t('Collections')}</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          {t('Books gathered around a theme or a series, one cover each. Every cover leads to the wall of the others we found.')}
        </p>
        {wallsEnabled() && <WallsInvite className="mt-3">{t('Create your own collection')}</WallsInvite>}
        <ul className="mt-10 grid grid-cols-1 gap-x-12 gap-y-14 lg:grid-cols-2">
          {collections.map(c => (
            <li key={c.slug} id={c.slug} className="min-w-0 scroll-mt-24">
              <Link href={`/collections/${c.slug}`} className="group block">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line pb-2">
                  <h2 className="font-display text-2xl text-ink transition-colors group-hover:text-accent">
                    {c.title}
                    {!c.published && <span className="ml-3 align-middle text-xs text-accent">{t('draft')}</span>}
                  </h2>
                  <p className="text-sm text-ink-3">
                    {c.works.length === 1 ? t('{n} book', { n: 1 }) : t('{n} books', { n: c.works.length })}
                  </p>
                </div>
                <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-ink-2">{introText(c.intro)}</p>
              </Link>
              <CollectionGrid slug={c.slug} title={c.title} works={c.works} total={c.works.length} />
            </li>
          ))}
        </ul>
        {popular.length > 0 && (
          <section className="mt-16" aria-labelledby="by-readers">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line pb-2">
              <h2 id="by-readers" className="font-display text-2xl text-ink">{t('Collections by readers')}</h2>
              <Link href="/collections/readers" className="text-sm text-ink-2 underline decoration-line underline-offset-4 hover:text-accent hover:decoration-accent">{t('All collections by readers')}</Link>
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2">
              {popular.slice(0, 2).map(({ wall }) => (
                <li key={wall.id}>
                  <ReaderWallCard wall={toPublic(wall)} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

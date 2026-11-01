import type { Metadata } from 'next';
import Link from '@/components/Link';
import { notFound } from 'next/navigation';
import CollectionGrid from '@/components/CollectionGrid';
import WallsInvite from '@/components/WallsInvite';
import ReaderWallCard from '@/components/ReaderWallCard';
import { POPULAR_VIEWS, toPublic } from '@/lib/walls/model';
import { shownWallsCached, wallStoreFromEnv } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { liveCollections } from '@/lib/collections-live';
import { groupCollections, type Collection } from '@/lib/collections';
import { groupHeading, groupText } from '@/lib/hubcopy';
import { SITE_URL } from '@/lib/seo';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';
import { introText } from '@/lib/introlinks';
import type { Translate } from '@/lib/i18n/translate';
import { measure } from '@/app/api/measure';

/**
 * The collections the site shows (ROADMAP 5.10, SPEC F8), each with its title
 * link and two rows of its covers with a mosaic of the next ones (`CollectionGrid`); two cards side by side from `lg` (5.10l). With none published this is a 404 on a production build,
 * so the footer never points at an empty shelf.
 *
 * A hub since 6.107 Teil A (PLAN-6.107 § 5 A 3): the cards stand under four
 * headings — series, designers, prizes and lists, publishers — each with
 * three sentences of the site's own text (`lib/hubcopy.ts`), the group taken
 * from the record's `group` field, never from a slug; and at the foot a plain
 * list of the published collections with name, size and link, the surest
 * path for a crawler that read 56 of 59 collections into "discovered" and
 * fetched none (plan § 0).
 */
export const metadata: Metadata = {
  title: 'Collections',
  description: 'Books gathered around a theme or a series, one cover each.',
  alternates: { canonical: `${SITE_URL}/collections` },
};

// Per request: a collection can be published from /curate without a deploy (5.10g) — read from the
// instance's memory, a minute at most behind the store (2.18c).
export const dynamic = 'force-dynamic';

export default async function CollectionsPage({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  measure('page-collections');
  const t = translator(locale);
  const collections = await liveCollections();
  if (collections.length === 0) notFound();
  // Popular walls by readers stand among the collections (5.13d), from the instance's memory (2.18c);
  // a silent store just leaves them out.
  const store = wallsEnabled() ? wallStoreFromEnv() : null;
  const popular = store
    ? (await shownWallsCached(store).catch(() => []))
        .filter((s) => s.views >= POPULAR_VIEWS)
        .sort((a, b) => b.views - a.views)
        .slice(0, 3)
    : [];

  const groups = groupCollections(collections);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">{t('Collections')}</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          {t('Books gathered around a theme or a series, one cover each. Every cover leads to the wall of the others we found.')}
        </p>
        {wallsEnabled() && <WallsInvite className="mt-3">{t('Create your own collection')}</WallsInvite>}
        {/*
          Julian, 2026-11-01: „im hub sollte es oben aber links zu den
          kategorien geben". A line of words under the intro, like the
          language tabs of a book page (6.84: words, no pills, no arrows),
          each jumping to its section; the count small and grey after it.
        */}
        <nav aria-label={t('Groups of collections')} className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-base">
          {groups.map(({ group, collections: inGroup }) => (
            <a key={group} href={`#${group}`} className="text-ink underline decoration-line underline-offset-4 hover:text-accent hover:decoration-accent">
              {groupHeading(group, t)} <span className="text-sm text-ink-3">{inGroup.length}</span>
            </a>
          ))}
          <a href="#register-heading" className="text-ink underline decoration-line underline-offset-4 hover:text-accent hover:decoration-accent">{t('As a list')}</a>
        </nav>
        {groups.map(({ group, collections: inGroup }) => (
          <section key={group} id={group} className="mt-14 scroll-mt-24 sm:mt-16" aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`} className="text-2xl text-ink sm:text-3xl">{groupHeading(group, t)}</h2>
            <p className="mt-3 max-w-2xl text-base text-ink-2">{groupText(group, t).join(' ')}</p>
            <ul className="mt-8 grid grid-cols-1 gap-x-12 gap-y-14 lg:grid-cols-2">
              {inGroup.map(c => <CollectionCard key={c.slug} c={c} t={t} />)}
            </ul>
          </section>
        ))}
        <Register collections={collections.filter(c => c.published)} t={t} />
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

/** One collection on the hub: title link with the count, two lines of intro, the first rows of its wall. */
function CollectionCard({ c, t }: { c: Collection; t: Translate }) {
  return (
    <li id={c.slug} className="min-w-0 scroll-mt-24">
      <Link href={`/collections/${c.slug}`} className="group block">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line pb-2">
          <h3 className="font-display text-2xl text-ink transition-colors group-hover:text-accent">
            {c.title}
            {!c.published && <span className="ml-3 align-middle text-xs text-accent">{t('draft')}</span>}
          </h3>
          <p className="text-sm text-ink-3">
            {c.works.length === 1 ? t('{n} book', { n: 1 }) : t('{n} books', { n: c.works.length })}
          </p>
        </div>
        <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-ink-2">{introText(c.intro)}</p>
      </Link>
      <CollectionGrid slug={c.slug} title={c.title} works={c.works} total={c.works.length} />
    </li>
  );
}

/**
 * The published collections as a plain list (6.107 Teil A): name, size, link,
 * nothing lazy and nothing to scroll. Drafts are left out even under `next
 * dev`: the list is what a crawler should take home.
 */
function Register({ collections, t }: { collections: Collection[]; t: Translate }) {
  if (collections.length === 0) return null;
  return (
    <section className="mt-20 border-t border-line pt-8" aria-labelledby="register-heading">
      <h2 id="register-heading" className="text-xl text-ink sm:text-2xl">{t('The collections as a list')}</h2>
      <p className="mt-2 text-sm text-ink-3">{collections.length === 1 ? t('{n} collection', { n: 1 }) : t('{n} collections', { n: collections.length })}</p>
      <ul className="mt-5 grid grid-cols-1 gap-x-10 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3" data-register={collections.length}>
        {collections.map(c => (
          <li key={c.slug} className="flex items-baseline justify-between gap-3">
            <Link href={`/collections/${c.slug}`} className="min-w-0 text-ink-2 underline decoration-line underline-offset-4 hover:text-accent hover:decoration-accent">{c.title}</Link>
            <span className="shrink-0 text-ink-3">{c.works.length === 1 ? t('{n} book', { n: 1 }) : t('{n} books', { n: c.works.length })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

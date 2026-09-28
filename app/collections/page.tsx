import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CollectionRow from '@/components/CollectionRow';
import WallsInvite from '@/components/WallsInvite';
import WallCard from '@/components/WallCard';
import { POPULAR_VIEWS, toPublic } from '@/lib/walls/model';
import { showcased, wallStoreFromEnv } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { liveCollections } from '@/lib/collections-live';
import { SITE_URL } from '@/lib/seo';

/**
 * Every collection the file holds (ROADMAP 5.10, SPEC F8), each with its title
 * link and a row of its covers that scrolls sideways (`CollectionRow`). With none published this is a 404 on a production build,
 * so the footer never points at an empty shelf.
 */
export const metadata: Metadata = {
  title: 'Collections',
  description: 'Books gathered around a theme or a series, one cover each.',
  alternates: { canonical: `${SITE_URL}/collections` },
};

// Per request: a collection can be published from /curate without a deploy (5.10g).
export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const collections = await liveCollections();
  if (collections.length === 0) notFound();
  // Popular walls by readers stand among the collections (5.13d); a silent store just leaves them out.
  const store = wallsEnabled() ? wallStoreFromEnv() : null;
  const popular = store ? (await showcased(store).catch(() => [])).filter((s) => s.views >= POPULAR_VIEWS).slice(0, 3) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">Collections</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          Books gathered around a theme or a series, one cover each. Every cover leads to the wall of the others we found.
        </p>
        {wallsEnabled() && <WallsInvite className="mt-3">Make a wall of your own</WallsInvite>}
        <ul className="mt-10 space-y-12">
          {collections.map(c => (
            <li key={c.slug}>
              <Link href={`/collections/${c.slug}`} className="group block">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line pb-2">
                  <h2 className="font-display text-2xl text-ink transition-colors group-hover:text-accent">
                    {c.title}
                    {!c.published && <span className="ml-3 align-middle text-xs text-accent">draft</span>}
                  </h2>
                  <p className="text-sm text-ink-3">
                    {c.works.length} {c.works.length === 1 ? 'book' : 'books'} <span aria-hidden="true">&rarr;</span>
                  </p>
                </div>
                <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-ink-2">{c.intro}</p>
              </Link>
              <CollectionRow slug={c.slug} title={c.title} works={c.works} total={c.works.length} />
            </li>
          ))}
        </ul>
        {popular.length > 0 && (
          <section className="mt-16" aria-labelledby="by-readers">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line pb-2">
              <h2 id="by-readers" className="font-display text-2xl text-ink">Walls by readers</h2>
              <Link href="/walls/readers" className="text-sm text-ink-3 hover:text-accent">all of them &rarr;</Link>
            </div>
            <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {popular.map(({ wall }) => (
                <li key={wall.id}>
                  <WallCard wall={toPublic(wall)} />
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CoverImage from '@/components/CoverImage';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { allCollections } from '@/lib/collections';
import { olCover } from '@/lib/curated';
import { SITE_URL } from '@/lib/seo';

/**
 * Every collection the file holds (ROADMAP 5.10, SPEC F8), each as a strip of
 * its first covers. With none published this is a 404 on a production build,
 * so the footer never points at an empty shelf.
 */
export const metadata: Metadata = {
  title: 'Collections',
  description: 'Books gathered around a theme or a series, one cover each.',
  alternates: { canonical: `${SITE_URL}/collections` },
};

/** Covers in a card's strip: one row of six on a desktop, cut to three on a phone. */
const STRIP = 6;

export default function CollectionsPage() {
  const collections = allCollections();
  if (collections.length === 0) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">Collections</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          Books gathered around a theme or a series, one cover each. Every cover leads to the wall of the others we found.
        </p>
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
                <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4" aria-hidden="true">
                  {c.works.slice(0, STRIP).map((w, i) => (
                    <li key={w.id} className={i >= 3 ? 'hidden sm:block' : undefined}>
                      <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2">
                        <CoverImage src={olCover(w.coverId, 'M')} alt="" sizes="(max-width: 640px) 33vw, 16vw" />
                      </div>
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}

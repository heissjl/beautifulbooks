'use client';

import Link from '@/components/Link';
import { useT } from './i18n';
import type { WorkCollectionLink } from '@/lib/collections';

/**
 * "In these collections" under a wall (ROADMAP 6.107 Teil A, PLAN-6.107 § 5).
 *
 * The one link from a book page to the collections its work stands in. The
 * Search Console showed on 2026-10-31 that Google had indexed 136 book pages
 * and never fetched 56 of 59 collections: it fetches what is linked, and no
 * book page linked a collection. Rendered like "More by …" (6.53): a heading,
 * then one row per collection with its name and the number of books on its
 * wall, each a link to `/collections/<slug>` with no parameters — one
 * address per collection in an index. Nothing at all for a work in no
 * collection; the list is decided on the server from the published
 * collections, so a draft is never linked.
 */
export default function InCollections({ collections, className = '' }: { collections: WorkCollectionLink[]; className?: string }) {
  const t = useT();
  if (collections.length === 0) return null;
  return (
    <section className={`mt-16 ${className}`} aria-labelledby="in-collections-heading" data-in-collections={collections.length}>
      <h2 id="in-collections-heading" className="text-xl leading-tight text-ink sm:text-2xl">
        {collections.length === 1 ? t('In this collection') : t('In these collections')}
      </h2>
      <ul className="mt-4 max-w-3xl divide-y divide-line border-y border-line">
        {collections.map(c => (
          <li key={c.slug}>
            <Link href={`/collections/${c.slug}`} className="group flex items-baseline justify-between gap-4 py-3 transition-colors hover:text-accent">
              <span className="font-display text-lg text-ink transition-colors group-hover:text-accent">{c.title}</span>
              <span className="shrink-0 text-sm text-ink-3">{c.count === 1 ? t('{n} book', { n: 1 }) : t('{n} books', { n: c.count })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

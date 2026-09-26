import Link from 'next/link';
import CoverImage from './CoverImage';
import { olCover } from '@/lib/curated';
import type { Collection } from '@/lib/collections';

/** At most two rows of two cards on the home page; the rest are one click away. */
export const SHELF_MAX = 4;

/** Covers per card: the first row of the collection's wall. */
const PREVIEW = 6;

/**
 * The way from the home page into the collections (ROADMAP 5.10d, SPEC F8.3;
 * Julian, 2026-09-25: „from the bottom with a little preview of the first row
 * of the collections … not more than showing 2 rows of 2 collection preview
 * side by side"). A server component: it gets the collections as props, so
 * the collections file never reaches the browser.
 *
 * One card per published collection, in the file's order, side by side from
 * `sm` up and stacked on a phone. It grows by itself with every collection
 * that is published and stops at four; past four, a link to the overview.
 * On a phone a card shows four covers, not six, so they stay large enough to
 * recognise.
 */
export default function CollectionsShelf({ collections }: { collections: Collection[] }) {
  if (collections.length === 0) return null;
  const shown = collections.slice(0, SHELF_MAX);
  return (
    <section aria-labelledby="collections-heading" className="mt-16 sm:mt-20">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 id="collections-heading" className="text-2xl text-ink">Collections</h2>
        <Link href="/collections" className="text-sm text-ink-2 underline decoration-line underline-offset-4 hover:text-accent hover:decoration-accent">
          See all <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
        {shown.map(c => (
          <li key={c.slug}>
            <Link href={`/collections/${c.slug}`} className="group block rounded-card border border-line p-4 transition-colors hover:border-accent sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl text-ink transition-colors group-hover:text-accent">{c.title}</h3>
                <p className="shrink-0 text-sm text-ink-3">{c.works.length} {c.works.length === 1 ? 'book' : 'books'}</p>
              </div>
              <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3" aria-hidden="true">
                {c.works.slice(0, PREVIEW).map((w, i) => (
                  <li key={w.id} className={i >= 4 ? 'hidden sm:block' : undefined}>
                    <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2">
                      <CoverImage src={olCover(w.coverId, 'M')} alt="" sizes="(max-width: 640px) 25vw, 10vw" />
                    </div>
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

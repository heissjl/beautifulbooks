'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type MouseEvent } from 'react';
import CoverImage from './CoverImage';
import HeroRondell from './HeroRondell';
import { coverUrlFor } from '@/lib/coverurl';
import { pickHeroPick } from '@/lib/herofan';
import type { CollectionRing, HeroRing } from '@/lib/heroring';
import { tileTitle } from '@/lib/normalize';

/**
 * Seven covers on a turning ring beside the headline (ROADMAP 1.9). It began
 * as a fan of four in the loading stage's tiles; Julian chose the ring on
 * 2026-09-11, with seven, because at an odd count the far covers stand
 * between the near ones instead of hidden right behind them, and asked the
 * same day that the book change from visit to visit.
 *
 * Two kinds, drawn per visit (`pickHeroPick`): seven covers of one curated
 * book, and — one visit in three — seven books of one published collection
 * (ROADMAP 6.59). It renders from `lg` up only; below that the column is the
 * headline's, and a picture there would push the search field under the
 * fold, which 1.9 rules out.
 *
 * `liveSlugs` are the collections published on the running site now, from
 * the server (app/page.tsx); only those can get a ring.
 */
export default function HeroFan({ liveSlugs = [], className = '' }: { liveSlugs?: string[]; className?: string }) {
  // Drawn once per visit. Random is safe here: the ring renders only in the
  // browser (`useIsDesktop(false)` in HeroSlot), so no server HTML can disagree.
  const [pick] = useState(() => pickHeroPick(liveSlugs));
  return pick.kind === 'work' ? (
    <WorkRing ring={pick.ring} className={className} />
  ) : (
    <CollectionRingView ring={pick.ring} className={className} />
  );
}

function Face({ coverId }: { coverId: string }) {
  return (
    <div className="cover-shadow relative h-full w-full overflow-hidden rounded-[4px] bg-surface-2">
      <CoverImage src={coverUrlFor(coverId, 'M') ?? ''} alt="" sizes="100px" priority />
    </div>
  );
}

/** One book: the whole thing is one link to the book's wall — a way in, not decoration. */
function WorkRing({ ring: { workId, title: fullTitle, author, coverIds }, className }: { ring: HeroRing; className: string }) {
  // The same short form the wall's tiles use: "Frankenstein", not "Frankenstein; or, The Modern Prometheus" (6.30).
  const title = tileTitle(fullTitle);
  return (
    <Link
      href={`/book/${workId}`}
      className={`group block shrink-0 text-center ${className}`}
      aria-label={`${title} by ${author}: seven of its covers. Open the wall.`}
    >
      <HeroRondell faces={coverIds.map(id => <Face key={id} coverId={id} />)} />
      {/* The book, not a count (Julian 2026-09-11): the covers on the ring are plain to see. */}
      <p className="mt-3 text-xs text-ink-3 transition-colors group-hover:text-ink-2">
        <span className="text-ink-2">{title}</span> · {author}
      </p>
    </Link>
  );
}

/**
 * One collection (ROADMAP 6.59). Each cover is its own link and opens that
 * cover on its book's wall, as a tile of the collection wall does
 * (`/book/<id>?cover=`); the caption, and a click anywhere else on the ring,
 * open the collection. Links cannot nest, so the ring's own click goes
 * through the router, and the caption is the link a keyboard reaches.
 */
function CollectionRingView({ ring: { slug, title, covers }, className }: { ring: CollectionRing; className: string }) {
  const router = useRouter();
  const href = `/collections/${slug}`;
  const openCollection = (e: MouseEvent) => {
    if ((e.target as Element).closest('a')) return;
    router.push(href);
  };
  return (
    <div className={`group block shrink-0 text-center ${className}`}>
      <div onClick={openCollection} className="cursor-pointer">
        <HeroRondell
          faces={covers.map(c => (
            <Link
              key={c.coverId}
              href={`/book/${c.workId}?cover=${encodeURIComponent(c.coverId)}`}
              aria-label={`${tileTitle(c.title)} by ${c.author}`}
              title={`${tileTitle(c.title)} · ${c.author}`}
              className="block h-full w-full rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Face coverId={c.coverId} />
            </Link>
          ))}
        />
      </div>
      {/* The collection, not a count, as the book ring names the book. */}
      <p className="mt-3 text-xs text-ink-3">
        <Link href={href} className="transition-colors hover:text-ink-2 group-hover:text-ink-2">
          <span className="text-ink-2">{title}</span> · a collection
        </Link>
      </p>
    </div>
  );
}

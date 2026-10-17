import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import WallView from '@/components/WallView';
import { SITE_NAME } from '@/lib/seo';
import { storePause } from '@/lib/storepause';
import { isWallId, toPublic, type PublicWall, type Wall } from '@/lib/walls/model';
import { isOwner, VISITOR_COOKIE } from '@/lib/walls/owner';
import { cachedWall, flushViews, wallMemory, wallStoreFromEnv, type WallStore } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';
import { later } from '@/app/api/count';
import { measure } from '@/app/api/measure';

/**
 * One reader's wall (ROADMAP 5.13a). Never indexed: the title is a reader's
 * own text, and a wall is theirs to share, not ours to publish.
 *
 * **What a visit costs the store** (ROADMAP 2.18c; measured 2026-10-05, 2.18b:
 * two `GET` and one `HINCRBY` per visit): the wall is read once per request
 * for metadata and page together (React's `cache`), and from the instance's
 * memory for half a minute for anyone but its owner, who always reads the
 * store (`lib/walls/cache.ts`). A view by someone else is counted in memory
 * and written in a bundle at most every ten seconds, after a response has
 * left. While the store is paused (`lib/storepause.ts`) the page answers from
 * memory or says "did not answer" at once, without waiting on it.
 */
type Props = { params: Promise<{ id: string }>; locale?: Locale };

export const dynamic = 'force-dynamic';

type Found = { store: WallStore; wall: Wall } | null | 'down';

/** Once per request: the wall from memory or the store, for whoever asks. */
const readWall = cache(async (id: string): Promise<Found> => {
  if (!wallsEnabled() || !isWallId(id)) return null;
  const store = wallStoreFromEnv();
  if (!store) return 'down';
  const pause = storePause();
  const now = Date.now();
  if (pause.active(now)) {
    const held = wallMemory().staleWall(id);
    return held === undefined ? 'down' : held && { store, wall: held };
  }
  try {
    const wall = await cachedWall(store, id, { now });
    return wall && { store, wall };
  } catch {
    pause.trip(now);
    return 'down';
  }
});

/**
 * The wall for the page itself: its owner gets it fresh from the store, so
 * their own change is never half a minute late; anyone else is one more view
 * (5.13d), counted in memory — nothing about them is kept, and a failed count
 * costs the page nothing.
 */
async function wallForPage(id: string): Promise<PublicWall | null | 'down'> {
  const found = await readWall(id);
  if (!found || found === 'down') return found;
  const { store } = found;
  let { wall } = found;
  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (isOwner(wall, visitor)) {
    try {
      const fresh = await store.get(id);
      if (fresh) {
        wall = fresh;
        wallMemory().keepWall(id, fresh, Date.now());
      }
    } catch {
      // The copy in memory is at most half a minute old; better than an error page for one silent store.
      storePause().trip();
    }
  } else {
    wallMemory().addView(id);
    later(async () => {
      await flushViews(store);
    });
  }
  return toPublic(wall);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await readWall((await params).id);
  const wall = found && found !== 'down' ? toPublic(found.wall) : null;
  const title = wall ? `${wall.title} — a collection of covers` : 'A collection of covers';
  // Shared links get the card beside this file (opengraph-image.tsx); these give it words: the
  // reader's own introduction if they wrote one, otherwise what the wall holds.
  const description = wall
    ? (wall.intro?.trim() || `${wall.tiles.length} ${wall.tiles.length === 1 ? 'cover' : 'covers'}${wall.by ? `, collected by ${wall.by}` : ''}, on ${SITE_NAME}.`).slice(0, 200)
    : undefined;
  return {
    title,
    ...(description ? { description } : {}),
    robots: { index: false, follow: false },
    openGraph: { type: 'website', title, ...(description ? { description } : {}) },
    twitter: { card: 'summary_large_image', title, ...(description ? { description } : {}) },
  };
}

export default async function WallPage({ params, locale = DEFAULT_LOCALE }: Props) {
  measure('page-wall');
  const t = translator(locale);
  const wall = await wallForPage((await params).id);
  if (!wall) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        {wall === 'down' ? (
          // A silent store is not a missing wall (SPEC N12).
          <p className="py-24 text-center text-ink-2">{t('The store did not answer. Try again in a moment.')}</p>
        ) : (
          <WallView initial={wall} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

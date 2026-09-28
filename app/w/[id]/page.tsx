import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import WallView from '@/components/WallView';
import { isWallId, toPublic, type PublicWall } from '@/lib/walls/model';
import { wallStoreFromEnv } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';

/**
 * One reader's wall (ROADMAP 5.13a). Never indexed: the title is a reader's
 * own text, and a wall is theirs to share, not ours to publish.
 */
type Props = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

async function loadWall(id: string): Promise<PublicWall | null | 'down'> {
  if (!wallsEnabled() || !isWallId(id)) return null;
  const store = wallStoreFromEnv();
  if (!store) return 'down';
  try {
    const wall = await store.get(id);
    return wall ? toPublic(wall) : null;
  } catch {
    return 'down';
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const wall = await loadWall((await params).id);
  return {
    title: wall && wall !== 'down' ? `${wall.title} — a cover wall` : 'Cover wall',
    robots: { index: false, follow: false },
  };
}

export default async function WallPage({ params }: Props) {
  const wall = await loadWall((await params).id);
  if (!wall) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        {wall === 'down' ? (
          // A silent store is not a missing wall (SPEC N12).
          <p className="py-24 text-center text-ink-2">The wall store did not answer. Try again in a moment.</p>
        ) : (
          <WallView initial={wall} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

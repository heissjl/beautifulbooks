import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import WallCard from '@/components/WallCard';
import { SITE_URL } from '@/lib/seo';
import { toPublic } from '@/lib/walls/model';
import { showcased, wallStoreFromEnv } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';

/**
 * Walls readers made and chose to show (ROADMAP 5.13d; Julian, 2026-09-28:
 * „user-created collections zeigen — auf der website in einem eigenen
 * website bereich"). Only walls Julian approved, most viewed first.
 */
export const metadata: Metadata = {
  title: 'Walls by readers',
  description: 'Cover walls readers put together and chose to show.',
  alternates: { canonical: `${SITE_URL}/walls/readers` },
  // Readers' own words: indexed once Julian has decided so (ROADMAP 5.13d).
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

export default async function ReadersWallsPage() {
  if (!wallsEnabled()) notFound();
  const store = wallStoreFromEnv();
  let walls: Awaited<ReturnType<typeof showcased>> | 'down' = 'down';
  if (store) walls = await showcased(store).catch(() => 'down' as const);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">Walls by readers</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          Covers readers gathered into walls of their own and chose to show here.{' '}
          <Link href="/walls" className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">Make yours</Link>.
        </p>
        {walls === 'down' ? (
          <p className="mt-10 text-ink-2">The wall store did not answer. Try again in a moment.</p>
        ) : walls.length === 0 ? (
          <p className="mt-10 text-ink-2">None yet. Make a wall of six covers or more, write a few lines about it, and offer it here.</p>
        ) : (
          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {walls.map(({ wall }) => (
              <li key={wall.id}>
                <WallCard wall={toPublic(wall)} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

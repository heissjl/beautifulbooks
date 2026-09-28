import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import WallsStart from '@/components/WallsStart';
import { hasApiKey } from '@/lib/recognize';
import { SITE_URL } from '@/lib/seo';
import { wallsEnabled } from '@/lib/walls/switch';

/**
 * Where a reader's own wall begins (ROADMAP 5.13a, SPEC F9): from a book (picked here,
 * without leaving the page), six random favourites, or a photo of a shelf. Behind the WALLS switch like the cover game.
 */
export const metadata: Metadata = {
  title: 'Create your collection',
  description: 'Gather the covers you love into a collection of your own and keep the link.',
  alternates: { canonical: `${SITE_URL}/create` },
};

export const dynamic = 'force-dynamic';

export default function WallsPage() {
  if (!wallsEnabled()) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">Create your collection</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          Gather the covers you love into a collection of your own and keep the link. No account: this browser remembers which collections are yours.{' '}
          <Link href="/collections/readers" className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">See collections by readers</Link>.
        </p>
        <Suspense>
          <WallsStart photoOn={hasApiKey()} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import WallReview from '@/components/WallReview';
import { wallsEnabled } from '@/lib/walls/switch';

/** Julian's review of walls offered for Walls by readers (ROADMAP 5.13d); the route checks the admin cookie. */
export const metadata: Metadata = { title: 'Walls to review', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function WallReviewPage() {
  if (!wallsEnabled()) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl text-ink">Walls to review</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">Offered for Walls by readers. Their title and lines become public only when you press Show.</p>
        <WallReview />
      </main>
      <SiteFooter />
    </div>
  );
}

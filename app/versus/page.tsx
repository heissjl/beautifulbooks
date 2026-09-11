import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import Versus from '@/components/Versus';
import { versusEnabled } from '@/lib/hotornot/switch';

/**
 * The cover game (ROADMAP 5.8a): two covers, one click. Behind a switch —
 * on in previews and on a laptop, off in production until it is switched on
 * (`lib/hotornot/switch.ts`) — and kept out of search engines while it is a
 * test among friends.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Which cover?',
  description: 'Two covers, one click: which one would you rather look at?',
  robots: { index: false, follow: false },
};

export default function VersusPage() {
  if (!versusEnabled()) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        <Versus />
      </main>
      <SiteFooter />
    </div>
  );
}

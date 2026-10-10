import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import WallReview from '@/components/WallReview';
import { wallsEnabled } from '@/lib/walls/switch';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';

/** Julian's review of walls offered for Walls by readers (ROADMAP 5.13d); the route checks the admin cookie. */
export const metadata: Metadata = { title: 'Collections by readers — moderation', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function WallReviewPage({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = translator(locale);
  if (!wallsEnabled()) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl text-ink">{t('Collections by readers')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">{t('Shown without review. The most reported first; take one down, or put it back.')}</p>
        <WallReview />
      </main>
      <SiteFooter />
    </div>
  );
}

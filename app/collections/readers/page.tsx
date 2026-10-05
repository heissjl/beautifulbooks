import type { Metadata } from 'next';
import Link from '@/components/Link';
import { notFound } from 'next/navigation';
import { randomInt } from 'node:crypto';
import HeaderSearch from '@/components/HeaderSearch';
import ReaderWalls from '@/components/ReaderWalls';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { SITE_URL } from '@/lib/seo';
import type { PublicWall } from '@/lib/walls/model';
import { readersPage, wallStoreFromEnv } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/translate';

/**
 * Walls readers made and chose to show (ROADMAP 5.13d; Julian, 2026-09-28:
 * „user-created collections … ohne review auf der extra seite … reihenfolge
 * ist ein mix aus neu, klicks und randomness“). The first 26 are rendered
 * here in this visit's order; the rest load as the reader scrolls.
 */
export const metadata: Metadata = {
  title: 'Collections by readers',
  description: 'Collections of covers readers put together and chose to show.',
  alternates: { canonical: `${SITE_URL}/collections/readers` },
  // Readers' own words, unreviewed: kept out of the index until Julian decides (5.13d).
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

export default async function ReadersWallsPage({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = translator(locale);
  if (!wallsEnabled()) notFound();
  const store = wallStoreFromEnv();
  const seed = randomInt(2 ** 32 - 1);
  let first: { walls: PublicWall[]; next: number | null } | 'down' = 'down';
  if (store) first = await readersPage(store, seed, 0).catch(() => 'down' as const);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">{t('Collections by readers')}</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          {t('Covers readers gathered into collections of their own and chose to show here, new ones and much-visited ones mixed with a little chance.')}{' '}
          <Link href="/create" className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">{t('Make yours')}</Link>.
        </p>
        {first === 'down' ? (
          <p className="mt-10 text-ink-2">{t('The store did not answer. Try again in a moment.')}</p>
        ) : first.walls.length === 0 ? (
          <p className="mt-10 text-ink-2">{t('None yet. Make a collection and show it here.')}</p>
        ) : (
          <ReaderWalls initial={first.walls} next={first.next} seed={seed} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

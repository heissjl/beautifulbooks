import Link from '@/components/Link';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';

/**
 * A real 404 (ROADMAP 1.7). Before this, an unknown but well-formed work id
 * answered 200 with "Book not found" in the body, which a crawler reads as
 * a page worth indexing.
 *
 * `locale` comes from the German tree's own not-found file (6.85); Next
 * passes nothing here itself.
 */
export default function NotFound({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const t = translator(locale);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="font-display text-2xl text-ink">{t('Nothing here')}</p>
        <p className="mt-2 text-sm text-ink-3">{t('The page does not exist, or the book is not in the catalogue.')}</p>
        <Link href="/" className="mt-6 text-sm text-accent hover:underline">{t('Search for a book')}</Link>
      </main>
      <SiteFooter />
    </div>
  );
}

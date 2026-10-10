import type { Metadata } from 'next';
import Link from '@/components/Link';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import { rich } from '@/components/rich';
import { readImprint } from '@/lib/imprint';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';

/**
 * The legal notice (SPEC F6, ROADMAP 2.3): name, address and e-mail from
 * `IMPRINT_*`, never from the repository. The German words „Impressum“ and
 * the paragraph line stay in both languages, because the law they cite is
 * German (docs/recht-hobbyseite.md §2).
 */
export const metadata: Metadata = {
  title: 'Impressum',
  alternates: { canonical: '/contact' },
  description: 'Legal notice: who runs this site and how to reach them.',
};

const ext = 'underline underline-offset-2 hover:text-accent';

export default function ContactPage({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = translator(locale);
  const imprint = readImprint();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <h1 className="text-4xl leading-[1.1] text-ink">Impressum</h1>
        <p className="mt-2 text-sm text-ink-3">{t('Legal notice')} · Angaben gemäß § 5 DDG und § 18 Abs. 1 MStV</p>
        <section className="mt-10 text-[15px] leading-relaxed text-ink-2">
          <p className="kicker">{t('Responsible for this site')}</p>
          <address className="mt-3 not-italic text-ink">
            {imprint.name}
            <br />
            {imprint.street}
            <br />
            {imprint.city}
          </address>
          <p className="mt-4">
            {t('E-mail')}:{' '}
            <a href={`mailto:${imprint.email}`} className={ext}>{imprint.email}</a>
          </p>
        </section>
        <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-ink-2">
          <p>
            {rich(t('This is a private, non-commercial site. Book data comes from {openlibrary} and {googlebooks}; cover images are shown from those catalogues and belong to their publishers. If you hold rights to an image and want it removed from view here, write to the address above.'), {
              openlibrary: <a className={ext} href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Open Library</a>,
              googlebooks: <a className={ext} href="https://books.google.com" target="_blank" rel="noopener noreferrer">Google Books</a>,
            })}
          </p>
          <p>
            {rich(t('What the site does with data is described in the {privacy}.'), {
              privacy: <Link href="/privacy" className={ext}>{t('privacy notice')}</Link>,
            })}
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

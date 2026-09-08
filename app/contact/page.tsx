import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { readImprint } from '@/lib/imprint';

/**
 * The legal notice — Impressum — required of every public telemedium in
 * Germany that is not purely personal (§ 18 Abs. 1 MStV: name and an address
 * where post can be served) and, should the site count as commercial, § 5
 * DDG, which for a private person adds only the e-mail address. Both are
 * satisfied here (docs/recht-hobbyseite.md §2).
 *
 * The values come from the environment, never from the repository. A build
 * without them fails in `readImprint` rather than shipping a blank notice.
 */
export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Legal notice: who runs this site and how to reach them.',
};

export default function ContactPage() {
  const imprint = readImprint();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <h1 className="text-4xl leading-[1.1] text-ink">Impressum</h1>
        <p className="mt-2 text-sm text-ink-3">Legal notice · Angaben gemäß § 5 DDG und § 18 Abs. 1 MStV</p>

        <section className="mt-10 text-[15px] leading-relaxed text-ink-2">
          <p className="kicker">Responsible for this site</p>
          <address className="mt-3 not-italic text-ink">
            {imprint.name}
            <br />
            {imprint.street}
            <br />
            {imprint.city}
          </address>
          <p className="mt-4">
            E-mail:{' '}
            <a href={`mailto:${imprint.email}`} className="underline underline-offset-2 hover:text-accent">{imprint.email}</a>
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-ink-2">
          <p>
            This is a private, non-commercial site. Book data comes from{' '}
            <a className="underline underline-offset-2 hover:text-accent" href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Open Library</a>{' '}
            and{' '}
            <a className="underline underline-offset-2 hover:text-accent" href="https://books.google.com" target="_blank" rel="noopener noreferrer">Google Books</a>;
            cover images are shown from those catalogues and belong to their publishers. If you hold
            rights to an image and want it removed from view here, write to the address above.
          </p>
          <p>
            What the site does with data is described in the{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-accent">privacy notice</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

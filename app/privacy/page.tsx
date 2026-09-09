import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { readImprint } from '@/lib/imprint';
import { commerceEnabled } from '@/lib/sitemode';

/**
 * The privacy notice (Art. 13 GDPR), written from what the code does rather
 * than from a generator: every row of the table in docs/recht-hobbyseite.md
 * §3.2 has a paragraph here, and nothing here describes a processing the
 * site does not perform (N12 applies to this page too).
 *
 * Mode-aware (E20): the availability check only exists in shop mode, and the
 * page must not mention a probe the public site never makes.
 *
 * The log retention below is Vercel's figure for the plan the site runs on
 * (one hour on Hobby, docs/logs/runtime, read 2026-09-08); update it with
 * the plan (ROADMAP 0.12).
 */
export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What this site does with data, which is little, and who is responsible for it.',
};

const UPDATED = '8 September 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

const ext = 'underline underline-offset-2 hover:text-accent';

export default function PrivacyPage() {
  const imprint = readImprint();
  const shop = commerceEnabled();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <h1 className="text-4xl leading-[1.1] text-ink">Privacy</h1>
        <p className="mt-2 text-sm text-ink-3">Datenschutzerklärung · last updated {UPDATED}</p>

        <Section title="In short">
          <p>
            This site has no accounts, no forms, no advertising and no tracking. It does not set a
            tracking cookie and does not need a consent banner. What it does process is listed below,
            in full, because a short list is easier to check than a reassuring sentence.
          </p>
        </Section>

        <Section title="Who is responsible">
          <address className="not-italic">
            {imprint.name}
            <br />
            {imprint.street}
            <br />
            {imprint.city}
            <br />
            <a href={`mailto:${imprint.email}`} className={ext}>{imprint.email}</a>
          </address>
          <p>
            The same details are on the <Link href="/contact" className={ext}>Impressum</Link> page.
          </p>
        </Section>

        <Section title="Hosting">
          <p>
            The site is served by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA. When
            your browser requests a page, Vercel&rsquo;s servers receive your IP address, the address
            of the page, the time, and what your browser says about itself. That is how any web server
            works; without it nothing could be sent back to you. Vercel keeps these request logs for
            one hour on the plan this site runs on. The server-side functions run in Frankfurt, but
            Vercel is a US company and data may be processed in the United States; Vercel is certified
            under the EU-US Data Privacy Framework, which the European Commission recognises as
            adequate protection. Legal basis: legitimate interest in running and securing the site
            (Art. 6(1)(f) GDPR). Vercel&rsquo;s own notice:{' '}
            <a className={ext} href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-notice</a>.
          </p>
        </Section>

        <Section title="Visitor statistics">
          <p>
            The site uses Vercel Web Analytics to count page views. It sets no cookie and stores
            nothing in your browser. For each page view it records the page, the referring page, your
            country and region, your device type and browser, and the time. To tell one visit from the
            next it computes a hash from the request that is discarded after 24 hours; it cannot be
            used to recognise you again or across other sites. The search term you typed is replaced
            by the word &ldquo;redacted&rdquo; before the page view is sent, so what you searched for
            stays in your browser. Legal basis: legitimate interest in knowing whether the site is
            used (Art. 6(1)(f) GDPR). Details:{' '}
            <a className={ext} href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer">vercel.com/docs/analytics/privacy-policy</a>.
          </p>
        </Section>

        <Section title="Cover images from other servers">
          <p>
            The covers you see are not stored here. Your browser loads them directly from Open
            Library (Internet Archive, San Francisco, USA; images are served from archive.org) and,
            for a few, from Google Books (Google LLC, USA). Those servers therefore see your IP
            address and the image you asked for, as they would if you opened the catalogue yourself.
            The images are the point of the site, so there is no way to show them without this.
            Legal basis: legitimate interest (Art. 6(1)(f) GDPR). Google is certified under the EU-US
            Data Privacy Framework; the Internet Archive publishes its own{' '}
            <a className={ext} href="https://archive.org/about/terms.php" target="_blank" rel="noopener noreferrer">privacy terms</a>.
          </p>
          <p>
            Searches and book lookups, by contrast, are made by this site&rsquo;s server on your
            behalf. Open Library and Google Books receive the title you searched for or the book you
            opened, never your IP address.
          </p>
        </Section>

        <Section title="What is kept in your browser">
          <p>
            Four small things, all of them only on your device and none of them sent anywhere:
            your last searches (so the box can offer them again), the covers shown in the loading
            animation of the page you are on (cleared when the tab closes), which of the loading
            pictures you were shown (also cleared when the tab closes, so a search does not fetch
            a new picture every time), and the market you chose for the shop links, which is also
            set as a cookie named &ldquo;market&rdquo; so the server can build the right links.
            Each exists only to provide something you asked for, which is why no consent is
            required (§ 25(2) TDDDG). Clearing your browser&rsquo;s site data removes all four.
          </p>
        </Section>

        <Section title="Shop links and click counting">
          <p>
            Clicking a shop link takes you through this site to the shop, and the click is written
            to the server log: which shop, which market, which ISBN, and when. Nothing about you is
            recorded &mdash; no IP address, no cookie, no browser details, no referrer &mdash; and
            the log is kept for the same hour as the hosting log. From the moment you arrive at the
            shop, its own privacy notice applies.
            {shop
              ? ' Some links carry an affiliate parameter, which tells the shop that you came from here; it does not tell this site who you are.'
              : ' The links carry no affiliate or tracking parameter.'}
          </p>
          {shop && (
            <p>
              The &ldquo;Check the shops&rdquo; button, when you press it, asks this site&rsquo;s
              server to load each shop&rsquo;s page for the ISBN. The shops see the server, not you.
            </p>
          )}
        </Section>

        <Section title="Your rights">
          <p>
            Under the GDPR you may ask what personal data is held about you and have it corrected,
            deleted or restricted, object to its processing, and receive it in a portable form
            (Art. 15&ndash;21). Given the list above there is almost nothing to hold: the site cannot
            tell one visitor from another. Write to the address at the top for anything at all. You
            may also complain to a data protection authority, for instance the one for the
            responsible person&rsquo;s state of residence in Germany, or your own.
          </p>
          <p>
            Nothing here is required of you: you can use the site without giving any data beyond
            what a browser sends by itself. No automated decisions are made about you.
          </p>
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}

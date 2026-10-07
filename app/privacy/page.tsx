import type { Metadata } from 'next';
import Link from '@/components/Link';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import { rich } from '@/components/rich';
import { readImprint } from '@/lib/imprint';
import { availabilityEnabled, commerceEnabled } from '@/lib/sitemode';
import { affiliateNetworks, affiliateShops } from '@/lib/buylinks';
import { versusEnabled } from '@/lib/hotornot/switch';
import { inspirationEnabled } from '@/lib/inspiration/switch';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/translate';

/**
 * The privacy notice (SPEC F6, ROADMAP 2.3; basis docs/recht-hobbyseite.md).
 * Every processing the site does is listed, in full, because a short list is
 * easier to check than a reassuring sentence. Sections for the game, the
 * Shelf-Portrait and the friends' suggestions appear only where those are switched on, so the notice
 * never names a setting that is not set (N12).
 *
 * German since 6.85 through `t`; the German is a translation of this text,
 * not a second notice — the English stays the one that is maintained.
 */
export const metadata: Metadata = {
  title: 'Privacy',
  alternates: { canonical: '/privacy' },
  description: 'What this site does with data, which is little, and who is responsible for it.',
};

const UPDATED = '5 October 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

const ext = 'underline underline-offset-2 hover:text-accent';

export default function PrivacyPage({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  const t = translator(locale);
  const imprint = readImprint();
  const shop = commerceEnabled();
  // The shops whose links carry a partner id right now (ROADMAP 4.13 step 5): named
  // from the variables that are set, so a partner joins or leaves the notice with them.
  const partners = affiliateShops();
  // A network link (Awin) reaches the network's server before the shop's, so the notice names it (ROADMAP 4.3).
  const networks = affiliateNetworks();
  const game = versusEnabled();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <h1 className="text-4xl leading-[1.1] text-ink">{t('Privacy')}</h1>
        <p className="mt-2 text-sm text-ink-3">Datenschutzerklärung · {t('last updated {date}', { date: t(UPDATED) })}</p>

        <Section title={t('In short')}>
          <p>{t('This site has no accounts, no forms, no advertising and no tracking. It does not set a tracking cookie and does not need a consent banner. What it does process is listed below.')}</p>
        </Section>

        <Section title={t('Who is responsible')}>
          <address className="not-italic">
            {imprint.name}
            <br />
            {imprint.street}
            <br />
            {imprint.city}
            <br />
            <a href={`mailto:${imprint.email}`} className={ext}>{imprint.email}</a>
          </address>
          <p>{rich(t('The same details are on the {impressum} page.'), { impressum: <Link href="/contact" className={ext}>Impressum</Link> })}</p>
        </Section>

        <Section title={t('Hosting')}>
          <p>
            {t('The site is served by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA. When your browser requests a page, Vercel’s servers receive your IP address, the address of the page, the time, and what your browser says about itself. That is how any web server works; without it nothing could be sent back to you. Vercel keeps these request logs for one hour on the plan this site runs on. The server-side functions run in Frankfurt, but Vercel is a US company and data may be processed in the United States; Vercel is certified under the EU-US Data Privacy Framework, which the European Commission recognises as adequate protection. Legal basis: legitimate interest in running and securing the site (Art. 6(1)(f) GDPR).')}{' '}
            {rich(t('Vercel’s own notice: {link}.'), { link: <a className={ext} href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-notice</a> })}
          </p>
        </Section>

        <Section title={t('Visitor statistics')}>
          <p>
            {t('The site uses Vercel Web Analytics to count page views. It sets no cookie and stores nothing in your browser. For each page view it records the page, the referring page, your country and region, your device type and browser, and the time. To tell one visit from the next it computes a hash from the request that is discarded after 24 hours; it cannot be used to recognise you again or across other sites. The search term you typed is replaced by the word “redacted” before the page view is sent, so what you searched for stays in your browser. Legal basis: legitimate interest in knowing whether the site is used (Art. 6(1)(f) GDPR).')}{' '}
            {rich(t('Details: {link}.'), { link: <a className={ext} href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer">vercel.com/docs/analytics/privacy-policy</a> })}
          </p>
        </Section>

        <Section title={t('Cover images from other servers')}>
          <p>
            {t('The covers you see are not stored here. Your browser loads them directly from Open Library (Internet Archive, San Francisco, USA; images are served from archive.org) and, for a few, from Google Books (Google LLC, USA). Those servers therefore see your IP address and the image you asked for, as they would if you opened the catalogue yourself. The images are the point of the site, so there is no way to show them without this. Legal basis: legitimate interest (Art. 6(1)(f) GDPR).')}{' '}
            {rich(t('Google is certified under the EU-US Data Privacy Framework; the Internet Archive publishes its own {terms}.'), { terms: <a className={ext} href="https://archive.org/about/terms.php" target="_blank" rel="noopener noreferrer">{t('privacy terms')}</a> })}
          </p>
          <p>{t('Searches and book lookups, by contrast, are made by this site’s server on your behalf. Open Library and Google Books receive the title you searched for or the book you opened, never your IP address.')}</p>
          <p>{t('If you start a collection from your Calibre library or your Goodreads export, the file you choose is read in your browser and never sent, and this site does not contact Goodreads. For each book, its title, first author and ISBNs go to this server, which looks them up at Open Library as it does a search; they are not stored and not written to the log, which only counts how many books were asked about and found.')}</p>
        </Section>

        <Section title={t('What is kept in your browser')}>
          <p>{t('Four small things, all of them only on your device and none of them sent anywhere else: your last searches (so the box can offer them again), the covers shown in the loading animation of the page you are on (cleared when the tab closes), the market you chose for the shop links, which is also set as a cookie named “market” so the server can build the right links, and the language you chose at the top of the page, a cookie named “locale” that is set only when you use that switch. Each exists only to provide something you asked for, which is why no consent is required (§ 25(2) TDDDG). Clearing your browser’s site data removes all four.')}</p>
        </Section>

        <Section title={t('Shop links and click counting')}>
          <p>
            {t('Clicking a shop link takes you through this site to the shop, and the click is written to the server log: which shop, which market, which ISBN where the link was built from one, and when; the log is kept for the same hour as the hosting log. The words of a search by title are not logged. The site also adds one to a daily total per shop, market and kind of link, without the ISBN, and keeps those totals for about thirteen months. Nothing about you is recorded in either — no IP address, no cookie, no browser details, no referrer. From the moment you arrive at the shop, its own privacy notice applies.')}{' '}
            {shop
              ? t('Some links carry an affiliate parameter, which tells the shop that you came from here; it does not tell this site who you are.')
              : t('The links carry no affiliate or tracking parameter.')}
            {partners.length > 0 && (
              <>
                {' '}
                {t('At present these are the links to {shops}. When you follow one, the shop may store a cookie in your browser so that a purchase is credited to this site; that happens on the shop’s own site and under its privacy notice, and this site receives nothing about you from it.', { shops: partners.join(', ') })}
              </>
            )}
            {/* Wording approved by Julian on 2026-10-07 (genialokal through Awin). */}
            {networks.map(({ network, shops }) => (
              <span key={network}>
                {' '}
                {t('Links to {shops} pass through the {network} affiliate network first: {network} records the click and may store its own cookie so that a purchase is credited to this site, under {network}’s privacy notice.', { shops: shops.join(', '), network })}
              </span>
            ))}
          </p>
          {availabilityEnabled() && (
            <p>{t('The “Check the shops” button, when you press it, asks this site’s server to load each shop’s page for the ISBN. The shops see the server, not you.')}</p>
          )}
        </Section>

        {/* ROADMAP 3.1b; wording approved by Julian on 2026-10-04. Nothing is stored on the device, hence no consent (§ 25 TDDDG, plan §6). */}
        <Section title={t('What is counted when you leave a page')}>
          <p>{t('When you leave a book page, a search, the home page, a collection or a shared Shelf-Portrait, your browser sends one anonymous summary — for example which book, how many covers came into view, whether a shop link was used — and the site adds it to daily totals. The summary also names the kind of site your visit began on, as one word from a fixed list (a search engine, Reddit, Pinterest, Hacker News and the like), or the word in the “via” part of a link this site posted itself. No identifier, cookie, IP address or address you came from is stored, so a summary cannot be linked to you or to another visit. Searches that found nothing are kept as text for 90 days to improve the catalogue.')}</p>
        </Section>

        {game && (
          <Section title={t('The cover game')}>
            <p>{t('Picking a cover in the game writes one line to a database: the two covers that were shown, which of them you picked, and the day — not the minute. Nothing about you is written with it: no IP address, no cookie, no browser details, no identifier of any kind, so two picks of yours cannot be recognised as yours or as belonging together. Reporting a cover as “not a cover” writes the cover and the reason, again with nothing about you, and the game stores nothing in your browser. These lines are what the ranking is counted from; they are kept while the game runs, because deleting them would delete the ranking. They live in a Redis database that this site rents from Redis through Vercel’s marketplace; it holds the lines on this site’s behalf. Legal basis: legitimate interest in a ranking that reflects what readers picked (Art. 6(1)(f) GDPR).')}</p>
          </Section>
        )}

        {/* The sentence Julian approved on 2026-10-05, as he approved it (ROADMAP 5.18b). */}
        {inspirationEnabled() && (
          <Section title={t('Your Shelf-Portrait')}>
            <p>{t('A Shelf-Portrait you finish is kept under its link: the books, the covers you chose, and the name and the line under the title if you typed them. Nothing else about you is stored with it, and no cookie is set for it. Send us the link and we remove it.')}</p>
          </Section>
        )}

        <Section title={t('Your rights')}>
          <p>{t('Under the GDPR you may ask what personal data is held about you and have it corrected, deleted or restricted, object to its processing, and receive it in a portable form (Art. 15–21). Given the list above there is almost nothing to hold: the site cannot tell one visitor from another. Write to the address at the top for anything at all. You may also complain to a data protection authority, for instance the one for the responsible person’s state of residence in Germany, or your own.')}</p>
          <p>{t('Nothing here is required of you: you can use the site without giving any data beyond what a browser sends by itself. No automated decisions are made about you.')}</p>
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}

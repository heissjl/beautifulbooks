import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import { VERDICT_LEAD, VERDICT_MEANING, VERDICT_ORDER } from '@/lib/verdicts';
import { commerceEnabled } from '@/lib/sitemode';

/**
 * What the site knows, what it does not, and what its judgements mean
 * (SPEC §10 B4).
 *
 * The detail page says some of this in footnotes. Trust comes from stating
 * the gaps in one place and in order, which is what SPEC §9.2 asks for. Every
 * number here has been measured; none of it claims completeness.
 */
export const metadata: Metadata = {
  title: 'About',
  alternates: { canonical: '/about' },
  description:
    'Where the cover images come from, what is missing from them, and what the notes under each buy link mean.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <h1 className="text-4xl leading-[1.1] text-ink">About</h1>

        {/*
          Shortened 2026-10-02 (Julian: "can you shorten the about page"),
          from about 1,000 words to about 500, the verdict notes in lib/verdicts.ts
          included. The facts stay (the section on "Looks like this" went too, Julian the same day); the measurements
          and the reassurances went. Rewriting it in the first person is
          still ROADMAP 4.12, Julian's.
        */}
        <Section title="What this is">
          <p>
            A book is printed again and again, often with a new cover each time. This site puts those
            covers side by side, by language and year, so you can find the edition you would want on
            your shelf.
          </p>
        </Section>

        <Section title="Where the images come from">
          <p>
            Almost all of them from{' '}
            <a className="underline underline-offset-2 hover:text-accent" href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Open Library</a>,
            a few from{' '}
            <a className="underline underline-offset-2 hover:text-accent" href="https://books.google.com" target="_blank" rel="noopener noreferrer">Google Books</a>,
            which also says which picture a publisher currently files under an ISBN. The two catalogues
            hold only part of what has been printed: you see the covers someone scanned and uploaded.
          </p>
        </Section>

        <Section title="What is missing">
          <ul className="list-disc space-y-3 pl-5 marker:text-ink-3">
            <li>
              <strong className="font-medium text-ink">Editions without a scan.</strong> Most records
              have no image. The line under a book&rsquo;s title shows how many were checked.
            </li>
            <li>
              <strong className="font-medium text-ink">Editions without an ISBN.</strong> Most books
              printed before about 1970 have none, so shops cannot look them up. For those you get
              searches by title, publisher and year, and a reverse image search.
            </li>
            <li>
              <strong className="font-medium text-ink">The same cover twice.</strong> Near-identical
              scans are folded into one tile marked &ldquo;+2&rdquo;. When in doubt, both are shown.
            </li>
            <li>
              <strong className="font-medium text-ink">Very long records.</strong> The scan stops
              after 1,500 editions.
            </li>
          </ul>
        </Section>

        <Section title="The note under a buy link">
          <p>
            When you pick a cover, the buy links get a short note. It compares your cover with the
            image the publisher has filed for that ISBN. That image is the only thing checked; no shop
            is asked. The note says one of these:
          </p>
          {/*
            Quoted from lib/verdicts.ts, the same constants the sidebar
            renders. Written out by hand, this list drifted: it went on
            teaching "Shops show this cover" long after that wording had been
            retired for claiming more than is checked.
          */}
          <ul className="list-disc space-y-3 pl-5 marker:text-ink-3">
            {VERDICT_ORDER.map(status => (
              <li key={status}>
                <strong className="font-medium text-ink">{VERDICT_LEAD[status]}</strong>{' '}
                {VERDICT_MEANING[status]}
              </li>
            ))}
          </ul>
          <p>It describes the publisher&rsquo;s image, not what a shop will send.</p>
        </Section>

        <Section title="Buy links">
          {/*
            Hobby mode (E20): the public site carries neutral links and says
            so. The shop-mode paragraph is the one Phase 4 will need, kept
            here so the two never drift apart.
          */}
          {commerceEnabled() ? (
            <p>
              Some links can earn a commission. The order of the shops is not sorted by what they pay,
              and no shop pays to appear.
            </p>
          ) : (
            <p>No link on this site earns money. There are no affiliate links, ads or paid placements.</p>
          )}
          {/*
            The one sorting there is, and what it rests on: a fact about the
            number, never about a shop (ROADMAP 1.11, plan §4).
          */}
          <p>
            The order of the shops follows the ISBN. Its first digits show where it was registered,
            978-3 for the German-language area, for example. For a number from another country,
            marketplaces that sell copies from many countries come first.
          </p>
          <p>
            Clicks on buy links are counted: shop, market, ISBN and time. Nothing about you is
            recorded. Details are in the{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-accent">privacy notice</Link>.
          </p>
        </Section>

        <p className="mt-12 text-sm">
          <Link href="/" className="text-accent underline underline-offset-2">Search for a book</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

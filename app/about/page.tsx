import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { VERDICT_LEAD, VERDICT_MEANING, VERDICT_ORDER } from '@/lib/verdicts';
import { indexBuiltAt, indexSize } from '@/lib/coverindex';

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
  description:
    'Where the cover images come from, what is missing from them, and what the notes under each buy link mean.',
};

const INDEXED = indexSize();
const INDEX_BUILT_AT = indexBuiltAt();

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
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <h1 className="text-4xl leading-[1.1] text-ink">About</h1>

        <Section title="What this is">
          <p>
            A book is printed again and again, and each printing gets a new cover. This site puts
            those covers next to each other, grouped by language and sorted by year, so you can pick
            the edition you would actually want on a shelf &mdash; and then find a copy of it.
          </p>
        </Section>

        <Section title="Where the images come from">
          <p>
            Two open catalogues:{' '}
            <a className="underline underline-offset-2 hover:text-accent" href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Open Library</a>,
            which supplies almost all of the covers and the edition records behind them, and{' '}
            <a className="underline underline-offset-2 hover:text-accent" href="https://books.google.com" target="_blank" rel="noopener noreferrer">Google Books</a>,
            which adds a few images and, more usefully, the picture a publisher currently attaches to
            an ISBN. Measured across three books, Google contributed between 1 and 23 percent of the
            covers &mdash; for <em>Nineteen Eighty-Four</em>, four images out of 282.
          </p>
          <p>
            Both catalogues together know a fraction of what has been printed. Nothing here is a
            complete record of a book&rsquo;s editions, and it cannot become one: the covers you see
            are the ones somebody took the trouble to scan and upload.
          </p>
        </Section>

        <Section title="“Looks like this”">
          <p>
            Pick a cover and, now and then, a row of three appears under it: covers of{' '}
            <em>other</em> books whose jackets share its colours and its layout. Nothing is asked of
            anyone to work that out. Every cover of {INDEXED.works} books &mdash; {INDEXED.covers.toLocaleString('en')}{' '}
            of them &mdash; has been measured once and reduced to a handful of numbers: a hash of
            its light and dark, its colourfulness, and where its colours sit on the wheel. Those
            numbers live in a file that ships with the site. No image is stored, only measurements.
          </p>
          <p>
            The comparison is deliberately hard to pass, so most covers show no row at all. Setting
            it loosely made every cover match something, and the matches were nonsense. Two covers
            now have to agree on both colour and layout before either sees the other, which about
            one cover in nine manages.
          </p>
          <p>
            The measurements were taken on {INDEX_BUILT_AT}, and they cover those {INDEXED.works}{' '}
            books rather than the catalogue. So the row is a find when it appears, and its absence
            means only that nothing indexed resembles what you are looking at.
          </p>
        </Section>

        <Section title="What is missing, and why">
          <ul className="list-disc space-y-3 pl-5 marker:text-ink-3">
            <li>
              <strong className="font-medium text-ink">Editions without a scan.</strong> Most edition
              records carry no image at all. The counter under a book&rsquo;s title says how many
              records were checked and how many covers came out of them, so you can see the ratio for
              yourself.
            </li>
            <li>
              <strong className="font-medium text-ink">Editions without an ISBN.</strong> Anything
              printed before about 1970, and plenty of records since, has none. Shops cannot look
              those up, so the page offers searches by title, publisher and year, and a reverse image
              search on the cover itself.
            </li>
            <li>
              <strong className="font-medium text-ink">The same cover, scanned twice.</strong> One
              printing often exists as several records with several scans. Near-identical images are
              folded into one tile marked &ldquo;+2&rdquo;. The comparison is by image, and it errs
              towards showing you two tiles rather than hiding a cover that merely looked like
              another.
            </li>
            <li>
              <strong className="font-medium text-ink">Very long records.</strong> Editions load in
              pages while you look, and the scan stops at 1,500 records. Past that a work is usually
              an anthology or a bible, and the wall is long enough already.
            </li>
          </ul>
        </Section>

        <Section title="What the note under a buy link means">
          <p>
            Pick a cover and the buy links carry a short verdict. It compares the cover on your
            screen with the image the publisher has registered for that ISBN, and it says one of
            five things:
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
          <p>
            <strong className="font-medium text-ink">No shop is contacted for this.</strong> The only
            lookup is Google Books, and the evidence is the publisher&rsquo;s own image. A verdict is
            never a promise about what arrives in the post.
          </p>
        </Section>

        <Section title="Buy links, commission and counting">
          <p>
            Some links can earn a commission. The order of the shops is not sorted by what they pay,
            and no shop pays to appear.
          </p>
          <p>
            A click on a buy link passes through this site so it can be counted. Recorded are the
            shop, the market, the ISBN and the time &mdash; nothing about you. No cookie, no address,
            no identifier, nothing that could be traced back to a person.
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

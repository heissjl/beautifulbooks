import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';
import Versus from '@/components/Versus';
import { POOL, poolBooks, someBooks } from '@/lib/hotornot/game';
import { versusEnabled } from '@/lib/hotornot/switch';
import { SITE_URL } from '@/lib/seo';

/**
 * The cover game (ROADMAP 5.8a): two covers, one click. Behind a switch —
 * on in previews and on a laptop, off in production until it is switched on
 * (`lib/hotornot/switch.ts`).
 *
 * **Indexed since 2026-09-23** (Julian: „indiziere das spiel auch"), and that
 * is why the page carries more than the playing field. The pair itself comes
 * from the browser and is different at every visit, so for a crawler the game
 * alone was 325 characters and no book: below it stands what the game is,
 * how large the pool is and a spread of the books in it — all read from the
 * frozen pool (E18), so the page costs no request and reads the same twice.
 * Nothing here claims a cover is the best one; that sentence belongs to the
 * standings, which only say it once the crown has held (F7.5, N12).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Which cover?',
  description: 'Two covers, one click: which one would you rather look at? A game with the covers of a thousand printed editions.',
  alternates: { canonical: `${SITE_URL}/versus` },
  openGraph: {
    type: 'website',
    title: 'Which cover would you rather look at?',
    description: 'Two covers, one click. The standings show which covers readers keep choosing.',
    url: `${SITE_URL}/versus`,
  },
};

const SHOWN_BOOKS = 24;

export default function VersusPage() {
  if (!versusEnabled()) notFound();
  const books = poolBooks();
  const sample = someBooks(SHOWN_BOOKS);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        <Versus />

        <section className="mt-16 border-t border-line pt-8">
          <h2 className="text-2xl text-ink">What this is</h2>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-2">
            Two covers of two books, side by side, and one question: which one would you rather look at?
            The pool holds <b className="text-ink tabular-nums">{POOL.covers.length}</b> covers from{' '}
            <b className="text-ink tabular-nums">{books.length}</b> books, each of them a printed edition on
            record at Open Library or Google Books. Nobody is judging the writing here &mdash; only the
            picture on the front.
          </p>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-2">
            The <Link href="/versus/board" className="text-accent underline underline-offset-4">standings</Link>{' '}
            show which covers readers keep choosing and how sure that is: a cover is called the best-looking or
            the ugliest only once it has held the lead for several rounds. Every cover there leads to its book,
            where the other editions of the same title stand side by side.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl text-ink">Some of the books in the game</h2>
          <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2">
            {sample.map(book => (
              <li key={book.workId} className="min-w-0">
                <Link href={`/book/${book.workId}`} className="text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent">
                  {book.title}
                </Link>
                {book.author ? <span className="text-ink-3"> &middot; {book.author}</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-3">
            And {books.length - sample.length} more. <Link href="/" className="text-accent underline underline-offset-4">Search for any title</Link> to see its covers.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

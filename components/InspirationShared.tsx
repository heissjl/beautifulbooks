import Link from 'next/link';
import CoverImage from './CoverImage';
import InspirationShareTools from './InspirationShareTools';
import { coverUrlFor } from '@/lib/coverurl';
import type { DescribedBoard } from '@/lib/inspiration/describe';
import { shareTargets, shareText } from '@/lib/inspiration/share';
import { SITE_NAME } from '@/lib/seo';

/**
 * A finished board as others see it (ROADMAP 5.18b): the nine covers, each
 * leading to its book's page with that cover selected; the picture to save;
 * a share button per platform; the books as a list. Rendered on the server —
 * a crawler and a messenger's preview read the same page a reader does.
 *
 * `query` is the board's own query string; the poster and "Change this one"
 * are built from it, so the page works the same from a short link and from
 * the long address.
 *
 * English only for now, like the editor (ROADMAP 5.18b).
 */
export default function InspirationShared({ board, query, link }: { board: DescribedBoard; query: string; link: string }) {
  const title = board.by ? `The books that inspired ${board.by}` : 'The books that inspired me';
  const books = board.books.flatMap((b) => (b ? [b] : []));
  const poster = (format: 'story' | 'feed') => `/api/inspiration/poster?${query}&format=${format}`;
  const pillLink = 'rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent';
  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
      <div className="min-w-0">
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base text-ink-2">Nine books, in the editions they were read in. What inspired you?</p>

        <ul className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          {board.books.map((b, i) => {
            const src = b ? coverUrlFor(b.coverId, 'M') : null;
            const label = b ? [b.title, b.author].filter(Boolean).join(' by ') : '';
            return (
              <li key={i}>
                {b ? (
                  <Link href={b.href} title={label} className="cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 ease-out hover:-translate-y-1">
                    {src && <CoverImage src={src} alt={label} sizes="(max-width: 640px) 33vw, 180px" />}
                  </Link>
                ) : (
                  <span className="block aspect-[2/3] rounded-card bg-surface-2" />
                )}
              </li>
            );
          })}
        </ul>

        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-display text-2xl text-ink">Share the picture</h2>
          <p className="mt-1 text-sm text-ink-2">Instagram and stories take no link — the picture carries the address. Everywhere else the link goes with it.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={poster('story')} download="books-that-inspired-me-story.jpg" className="btn btn-accent">Save for a story</a>
            <a href={poster('feed')} download="books-that-inspired-me.jpg" className="btn">Save for a post</a>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {shareTargets(link, board.by).map((s) => (
              <a key={s.id} href={s.href} target="_blank" rel="noopener" className={pillLink}>{s.label}</a>
            ))}
          </div>
          <InspirationShareTools link={link} storyHref={poster('story')} text={shareText(board.by)} />
        </section>

        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-display text-2xl text-ink">Buy these books</h2>
          <p className="mt-1 text-sm text-ink-2">Each one opens with this cover selected: the shops that list the edition, and whether a new copy still looks like it.</p>
          <ol className="mt-3">
            {books.map((b, i) => (
              <li key={b.workId} className="border-b border-line">
                <Link href={b.href} className="flex gap-3 py-2 text-ink hover:text-accent">
                  <span className="w-5 shrink-0 text-ink-3 tabular-nums">{i + 1}</span>
                  <span className="min-w-0">
                    {b.title ?? 'A book whose title did not load'}
                    {b.author && <span className="text-sm text-ink-3"> — {b.author}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
          <Link href="/inspiration" className="btn btn-accent">Make your own</Link>
          <Link href={`/inspiration?${query}`} className="btn">Change this one</Link>
        </div>
      </div>

      {/* For someone who arrived from a picture and has never seen the site: three sentences, where a new reader looks (Julian's try, 2026-10-04). */}
      <aside className="max-w-md self-start border-l-2 border-line pl-5 text-[15px] leading-relaxed text-ink-2 lg:sticky lg:top-24">
        <h2 className="font-display text-xl text-ink">What is <i>{SITE_NAME}</i>?</h2>
        <p className="mt-2"><strong className="font-medium text-ink">A book has many covers.</strong> <i>{SITE_NAME}</i> shows the ones two open catalogues hold for a title — decades of printings side by side — and, for each, where to buy that edition.</p>
        <p className="mt-2">Pick a cover and the site says whether the publisher’s current image for the ISBN still matches it, so you know what arrives. It never promises a cover a shop does not show.</p>
        <p className="mt-2"><Link href="/" className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">Search a book</Link></p>
      </aside>
    </div>
  );
}

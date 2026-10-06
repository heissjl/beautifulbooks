import Link from './Link';
import CoverImage from './CoverImage';
import InspirationMine from './InspirationMine';
import InspirationToCollection from './InspirationToCollection';
import { BuyListDetails, CopyLink, PictureShare } from './InspirationShareTools';
import { coverUrlFor } from '@/lib/coverurl';
import { SIZE_WORD } from '@/lib/inspiration/board';
import { isHiddenCover } from '@/lib/hiddencovers';
import type { DescribedBoard } from '@/lib/inspiration/describe';
import { PICTURE_VERSION, shareTargets, shareText, titleOf } from '@/lib/inspiration/share';
import { SITE_NAME } from '@/lib/seo';

/**
 * A finished board as others see it (ROADMAP 5.18b): the covers, each leading
 * to its book's page with that cover selected; two ways to pass it on; where
 * to find the books; and, for someone who has never seen the site, what it is
 * and what else it has. Rendered on the server — a crawler and a messenger's
 * preview read the same page a reader does.
 *
 * `query` is the board's own query string; the pictures and "Change it" are
 * built from it, so the page works the same from a short link and from the
 * long address. The page has no owner to ask (N11), so what differs for the
 * one who just made the board goes through `InspirationMine`.
 *
 * English only for now, like the editor (ROADMAP 5.18b).
 */
export default function InspirationShared({ board, query, link, walls, versus }: { board: DescribedBoard; query: string; link: string; walls: boolean; versus: boolean }) {
  const title = titleOf(board.by);
  const books = board.books.flatMap((b) => (b ? [b] : []));
  const size = board.books.length === 3 ? 3 : board.books.length === 6 ? 6 : 9;
  const fresh = size === 9 ? '/shelfportrait' : `/shelfportrait?n=${size}`;
  const pill = 'rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent';
  const accentPill = 'rounded-full bg-accent px-4 py-1 text-sm text-on-accent transition-opacity hover:opacity-90';
  const more = 'text-accent underline decoration-line underline-offset-4 hover:decoration-accent';
  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
          </div>
          {/* At the top, where the collection page has "Edit collection": the way back into the board, or into one's own. */}
          <div className="flex flex-wrap gap-2">
            <InspirationMine
              query={query}
              maker={<Link href={`/shelfportrait?${query}`} className={accentPill}>Change it</Link>}
              visitor={
                <>
                  <Link href={`/shelfportrait?${query}`} className={pill}>Start from this one</Link>
                </>
              }
            />
          </div>
        </div>
        <p className="mt-3 text-base text-ink-2">{SIZE_WORD[size]} books, each with a favourite cover.</p>
        {/*
          The invitation, for the maker as for a visitor (Julian, 2026-10-05: not "What's yours?" behind
          the sentence but „Take your Shelf-Portrait" with a link under it to start a new one of one's own).
        */}
        <p className="mt-4 font-display text-xl text-ink">Take your Shelf-Portrait</p>
        <p className="mt-0.5 text-sm"><Link href={fresh} className={more}>Start a new one of your own</Link></p>

        <ul className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          {board.books.map((b, i) => {
            // A cover taken off the site on request (2.18k) leaves its place empty; the book stays in the list below.
            const src = b && !isHiddenCover(b.coverId) ? coverUrlFor(b.coverId, 'M') : null;
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

        {/*
          Two ways, named as what they are (Julian, 2026-10-05: „share as picture share as link?"). A
          button for X or WhatsApp can only hand over words and a link — the post shows the link as a
          card with the covers, drawn here so nobody has to guess. The picture itself has to be saved
          and attached, or handed to an app by the phone.
        */}
        {/*
          For the one who made the board, not for whoever follows its link (Julian, 2026-10-05): a
          visitor is asked to make their own, not to pass on someone else's.
        */}
        <InspirationMine
          query={query}
          visitor={null}
          maker={
    <section className="mt-10 border-t border-line pt-6">
              <h2 className="font-display text-2xl text-ink">Share it</h2>

              <h3 className="mt-4 text-lg text-ink">As a picture</h3>
              <p className="mt-1 text-sm text-ink-2">For Instagram, a story, a status — wherever a link does not travel. The picture carries the address.</p>
              <PictureShare query={query} link={link} text={shareText(board.by)} />

              <h3 className="mt-7 text-lg text-ink">As a link</h3>
              <p className="mt-1 text-sm text-ink-2">The post is one sentence and the link. The link shows as this card:</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- a picture this site draws itself, at the size it is shown; next/image would transform it again */}
              <img src={`/api/inspiration/poster?${query}&format=card&v=${PICTURE_VERSION}`} alt={`The link card: ${title}, with the covers`} width={1200} height={630} loading="lazy" className="mt-3 w-full max-w-sm rounded-card border border-line bg-surface-2" />
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {shareTargets(link, board.by).map((s) => (
                  <a key={s.id} href={s.href} target="_blank" rel="noopener" className={pill}>{s.label}</a>
                ))}
                <CopyLink link={link} />
              </div>
            </section>
          }
        />

        {/*
          Plainer than a collection's list. Open for the one who made the board, folded for whoever
          follows the link (Julian, 2026-10-05: „nur für die editoren ausgeklappt, nicht für andere
          besucher"): the maker is here to order, a visitor to look.
        */}
        <BuyListDetails query={query} className="group mt-10 border-t border-line pt-5">
          <summary className="cursor-pointer list-none text-base text-ink transition-colors hover:text-accent">
            <span className="mr-1.5 inline-block text-accent transition-transform group-open:rotate-90">▸</span>
            Are any of these missing from your library?{' '}
            <span className="text-ink-2"><InspirationMine query={query} maker="Order the editions you chose." visitor="Order these editions." /></span>
          </summary>
          <ol className="mt-3 divide-y divide-line">
            {books.map((b) => {
              const src = isHiddenCover(b.coverId) ? null : coverUrlFor(b.coverId, 'S');
              return (
                <li key={b.workId} className="flex items-center gap-3 py-2">
                  <span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">{src && <CoverImage src={src} alt="" sizes="32px" />}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {b.title ?? 'A book whose title did not load'}
                    {b.author && <span className="text-ink-3"> — {b.author}</span>}
                  </span>
                  {/*
                    In a new tab (Julian, 2026-10-05): the list is worked through book by book, and the portrait should
                    still be there after each. `noopener` only, not `noreferrer` — the book page reads the referrer to
                    class this visit as coming from a Shelf-Portrait (K9).
                  */}
                  <Link href={b.href} target="_blank" rel="noopener" className={`shrink-0 whitespace-nowrap text-xs ${more}`}>Where to find it</Link>
                </li>
              );
            })}
          </ol>
        </BuyListDetails>

        {/* The way on from a board: the same covers as a collection one keeps, adds to and arranges (5.13a). */}
        {walls && <InspirationToCollection title={title} books={books.flatMap((b) => (b.title ? [{ workId: b.workId, coverId: b.coverId, title: b.title, author: b.author }] : []))} />}

        <InspirationMine
          query={query}
          maker={null}
          visitor={
            <div className="mt-10 border-t border-line pt-6">
              <Link href={fresh} className="btn btn-accent">Take your Shelf-Portrait</Link>
            </div>
          }
        />
      </div>

      {/* For someone who arrived from a picture and has never seen the site: what it is, and what else is here. */}
      <aside className="max-w-md self-start border-l-2 border-line pl-5 text-[15px] leading-relaxed text-ink-2 lg:sticky lg:top-24">
        <h2 className="font-display text-xl text-ink">What is <i>{SITE_NAME}</i>?</h2>
        <p className="mt-2">
          <strong className="font-medium text-ink">A book has many covers.</strong> <i>{SITE_NAME}</i> shows the ones two open catalogues hold for a title — decades of printings side by side — and, for each, where to find and buy that edition new or used, online or locally.
        </p>
        <ul className="mt-4 space-y-2">
          <li><Link href="/" className={more}>Look up the covers of a book</Link></li>
          {walls && <li><Link href="/create" className={more}>Gather covers you love into a collection of your own</Link></li>}
          {versus && <li><Link href="/versus" className={more}>Play the cover game: which one would you rather look at?</Link></li>}
        </ul>
      </aside>
    </div>
  );
}

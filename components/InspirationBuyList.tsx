'use client';

import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import Link from './Link';
import LocalShops from './LocalShops';
import MarketSwitcher from './MarketSwitcher';
import { useMarket } from './useMarket';
import { buyLinksFor, isWordsProvider, searchLinksFor, trackedBuyHref, trackedSearchHref, type WordsQuery } from '@/lib/buylinks';
import { coverUrlFor } from '@/lib/coverurl';
import { isHiddenCover } from '@/lib/hiddencovers';
import { hyphenateIsbn } from '@/lib/isbnformat';
import type { WorkCovers } from '@/lib/inspiration/covers';
import { linkPlan } from '@/lib/linkplan';
import type { Market } from '@/lib/market';
import type { BuyLink } from '@/lib/model';

/**
 * **A local trial, shown under `next dev` only** (ROADMAP 5.18b; Julian,
 * 2026-10-05: „try locally what it would look like if we were to do it like
 * with step 2 of the framing funnel"). The buy list of a Shelf-Portrait as
 * step 2 of the collection funnel does it (5.13f, `WallPlan` on the branch
 * `claude/art-funnel-lab`, never merged): a tick per book, "Find it" opens
 * the shops in the row instead of leading to the book page, "Open next shop"
 * walks down the list, "Copy list" hands it over as text.
 *
 * What differs from step 2, and why:
 * - A collection keeps the printings of each cover; a board keeps only the
 *   picture. So the printing (publisher, year, an ISBN) is **looked up when
 *   it is needed** — for the book whose row is opened and for the next one
 *   to buy — through `/api/inspiration/covers/<work>`, never for the whole
 *   list on arrival: nine books would be up to 36 catalogue requests for a
 *   page most visitors only look at.
 * - The ticks live in this component and are gone after a reload. Step 2
 *   kept them in `localStorage`; here that would be the first thing this
 *   page stores on a reader's device, and the privacy notice says it stores
 *   nothing — Julian's to decide before this leaves the laptop.
 * - The market is the reader's own choice or a guess from the browser's
 *   language; the book page has the server's guess from the request.
 *
 * Every shop link goes through `/go/` where the site can rebuild it
 * (`trackedBuyHref`, `trackedSearchHref`), as on the book page, so a click
 * here would be counted like a click there.
 */

export interface BuyBook {
  workId: string;
  coverId: string;
  title: string;
  author: string | null;
  /** The book's page with this cover selected: where the verdict is. */
  href: string;
}

type Printing =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'done'; publisher?: string; year?: number; isbn13?: string; found: boolean };

function guessMarket(): Market {
  const lang = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  if (lang.startsWith('de')) return 'de';
  return lang === 'en-gb' || lang === 'en-ie' ? 'uk' : 'us';
}

/** The shops for one book as the book page orders them (`linkPlan`), and the address each one opens. */
function shopsFor(book: BuyBook, printing: Printing | undefined, market: Market) {
  const p = printing?.state === 'done' ? printing : undefined;
  const isbn13 = p?.isbn13;
  const words: WordsQuery = { title: book.title, ...(book.author ? { author: book.author } : {}), ...(p?.publisher ? { publisher: p.publisher } : {}), ...(p?.year ? { year: p.year } : {}) };
  const buyLinks = isbn13 ? buyLinksFor({ isbn13 }, market) : [];
  const byIsbn = new Set(buyLinks.map((l) => l.provider));
  const plan = linkPlan({
    edition: { isbn13 },
    buyLinks,
    searchLinks: searchLinksFor({ ...words, coverUrl: coverUrlFor(book.coverId, 'L') ?? undefined, isbn13 }, market),
    market,
  });
  const href = (link: BuyLink) =>
    isbn13 && byIsbn.has(link.provider) ? trackedBuyHref(link.provider, isbn13, market) : isWordsProvider(link.provider) ? trackedSearchHref(link.provider, words, market) : link.url;
  return { plan, isbn13, href };
}

export default function InspirationBuyList({ books }: { books: BuyBook[] }) {
  const [chosenMarket, setMarket] = useMarket();
  const market = chosenMarket ?? guessMarket();
  const [open, setOpen] = useState<string | null>(null);
  const [bought, setBought] = useState<ReadonlySet<string>>(new Set());
  const [printings, setPrintings] = useState<Record<string, Printing>>({});
  const [note, setNote] = useState('');

  const next = books.find((b) => !bought.has(b.workId));
  const wanted = [next?.workId, open].filter((id): id is string => !!id && !printings[id]);
  const wantedKey = wanted.join(',');

  // The printing of the book that is needed now: the next to buy, and the one whose row is open.
  useEffect(() => {
    for (const workId of wantedKey ? wantedKey.split(',') : []) {
      const book = books.find((b) => b.workId === workId);
      if (!book) continue;
      Promise.resolve().then(() => setPrintings((p) => (p[workId] ? p : { ...p, [workId]: { state: 'loading' } })));
      fetch(`/api/inspiration/covers/${workId}`)
        .then((r) => (r.ok ? (r.json() as Promise<WorkCovers>) : Promise.reject(new Error(String(r.status)))))
        .then((data) => {
          const cover = data.covers.find((c) => c.coverId === book.coverId);
          setPrintings((p) => ({ ...p, [workId]: { state: 'done', found: !!cover, ...(cover?.publisher ? { publisher: cover.publisher } : {}), ...(cover?.year ? { year: cover.year } : {}), ...(cover?.isbn13 ? { isbn13: cover.isbn13 } : {}) } }));
        })
        // A catalogue that did not answer is not "no printing" (N12): the row says so, and the searches by title still work.
        .catch(() => setPrintings((p) => ({ ...p, [workId]: { state: 'failed' } })));
    }
  }, [wantedKey, books]);

  const toggle = (workId: string) =>
    setBought((prev) => {
      const out = new Set(prev);
      if (out.has(workId)) out.delete(workId);
      else out.add(workId);
      return out;
    });

  const nextShop = next
    ? (() => {
        const { plan, href } = shopsFor(next, printings[next.workId], market);
        const link = plan.lead[0] ?? plan.rest[0];
        return link ? { label: link.label, href: href(link) } : null;
      })()
    : null;
  // The first shop is only right once the printing is known: with an ISBN it is another shop than without.
  const nextReady = !!next && printings[next.workId] && printings[next.workId].state !== 'loading';

  const copyList = () => {
    const lines = books.map((b, i) => {
      const p = printings[b.workId];
      const facts = p?.state === 'done' ? [p.publisher, p.year, p.isbn13 ? `ISBN ${p.isbn13}` : ''].filter(Boolean).join(', ') : '';
      return `${bought.has(b.workId) ? '[x]' : '[ ]'} ${i + 1}. ${b.title}${b.author ? ` — ${b.author}` : ''}${facts ? ` (${facts})` : ''}\n    ${window.location.origin}${b.href}`;
    });
    navigator.clipboard.writeText(lines.join('\n')).then(
      () => setNote('List copied.'),
      () => setNote('Copying did not work here.'),
    );
  };

  const count = books.filter((b) => bought.has(b.workId)).length;
  return (
    <section className="mt-10 rounded-md border border-dashed border-accent/60 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-accent">Local only — the list as step 2 of the framing funnel does it</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base text-ink">
          Get the books <span className="text-ink-3">· {count} of {books.length} bought</span>
        </h2>
        <MarketSwitcher market={market} onChange={setMarket} compact />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {next && nextShop && nextReady ? (
          <a
            href={nextShop.href}
            target="_blank"
            rel="noopener"
            onClick={() => setNote(`Opened ${nextShop.label} for ${next.title}. Tick it once you have it.`)}
            className="rounded-full bg-ink px-3 py-1 text-bg transition-colors hover:bg-accent"
          >
            Open next shop
          </a>
        ) : (
          <button type="button" disabled className="rounded-full bg-ink px-3 py-1 text-bg opacity-40">
            {next ? 'Looking up the next book…' : 'All bought'}
          </button>
        )}
        <button type="button" onClick={copyList} className="rounded-full border border-line bg-surface px-3 py-1 text-ink-2 hover:border-accent hover:text-accent">
          Copy list
        </button>
      </div>
      <p className="mt-2 min-h-4 text-xs text-ink-2" role="status">{note}</p>
      <p className="mt-1 max-w-2xl text-xs text-ink-3">
        An ISBN names a printing, not its picture: the same number has carried other covers. Whether a shop shows this very cover today is checked on the book’s page.
      </p>
      <ol className="mt-3 divide-y divide-line">
        {books.map((b) => {
          const src = isHiddenCover(b.coverId) ? null : coverUrlFor(b.coverId, 'S');
          const p = printings[b.workId];
          const done = bought.has(b.workId);
          const isOpen = open === b.workId;
          return (
            <li key={b.workId} className="py-2">
              <div className={`flex items-center gap-3 ${done ? 'opacity-60' : ''}`}>
                <input type="checkbox" checked={done} onChange={() => toggle(b.workId)} aria-label={`Bought ${b.title}`} title="Bought" className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
                <span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">{src && <CoverImage src={src} alt="" sizes="32px" />}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm text-ink ${done ? 'line-through decoration-ink-3' : ''}`}>
                    {b.title}
                    {b.author && <span className="text-ink-3"> — {b.author}</span>}
                  </span>
                  {/* Empty until the row was opened or its turn came: nothing was asked, so nothing is claimed. */}
                  <span className="block min-h-4 truncate text-xs text-ink-3">
                    {!p ? '' : p.state === 'loading' ? 'Looking up the printing…'
                      : p.state === 'failed' ? 'The catalogue did not answer — searching by title'
                      : !p.found ? 'This cover’s printing is beyond the editions looked at — searching by title'
                      : [p.publisher, p.year].filter(Boolean).join(' ') || 'Printing on record, without publisher or year'}
                    {p?.state === 'done' && p.isbn13 && ` · ISBN ${hyphenateIsbn(p.isbn13)}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : b.workId)}
                  aria-expanded={isOpen}
                  aria-controls={`find-${b.workId}`}
                  className="shrink-0 whitespace-nowrap text-xs text-accent underline decoration-line underline-offset-4 hover:decoration-accent"
                >
                  {isOpen ? 'Close' : 'Find it'}
                </button>
              </div>
              {isOpen && <FindIt id={`find-${b.workId}`} book={b} printing={p} market={market} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function FindIt({ id, book, printing, market }: { id: string; book: BuyBook; printing: Printing | undefined; market: Market }) {
  if (!printing || printing.state === 'loading') return <p id={id} className="mb-2 ml-[4.75rem] mt-3 text-xs text-ink-2" role="status">Looking up the printing…</p>;
  const { plan, isbn13, href } = shopsFor(book, printing, market);
  const shop = (link: BuyLink) => (
    <a key={link.provider} href={href(link)} target="_blank" rel="noopener noreferrer" className="btn">
      {link.label}
    </a>
  );
  return (
    <div id={id} className="mb-2 mt-3 sm:ml-[4.75rem]">
      {plan.note && <p className="mb-2 max-w-xl text-xs text-ink-3">{plan.note}</p>}
      <div className="flex flex-wrap gap-2">{plan.lead.map(shop)}</div>
      {plan.rest.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-ink-2 hover:text-accent">More places to look</summary>
          <div className="mt-2 flex flex-wrap gap-2">{plan.rest.map(shop)}</div>
        </details>
      )}
      {/* A local bookshop that can order it (5.12), as under the shops of a book page. */}
      <LocalShops edition={{ isbn13, title: book.title, author: book.author ?? undefined }} market={market} />
      <p className="mt-3 text-xs text-ink-3">
        <Link href={book.href} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-accent">
          Check on the book’s page whether shops show this cover
        </Link>
      </p>
    </div>
  );
}

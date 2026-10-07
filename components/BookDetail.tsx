'use client';

import { createContext, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/Link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import CoverGallery from '@/components/CoverGallery';
import DecadeLink from '@/components/DecadeLink';
import AvailabilityCheck, { SHOP_STATUS_LABEL, SHOP_STATUS_TITLE } from '@/components/AvailabilityCheck';
import CoverImage from '@/components/CoverImage';
import CoverSheet from '@/components/CoverSheet';
import AuthorWorks from '@/components/AuthorWorks';
import WorkPanel from '@/components/WorkPanel';
import ShareMenu from '@/components/ShareMenu';
import LoadingStage from '@/components/LoadingStage';
import MarketSwitcher from '@/components/MarketSwitcher';
import MoreBelow from '@/components/MoreBelow';
import { useOverflowsY } from '@/components/useOverflowsY';
import LocalShops from '@/components/LocalShops';
import SiteFooterView from '@/components/SiteFooterView';
import AddToWall from '@/components/AddToWall';
import EditingBand from '@/components/EditingBand';
import { useCameFrom } from '@/components/cameFrom';
import SiteHeader from '@/components/SiteHeader';
import HeaderSearch from '@/components/HeaderSearch';
import { flyCovers } from '@/components/flyCovers';
import { SCENE_FIRST_ROW, useLoadingScene } from '@/components/useLoadingScene';
import { useIsDesktop } from '@/components/useIsDesktop';
import { useMarket } from '@/components/useMarket';
import { useIsbnCovers } from '@/components/useIsbnCovers';
import { useWorkPages } from '@/components/useWorkPages';
import { useSimilarCovers } from '@/components/useSimilarCovers';
import { useWorkPreview } from '@/components/useWorkPreview';
import { buildWall, captionFor, progressLabel } from '@/components/workWall';
import { leadCover } from '@/lib/scene';
import { isbnRuns } from '@/lib/isbnformat';
import { useOverflowsX } from '@/components/useOverflowsX';
import { useBookSignal, useReportVerdict, VerdictReport } from './useInsights';
import { buyLinksIn, commissionNote, isWordsProvider, searchFacts, searchLinksFor, titleSearchLinksIn, trackedBuyHref, trackedSearchHref, type WordsQuery } from '@/lib/buylinks';
import { linkPlan, orderEditionsForMarket } from '@/lib/linkplan';
import { coverIdFromSegment, coverUrlFor } from '@/lib/coverurl';
import decadePages from '@/data/decade-pages.json';
import { VERDICT_LEAD } from '@/lib/verdicts';
import { availabilityEnabled, commerceEnabled } from '@/lib/sitemode';
import type { ShopStatus } from '@/lib/availability';
import type { Market } from '@/lib/market';
import type { Translate } from '@/lib/i18n/translate';
import type { BuyLink, Cover, EditionView } from '@/lib/model';
import { displayTitle, languageName, normalizeTitle } from '@/lib/normalize';
import { coverForId, leadLanguagesSettled } from '@/lib/pages';
import { groupByDecade, worthAPage } from '@/lib/decades';
import { shapeOf } from '@/lib/queryshape';
import { verifyIsbnCover, type IsbnVerdict } from '@/lib/works';
import { useLocale, useT } from '@/components/i18n';

/*
  It said "Search" until 2026-09-10, which stopped working the moment a search
  field moved into the header beside it (ROADMAP 6.28): two controls, one
  word, different things — this one goes back to the result list you came
  from with your query intact, the field starts over. So it says what it does,
  and it says something different when there is no result list to go back to.

  What decides that is the **query**, not the address: `?lang=de` alone also
  makes an address other than `/`, and it leads to the home page with a filter
  rather than to results (caught on the dev server, 2026-09-10).
*/
function BackLink({ href, toResults, wall }: { href: string; toResults: boolean; wall?: string }) {
  const t = useT();
  return (
    <Link
      href={href}
      title={wall ? t('Back to {wall}', { wall }) : undefined}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-md py-1 pr-2 text-sm text-ink-2 transition-colors hover:text-ink"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {/* The wall one came from, by name (Julian, 2026-10-03); cut short, the header has a logo and a search beside it. */}
      {wall ? <span className="max-w-[9rem] truncate sm:max-w-[16rem]">{wall}</span> : toResults ? t('Results') : t('Home')}
    </Link>
  );
}

/**
 * Whether readers' walls are on (ROADMAP 5.13a), decided on the server and
 * handed down: this component renders in the browser, where the switch cannot
 * read its variables.
 */
const WallsOn = createContext(false);

function Shell({ children, backHref, toResults, right, workId }: { children: React.ReactNode; backHref: string; toResults: boolean; right?: React.ReactNode; workId?: string }) {
  const walls = useContext(WallsOn);
  // A result list one came from wins: it is in the address. Otherwise the wall whose tile opened this book, if any.
  const from = useCameFrom(workId);
  const wall = !toResults && from ? from : null;
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader left={<BackLink href={wall ? wall.href : backHref} toResults={toResults} wall={wall?.title} />} right={right} search={<HeaderSearch />} />
      {walls && <EditingBand />}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-8 sm:px-6 lg:px-8">{children}</main>
      <SiteFooterView walls={walls} />
    </div>
  );
}

/**
 * The page when the catalogue did not answer (ROADMAP 6.75, N12).
 *
 * It used to print the server's own sentence ("Book data source unavailable,
 * try again shortly") over a single "Back to search" — a dead end for anyone
 * who came from a link or a search engine, with no result list to go back
 * to. The first page is already asked twice before this shows
 * (`useWorkPages`), so "Try again" starts the whole walk once more. The
 * wording names the source that was silent and says that this is no
 * statement about the book.
 */
function LoadFailed({ httpStatus, onRetry, backHref, toResults }: {
  httpStatus?: number;
  onRetry: () => void;
  backHref: string;
  toResults: boolean;
}) {
  const t = useT();
  const busy = httpStatus === 429;
  return (
    <div className="py-24 text-center">
      <p className="font-display text-2xl text-ink">{busy ? t('Too many requests at once') : t('Open Library did not answer')}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
        {busy
          ? t('Give it a few seconds, then try again.')
          : t('The catalogue this page is built from is slow or down at the moment. That says nothing about the book.')}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
        <button type="button" onClick={onRetry} className="btn btn-accent">{t('Try again')}</button>
        <Link href={backHref} className="text-sm text-accent hover:underline">
          {toResults ? t('Back to the results') : t('Search for another book')}
        </Link>
      </div>
    </div>
  );
}

function TitleBlock({ title, authors, meta }: { title?: string; authors?: string[]; meta?: string }) {
  if (!title) {
    return (
      <div className="mb-8 max-w-3xl animate-pulse" aria-hidden="true">
        <div className="h-10 w-1/2 rounded bg-surface-2"></div>
        <div className="mt-3 h-5 w-1/4 rounded bg-surface-2"></div>
      </div>
    );
  }
  return (
    <div className="mb-8 max-w-3xl">
      <h1 className="text-4xl leading-[1.05] text-ink sm:text-5xl">{title}</h1>
      {authors && authors.length > 0 && <p className="mt-3 text-lg text-ink-2">{authors.join(', ')}</p>}
      <p className="mt-1 min-h-5 text-sm text-ink-3">{meta ?? ''}</p>
    </div>
  );
}




/** Back to the search the user came from (SPEC F2.7). */
function backHrefFrom(searchParams: URLSearchParams): string {
  const params = new URLSearchParams();
  const q = searchParams.get('q');
  const lang = searchParams.get('lang');
  // The author mode (ROADMAP 6.60) comes back as the author mode.
  const author = searchParams.get('author');
  const key = searchParams.get('key');
  if (author || key) {
    if (author) params.set('author', author);
    if (key) params.set('key', key);
    const qs = params.toString();
    return `/?${qs}`;
  }
  if (q) params.set('q', q);
  if (lang) params.set('lang', lang);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

function BookDetail() {
  const t = useT();
  const wallsOn = useContext(WallsOn);
  const params = useParams<{ id: string; coverId?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') ?? '';
  const backHref = backHrefFrom(searchParams);
  // A query means there is a result list behind the back link; a bare `?lang=`
  // does not (ROADMAP 6.28).
  const cameFromResults = !!searchParams.get('q') || !!searchParams.get('author') || !!searchParams.get('key');
  const preview = useWorkPreview(params.id);

  // Market for buy links (E9): the user's choice, else detected by the server.
  const [chosenMarket, setMarket] = useMarket();
  // Sidebar or bottom sheet; the two are exclusive so the cover image is
  // fetched once (SPEC §10 E13).
  const isDesktop = useIsDesktop();
  // The sidebar scrolls on its own; say so while there is more below (1 + 2, Julian 2026-09-26).
  const { scroller: sideScroller, content: sideContent, overflows: sideOverflows, atEnd: sideAtEnd, hiddenBelow: sideHidden, onScroll: measureSide, scrollMore: sideMore } = useOverflowsY();
  /*
    Not the market: a switch of the market rebuilds the shop links below and nothing else (Julian,
    2026-10-06: „wenn man den markt in der detailansicht eines covers umstellt, wird die ganze seite
    neugeladen"). With the market in this key every page of the wall, the loading scene and the ISBN
    lookups — Google's quota among them — started again.
  */
  const requestKey = `${params.id} ${lang}`;

  // Editions arrive page by page and keep arriving while the user looks
  // around (SPEC §9.3 step 11).
  const pages = useWorkPages(params.id, lang);
  // The reader's choice, else the market the server detected with the first page.
  const market = chosenMarket ?? pages.market;

  // The selected cover lives in the URL (?cover=) so it can be shared (SPEC F2.6).
  /*
    A share address carries the cover in the path (`/book/<id>/cover/<cover>`,
    ROADMAP 6.20) so that its preview can show it; inside the page the query
    stays the source of truth, and picking another cover goes back to it.

    **The path is a starting point, never the answer** (ROADMAP 6.48): it says
    which cover the link was about, and `?cover=` says which one the reader
    has picked since. Reading the path first froze the wall — every shared
    link, and every cover opened from the game, showed one cover and ignored
    every click after that, because `selectCover` writes the query while the
    path kept winning.
  */
  const routeCover = coverIdFromSegment(typeof params.coverId === 'string' ? params.coverId : undefined);

  const editionIdsByIsbn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of pages.merged?.editions ?? []) {
      if (!e.isbn13) continue;
      const list = map.get(e.isbn13) ?? [];
      list.push(e.id);
      map.set(e.isbn13, list);
    }
    return map;
  }, [pages.merged]);

  /*
    An ISBN in the address names one edition, so its cover is what the reader
    came for (ROADMAP 6.29, measured in docs/suche-isbn-und-stichwort.md).
    Until now the number reached this page as `q` and nobody read it: a search
    for 9780451524935 landed on 224 covers with none of them marked.

    Read off the merged pages rather than the wall, which is built further
    down — folding does not lose the link, because `coverForId` resolves a
    folded id to the tile it was folded into.

    Only a fallback: an explicit `?cover=` always wins, so picking another
    cover afterwards is not overruled on the next render. And when the edition
    is not among those loaded — beyond the scan cap, or without a cover — this
    stays null and the wall opens unmarked, which is the truth rather than a
    guess (N12).
  */
  const isbnWanted = useMemo(() => {
    const raw = searchParams.get('isbn');
    if (!raw) return null;
    const shape = shapeOf(raw);
    return shape.kind === 'isbn' ? shape.isbn13 : null;
  }, [searchParams]);

  const coverForIsbn = useMemo(() => {
    if (!isbnWanted || !pages.merged) return null;
    const wanted = new Set(editionIdsByIsbn.get(isbnWanted) ?? []);
    if (wanted.size === 0) return null;
    return pages.merged.covers.find(c => c.editionIds.some(id => wanted.has(id)))?.id ?? null;
  }, [isbnWanted, pages.merged, editionIdsByIsbn]);

  const selectedId = searchParams.get('cover') ?? routeCover ?? coverForIsbn;
  // The cover the page was opened with leads its fold group (a collection tile,
  // a shared link). Only that one: a later click picks among the tiles already
  // there, so the wall is not folded again on every selection.
  const [openedWith] = useState<string | null>(() => searchParams.get('cover') ?? routeCover);

  // Which ISBN to ask about is decided on the catalogue alone. Retail covers
  // never change *which edition* is being looked at, and deriving the
  // question from an answer that depends on it would chase its own tail.
  const lookupIsbns = useMemo(() => {
    if (!pages.merged) return [];
    const wall = buildWall(pages.merged, [], new Map(), lang || undefined, openedWith);
    const cover = coverForId(wall, selectedId);
    if (!cover) return [];
    const byId = new Map(pages.merged.editions.map(e => [e.id, e]));
    return cover.editionIds.map(id => byId.get(id)?.isbn13).filter((i): i is string => !!i);
  }, [pages.merged, lang, selectedId, openedWith]);

  // What a shop shows for that ISBN, asked on selection rather than while the
  // work loads: 7-11 Google requests per page view become 2 (SPEC §9.3 13a).
  const isbnCovers = useIsbnCovers(requestKey, lookupIsbns, editionIdsByIsbn);
  const selectCover = (coverId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('cover', coverId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  // Loading scene (SPEC 8.1): paced by the hook; runs at least two covers long
  // and ends once page 0 has been hashed, so it never shows a cover twice.
  const view = useMemo(() => {
    const { merged, work } = pages;
    if (!merged || !work || !pages.market) return null;
    const wall = buildWall(merged, isbnCovers.covers, isbnCovers.signatures, lang || undefined, openedWith);
    const editionsById = new Map(merged.editions.map(e => [e.id, e]));
    const captions = new Map(wall.covers.map(c => [c.id, captionFor(c, editionsById)]));
    // How many covers each edition appears with (to flag reprints, SPEC F2.5).
    const coversPerEdition = new Map<string, number>();
    for (const c of wall.covers) for (const id of c.editionIds) coversPerEdition.set(id, (coversPerEdition.get(id) ?? 0) + 1);
    return { work, merged, ...wall, editionsById, captions, coversPerEdition };
  }, [pages, lang, isbnCovers, openedWith]);

  // The shop links for the market in force, built here from `earning` (lib/buylinks.ts, buyLinksIn): a switch costs no request.
  const shopped = useMemo(() => {
    if (!view || !market) return null;
    const earning = pages.earning?.[market] ?? [];
    const editionsById = new Map([...view.editionsById].map(([id, e]) => [id, { ...e, buyLinks: buyLinksIn(e, market, earning) }]));
    const anyEditionLinks = titleSearchLinksIn({ title: displayTitle(view.work.title), author: view.work.authors[0] }, market, earning);
    return { market, editionsById, anyEditionLinks };
  }, [view, market, pages.earning]);

  /*
    The scene opens with the cover the reader is already looking at, and hands
    over only once the wall's first row has arrived (ROADMAP 6.25a).

    `lead` is the card's cover as it is on the screen — its id and the address
    already painted — so the fan begins with that picture instead of replacing
    it with another (Julian, 2026-09-10: „so hat der Fächer irgendwie einen
    Ladebildschirm vorm Ladebildschirm"). `wallFirst` is what the wall will
    show first, in its own order, which is not page 0's order: the wall is
    sorted by language. The view is built before the scene for that reason.
  */
  const lead = useMemo(() => leadCover(preview?.coverUrls[0]), [preview]);
  const wallFirst = useMemo(() => view?.groups[0]?.covers.slice(0, SCENE_FIRST_ROW) ?? [], [view]);
  const scene = useLoadingScene(requestKey, pages.firstCovers, pages.page0Hashed, { lead, wallFirst });



  // Hold the scene until the pinned tabs can no longer appear underneath the
  // reader's cursor: the searched language (else English) present, everything
  // loaded, or three pages in, whichever comes first (Julian 2026-09-07).
  const tabsSettled =
    !view || leadLanguagesSettled(view.groups, view.merged.done || view.merged.checked >= 300, lang || undefined);
  const inScene = pages.status === 'loading' || (pages.status === 'ready' && (!scene.done || !tabsSettled));

  // When the scene ends, fly the staged covers to their gallery tiles.
  const flownFor = useRef('');
  useEffect(() => {
    if (inScene || !view || scene.staged.length === 0 || flownFor.current === requestKey) return;
    flownFor.current = requestKey;
    const raf = requestAnimationFrame(() => flyCovers(scene.staged));
    return () => cancelAnimationFrame(raf);
  }, [inScene, view, scene.staged, requestKey]);

  const selected = useMemo<Cover | null>(() => (view ? coverForId(view, selectedId) : null), [view, selectedId]);
  // One summary of this visit when the reader leaves (ROADMAP 3.1b); nothing is kept on the device.
  const reportVerdict = useBookSignal({ workId: params.id, market: market ?? 'us', pagesLoaded: pages.pagesLoaded, picked: !!selected });


  if (pages.status === 'notfound' || pages.status === 'error') {
    return (
      <Shell workId={params.id} backHref={backHref} toResults={cameFromResults}>
        {pages.status === 'notfound' ? (
          <div className="py-24 text-center">
            <p className="font-display text-2xl text-ink">{t('Book not found')}</p>
            <Link href={backHref} className="mt-4 inline-block text-sm text-accent hover:underline">{t('Back to search')}</Link>
          </div>
        ) : (
          <LoadFailed httpStatus={pages.httpStatus} onRetry={pages.retry} backHref={backHref} toResults={cameFromResults} />
        )}
      </Shell>
    );
  }

  if (inScene || !view) {
    const work = view?.work;
    return (
      <Shell workId={params.id} backHref={backHref} toResults={cameFromResults}>
        <TitleBlock
          title={work?.title ?? preview?.title}
          authors={work?.authors ?? preview?.authors}
          meta={work?.editionCount ? t('{n} editions', { n: work.editionCount }) : undefined}
        />
        <LoadingStage
          covers={scene.presented}
          hero={preview?.coverUrls[0]}
          expected={view?.covers.length}
        />
      </Shell>
    );
  }

  const { work, merged } = view;
  // One instance, placed either in the sidebar or in the sheet.
  const details = selected && (
    <CoverDetails
      cover={selected}
      editions={selected.editionIds.map(id => (shopped ?? view).editionsById.get(id)).filter((e): e is EditionView => !!e)}
      coversPerEdition={view.coversPerEdition}
      workId={work.id}
      workTitle={work.title}
      anyEditionLinks={shopped?.anyEditionLinks ?? pages.anyEditionLinks}
      editionsByScan={view.editionsByScan}
      author={work.authors[0]}
      query={searchParams.get('q') ?? ''}
      market={shopped?.market ?? pages.market ?? 'us'}
      onMarketChange={setMarket}
      share={<ShareMenu workId={work.id} coverId={selected.id} title={work.title} author={work.authors[0]} />}
      verdictFor={isbn13 => verifyIsbnCover(
        selected,
        isbnCovers.byIsbn.get(isbn13) ?? [],
        view.covers,
        isbnCovers.asked.has(isbn13),
        isbnCovers.unavailable.has(isbn13),
        view.signatures,
        isbnCovers.catalogue.has(isbn13),
      )}
    />
  );
  /*
    The year is quoted, not asserted. Open Library dates The Great Gatsby to
    1920; it was published in 1925. The field is a stray record often enough
    that stating it as fact breaks the rule in SPEC §4 N12, and there is no
    second source here to check it against — the wall loads newest-record
    first, so the earliest edition on screen is not the earliest edition. So
    the line names who says it and leaves the reader to weigh that.
  */
  /*
    The link shows wherever a decade page is possible, not only where the
    pre-measured list happens to know one (Julian, 2026-09-09: „der link soll
    natürlich immer gezeigt werden, wenn eine decade wall möglich ist").

    Two sources, and they answer different halves of the problem:

    - `data/decade-pages.json` answers **at once**, before a single cover has
      arrived, for the works measured before the deploy.
    - Everything else is decided **here**, from what the browser already
      holds. It has loaded every page of the work and folded every cover, so
      it can apply the page's own threshold with the page's own function
      (`lib/decades.ts` is pure and has no I/O). No request, and no second
      rule that could drift from the first.

    Only once the walk is **done**: a partial wall would clear the threshold
    early on a work that ends up below it, and offer a link into a 404 — the
    one thing this must not do (R6).
  */
  const decadesPossible = merged.done && worthAPage(groupByDecade(view.covers, merged.editions));
  const hasDecades = decadesPossible || decadePages.pages.some(p => p.id === work.id);
  const meta = [
    `${progressLabel(view.covers.length, merged, t)}.`,
    work.firstPublishYear ? t('Open Library dates the book to {year}.', { year: String(work.firstPublishYear) }) : undefined,
  ].filter(Boolean).join(' ');

  return (
    <VerdictReport.Provider value={reportVerdict}>
    <Shell
      workId={params.id}
      backHref={backHref}
      toResults={cameFromResults}
      /*
        With a cover picked, sharing lives beside it — in the sidebar on a wide
        screen, in the phone bar next to "Details". Without one there is
        nothing beside, so the header keeps the button for the book itself.
      */
      right={selected ? undefined : <ShareMenu workId={work.id} title={work.title} author={work.authors[0]} />}
    >
      <TitleBlock title={work.title} authors={work.authors} meta={meta} />
      <ScanProgress checked={merged.checked} total={merged.total} done={merged.done} />

      {view.groups.length === 0 ? (
        <p className="text-ink-2">{t('Neither catalogue has a cover for this book.')}</p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
          <div className="min-w-0 lg:col-span-2">
            <CoverGallery
              groups={view.groups}
              allCovers={view.all}
              selectedCover={selected}
              onSelectCover={c => selectCover(c.id)}
              captions={view.captions}
              belowTabs={hasDecades ? <DecadeLink workId={work.id} /> : undefined}
            />
            <p className="mt-6 max-w-prose text-xs leading-relaxed text-ink-3">
              {t('Covers come from Open Library and Google Books. Most edition records carry no scan, so a book has had covers neither catalogue knows.')}
            </p>
          </div>
          {/*
            The sidebar is taller than the viewport, so a plain sticky block
            pins its top and leaves the buy links below the fold until the
            reader has scrolled past the whole wall (Julian, 2026-09-07).
            Giving it its own scroll area makes the links reachable at once;
            the wheel scrolls the sidebar first and then the page.
          */}
          {isDesktop && (
            <aside ref={sideScroller} onScroll={measureSide} className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
              <div ref={sideContent}>
              {/*
                Nothing picked yet: the column speaks about the book instead of
                about an edition nobody chose (ROADMAP 1.1). The span of years
                waits for the pages to stop arriving, otherwise it states a
                range and corrects itself a moment later.
              */}
              {details ?? (
                <WorkPanel
                  work={work}
                  editions={merged.editions}
                  language={lang || undefined}
                  settled={merged.done || pages.pagesLoaded > 1}
                />
              )}
              </div>
              <MoreBelow show={sideOverflows && !sideAtEnd} onMore={sideMore} lift={sideHidden} />
            </aside>
          )}
        </div>
      )}
      {/*
        "More by …" under wall and sidebar alike (ROADMAP 6.53), also when the
        wall is empty: it does not depend on this work's covers. It is the
        last thing on the page, so it carries the room for the phone's peek
        bar — only while a cover is picked, or a phone shows a dead strip from
        the moment the page opens.
      */}
      {work.authors[0] && work.authors[0] !== 'Unknown' && (
        <AuthorWorks
          key={work.id}
          author={work.authors[0]}
          authorKey={work.authorKeys?.[0]}
          workId={work.id}
          workTitle={work.title}
          siblingIds={pages.siblingIds}
          settled={merged.done}
          className={!isDesktop && selected ? 'pb-20' : ''}
        />
      )}
      {!isDesktop && selected && (
        <CoverSheet
          coverUrl={selected.url}
          caption={view.captions.get(selected.id) ?? ''}
          share={<ShareMenu workId={work.id} coverId={selected.id} title={work.title} author={work.authors[0]} placement="up" compact />}
          /*
            On a phone "Add to collection" sits in the sheet's header beside
            "Close" (ROADMAP 6.77), where it costs the body no height.
          */
          headerAction={wallsOn ? (
            <AddToWall
              workId={work.id}
              title={work.title}
              author={work.authors[0]}
              cover={selected}
              editions={selected.editionIds.map(id => view.editionsById.get(id)).filter((e): e is EditionView => !!e)}
              compact
            />
          ) : undefined}
        >
          {details}
        </CoverSheet>
      )}
    </Shell>
    </VerdictReport.Provider>
  );
}

/** A quiet line that fills while later edition pages load; gone when done. */
function ScanProgress({ checked, total, done }: { checked: number; total: number; done: boolean }) {
  const t = useT();
  if (done || total === 0) return null;
  const pct = Math.min(100, Math.round((checked / total) * 100));
  return (
    <div
      className="mb-6 h-px w-full max-w-3xl bg-line"
      role="progressbar"
      aria-label={t('Editions checked')}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-px bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

interface CoverDetailsProps {
  workId: string;
  cover: Cover;
  editions: EditionView[];
  coversPerEdition: ReadonlyMap<string, number>;
  /** The work's own title, to tell a printing's own title apart from it. */
  workTitle: string;
  /** The market's shops searched by the work's title (ROADMAP 1.11). */
  anyEditionLinks: BuyLink[];
  /** Edition ids per scan, from before folding (ROADMAP 6.14). */
  editionsByScan: ReadonlyMap<string, readonly string[]>;
  author?: string;
  /** Carried into the links of the "looks like this" row so Back still works. */
  query: string;
  market: Market;
  onMarketChange: (market: Market) => void;
  /** What a shop shows for an ISBN, compared with the cover on screen. */
  verdictFor: (isbn13: string) => IsbnVerdict;
  /** Rendered under the big cover on wide screens (Julian, 2026-09-09). */
  share?: React.ReactNode;
}

/**
 * Covers of *other* books that look like this one (ROADMAP 6.10).
 *
 * Answered from the built index (SPEC §2.5), so it costs no request to
 * anyone. It sits directly under the cover it describes, because a lateral
 * jump only makes sense next to the thing jumped from — at the foot of the
 * sidebar, where it started, nobody found it.
 *
 * Three covers, not six, and no explanatory paragraph: the row appears for
 * about one cover in nine, and in those cases it pushes the buy links down,
 * which are already further from the top than they should be (ROADMAP 1.2).
 * Small is the price of standing here.
 *
 * When the index does not know this cover the section is absent rather than
 * empty. A hundred works are indexed, not the catalogue.
 */
function SimilarCovers({ coverId, query }: { coverId: string; query: string }) {
  const t = useT();
  const similar = useSimilarCovers(coverId).slice(0, 3);
  if (similar.length === 0) return null;
  return (
    <section className="mt-4" aria-label={t('Covers that look like this one')}>
      <h3 className="text-lg leading-snug text-ink">{t('Covers that look like this one')}</h3>
      {/*
        A fixed three-column grid, not `flex-1` per item (ROADMAP 6.10a).
        With three matches the two are the same; with one, `flex-1` gave that
        one the whole column — some 370 px at 1440 — and Open Library's `-S`
        thumbnail, which is about 45 px wide, arrived as a blur. The row is
        about *how a cover looks*, so a soft picture is not a cosmetic fault.
        The source is `url` (`-M`, 180 px) for the same reason: `CoverImage`
        runs `unoptimized`, so `sizes` is a hint to the browser and changes
        nothing about the file that is fetched.
      */}
      <ul className="mt-2 grid grid-cols-3 gap-2">
        {similar.map(match => (
          <li key={match.coverId} className="min-w-0">
            <Link
              href={`/book/${match.workId}?cover=${encodeURIComponent(match.coverId)}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
              className="group block"
              title={`${match.title} — ${match.author}`}
            >
              <span className="cover-shadow relative block aspect-[2/3] overflow-hidden rounded-[3px] bg-surface-2">
                <CoverImage src={match.url} alt={t('{title} by {author}', { title: match.title, author: match.author })} sizes="125px" />
              </span>
              <span className="mt-1 block truncate text-[11px] leading-tight text-ink-3 group-hover:text-ink-2">
                {match.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CoverDetails({ cover, editions, coversPerEdition, workId, workTitle, anyEditionLinks, editionsByScan, author, query, market, onMarketChange, verdictFor, share }: CoverDetailsProps) {
  const t = useT();
  const wallsOn = useContext(WallsOn);
  const isDesktop = useIsDesktop();
  const addToWall = wallsOn ? <AddToWall workId={workId} title={workTitle} author={author} cover={cover} editions={editions} /> : null;
  /*
    Every scan that was folded into this tile, the representative first
    (ROADMAP 6.14). Folding is right on the wall — without it *The Great
    Gatsby* is 293 nearly identical tiles — but it was one-way: the "+N" badge
    is decoration, the sidebar only mentioned the count in passing, and
    `coverForId` resolves a folded id back to its representative, so even a
    hand-written `?cover=` could not reach one. That is what E16 forbids one
    reason further along: a misjudgement may cost a position, never a cover.
    Measured on *Ansichten eines Clowns*: two dtv printings of the same
    drawing, 1967 and 1984, distance 6 — the same design, visibly different
    printings, and one of them was invisible.

    The URLs are rebuilt from the ids (`coverUrlFor`, pure), so nothing had to
    be carried through the model for this.
  */
  const scans = [cover.id, ...(cover.similarIds ?? [])].filter(id => coverUrlFor(id, 'L'));
  const [pickedScan, setPickedScan] = useState<string | null>(null);
  const { scroller: scanScroller, content: scanContent, overflows: scanOverflows, atStart: scanAtStart, atEnd: scanAtEnd, onScroll: measureScanRow } = useOverflowsX();
  const verdictOf = (isbn13: string) => verdictFor(isbn13).status;
  /*
    Without a pick, the scan follows the printing that leads (ROADMAP 6.78).
    Ordered once from the wall's scan: when that scan's carrier has no ISBN
    and another printing of the cover has one, the other leads, and the
    picture shown large is its own scan — so the buttons and the image name
    the same printing. A printing without a scan of its own keeps the wall's.
  */
  const lead = orderEditionsForMarket(editions, market, { carriedBy: new Set(editionsByScan.get(cover.id) ?? []), verdictOf })[0];
  const leadScan = lead && !(editionsByScan.get(cover.id) ?? []).includes(lead.id)
    ? scans.find(scan => (editionsByScan.get(scan) ?? []).includes(lead.id))
    : undefined;
  // Derived, like the printing above it: another cover replaces the list.
  const shownScan = pickedScan && scans.includes(pickedScan) ? pickedScan : leadScan ?? cover.id;
  const shownUrl = shownScan === cover.id ? cover.url : coverUrlFor(shownScan, 'L') ?? cover.url;

  /*
    Which printing leads is a decision now, not the catalogue's arrival order
    (ROADMAP 1.11 lever 2, sharpened by Julian on 2026-09-09). It follows the
    scan on screen: pick another scan of the same design above, and the
    printing that carried *that* one comes to the front — among the printings
    a shop can look up, when there are any (6.78).
  */
  const carriedBy = new Set(editionsByScan.get(shownScan) ?? []);
  const ordered = orderEditionsForMarket(editions, market, { carriedBy, verdictOf });
  const [pickedId, setPicked] = useState<string | null>(null);
  /*
    Derived, never corrected from an effect: picking another cover replaces
    the list under this component, and an id that is no longer in it falls
    back to the first (the repo's set-state-in-effect rule).
  */
  const shown = ordered.find(e => e.id === pickedId) ?? ordered[0];

  /*
    The printings that carry this cover, as one sideways row between the
    cover and its shops (ROADMAP 6.77, chosen by Julian on 2026-09-29 after
    four mockups: „ja, mach D zur festen Fassung"). Before, a row of scans
    and a row of printing chips sat between the cover and the shops, and the
    first shop lay 1,174 px down a phone's sheet; a vertical list was tried
    and dropped („die version … mit einem seitlichen scrollen finde ich viel
    besser").

    Each printing gets a tile per scan it carries, side by side, with its
    publisher and year under them — the row speaks of printings, not scans
    (Julian: „sprich doch von printings statt von scans"). The printing on
    the buttons lights up with all its tiles, the scan shown large with the
    full ring; a click on a tile shows that scan and hands the buttons to that
    printing. How many printings carry more than one scan is said in the
    heading's free right half, where it takes no room. Arrows on screens with
    a pointer, where a wheel does not scroll sideways. Fixed order, so nothing
    moves under the pointer: the printing of the wall's scan, then printings
    with an ISBN (the only ones a shop can look up), then the rest.
  */
  const scanStrip = scans.length > 1 || ordered.length > 1 ? (() => {
    const scansOf = new Map<string, string[]>();
    for (const scan of scans) {
      for (const id of editionsByScan.get(scan) ?? []) scansOf.set(id, [...(scansOf.get(id) ?? []), scan]);
    }
    const printings = editions
      .map((e, i) => ({ e, i, scans: scansOf.get(e.id) ?? [] }))
      .sort((a, b) => {
        const tier = (p: { e: EditionView; scans: string[] }) => (p.scans.includes(cover.id) ? 0 : p.e.isbn13 ? 1 : 2);
        return tier(a) - tier(b) || a.i - b.i;
      });
    /*
      The note counts, it does not assume: "one with 2 scans" was a fixed
      string, and *Solaris* (Faber and Faber 2003, three scans) said "2"
      under three tiles (Julian, 2026-09-30). With a single printing
      "one with …" reads as a riddle, so it says only how many scans.
    */
    const multi = printings.filter(p => p.scans.length > 1);
    const note = multi.length === 0 ? null
      : printings.length === 1 ? t('{n} scans', { n: multi[0].scans.length })
      : multi.length === 1 ? t('one with {n} scans', { n: multi[0].scans.length })
      : t('{n} with several scans', { n: multi.length });
    const scrollBy = (event: React.MouseEvent<HTMLButtonElement>, direction: 1 | -1) => {
      const box = event.currentTarget.closest('[data-strip]')?.querySelector<HTMLElement>('[data-strip-scroller]');
      box?.scrollBy({ left: direction * box.clientWidth * 0.8, behavior: 'smooth' });
    };
    const arrow = 'absolute top-[2.625rem] z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bg/90 text-ink-2 shadow-sm transition-colors hover:text-ink [@media(hover:hover)]:flex';
    const tileClass = (lit: boolean, big: boolean) =>
      `cover-shadow relative block h-[5.25rem] w-14 overflow-hidden rounded-[3px] bg-surface-2 transition-opacity ${
        lit ? `ring-2 ring-offset-2 ring-offset-bg ${big ? 'ring-accent' : 'ring-accent/50'}` : 'opacity-80 hover:opacity-100'
      }`;
    return (
      <section className="mt-4" aria-label={t('Printings with this cover')} data-strip>
        <div className="flex items-baseline justify-between gap-3">
          <p className="kicker">{editions.length === 1 ? t('1 printing with this cover') : t('{n} printings with this cover', { n: editions.length })}</p>
          {note && <p className="text-right text-xs text-ink-3">{note}</p>}
        </div>
        <div className="relative mt-3">
          <div ref={scanScroller} onScroll={measureScanRow} data-strip-scroller className="snap-x overflow-x-auto pb-2 [scrollbar-width:thin]">
            <ul ref={scanContent} className="flex w-max gap-2.5">
              {printings.map(({ e, scans: own }) => {
                const lit = e.id === shown?.id;
                return (
                  <li key={e.id} className="snap-start">
                    <div className="flex gap-1">
                      {own.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => setPicked(e.id)}
                          aria-pressed={lit}
                          title={t('This printing carries the cover, without a scan of its own')}
                          className={`block h-[5.25rem] w-14 rounded-[3px] border border-dashed border-line ${lit ? 'border-accent' : ''}`}
                        />
                      ) : own.map((scan, k) => (
                        <button
                          key={scan}
                          type="button"
                          onClick={() => { setPickedScan(scan); setPicked(e.id); }}
                          aria-pressed={lit && scan === shownScan}
                          title={own.length > 1 ? t('Scan {k} of {n} of this printing', { k: k + 1, n: own.length }) : scan === cover.id ? t('The scan the wall shows') : undefined}
                          className={tileClass(lit, scan === shownScan)}
                        >
                          <CoverImage src={coverUrlFor(scan, 'M') ?? ''} alt={`${e.publisher ?? t('A printing')}${e.year ? `, ${e.year}` : ''}${own.length > 1 ? `, ${t('scan {k} of {n}', { k: k + 1, n: own.length })}` : ''}`} sizes="56px" />
                        </button>
                      ))}
                    </div>
                    <div className="mt-1 w-14 text-[10px] leading-tight">
                      <p className={`line-clamp-2 ${lit ? 'text-accent' : 'text-ink-2'}`}>{e.publisher || t('Publisher unknown')}</p>
                      <p className="mt-0.5 text-ink-3">{[e.year, e.isbn13 ? undefined : t('no ISBN')].filter(Boolean).join(', ')}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          {scanOverflows && !scanAtStart && (
            <>
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-bg to-transparent" />
              <button type="button" onClick={e => scrollBy(e, -1)} className={`${arrow} left-0`} aria-label={t('Earlier printings')}>‹</button>
            </>
          )}
          {scanOverflows && !scanAtEnd && (
            <>
              <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-bg to-transparent" />
              <button type="button" onClick={e => scrollBy(e, 1)} className={`${arrow} right-0`} aria-label={t('More printings')}>›</button>
            </>
          )}
        </div>
      </section>
    );
  })() : null;

  return (
    <div>
      {/*
        Sharing sits above the cover, not below it and not up in the header:
        what a reader wants to send is the picture they just picked, and the
        space under it is the scarcest on the page (ROADMAP 1.2). On a phone
        the same control is in the bar beside "Details", so it is hidden here
        rather than shown twice. (Julian, 2026-09-09.)
      */}
      {/*
        On a wide screen "Add to wall" shares this row with Share, so the
        first shop stays where it was; a separate row pushed it 40 px further
        below an 800 px window (ROADMAP 5.13a, measured 2026-09-28). One
        instance, never a CSS-hidden twin (useIsDesktop).
      */}
      {(share || addToWall) && (
        <div className="mb-3 hidden items-start justify-between gap-2 lg:flex">
          <div>{isDesktop && addToWall}</div>
          {share}
        </div>
      )}
      {/*
        In the phone sheet the cover shares the screen with the very links the
        reader opened the sheet for, so it stays small enough that the first
        buy link is a short scroll away rather than a screen away.

        On a wide screen the same problem had the same cause and no cap: in a
        400 px column the cover ran 600 px tall, which by itself pushed the
        first shop button 105 px below the window edge even after this block
        had been cut from fourteen controls to five. So the width is capped at
        a share of the *window height* — 31vh of width is 46vh of cover, the
        picture stays the largest thing in the column, and the shops arrive
        with it (ROADMAP 1.2, candidate b).
      */}
      <div className="cover-shadow relative mx-auto aspect-[2/3] max-w-[180px] overflow-hidden rounded-card bg-surface-2 sm:max-w-xs lg:mx-0 lg:max-w-[min(100%,31vh)]">
        <CoverImage src={shownUrl} alt={t('Selected cover')} sizes="(max-width: 640px) 180px, (max-width: 1024px) 320px, 30vw" priority />
      </div>
      <p className="mt-2 text-xs text-ink-3">
        {/* Named for the scan on screen, not for the tile it was folded into. */}
        {t('Image from {source}', { source: shownScan.startsWith('gb:') ? 'Google Books' : 'Open Library' })}
        {editions.length > 1 ? `, ${t('on {n} editions', { n: editions.length })}` : ''}
      </p>
      {shown && (
        <>
          {scanStrip}
          <EditionBlock
            key={shown.id}
            gap="mt-2 lg:mt-6"
            edition={shown}
            workTitle={workTitle}
            author={author}
            otherCovers={(coversPerEdition.get(shown.id) ?? 1) - 1}
            searchLinks={searchLinksFor({ title: shown.title, author, ...searchFacts(shown), coverUrl: cover.url, editionId: shown.id, isbn13: shown.isbn13 }, market)}
            searchWords={{ title: shown.title, author, ...searchFacts(shown) }}
            anyEditionLinks={anyEditionLinks}
            market={market}
            onMarketChange={onMarketChange}
            verdict={shown.isbn13 ? verdictFor(shown.isbn13) : { status: 'unknown' }}
            afterLead={<SimilarCovers coverId={cover.id} query={query} />}
          />
        </>
      )}
    </div>
  );
}

interface EditionBlockProps {
  edition: EditionView;
  /** To decide whether this printing's own title is worth a line (56 % differ). */
  workTitle: string;
  /** Primary author, for the local-bookshop search without an ISBN (5.12). */
  author?: string;
  otherCovers: number;
  searchLinks: EditionView['buyLinks'];
  /** The words `searchLinks` were built from, so the counting redirect can rebuild them (ROADMAP 3.1). */
  searchWords: WordsQuery;
  anyEditionLinks: BuyLink[];
  market: Market;
  onMarketChange: (market: Market) => void;
  verdict: IsbnVerdict;
  /** Rendered right after the first row of shops: "Looks like this" (ROADMAP 6.77). */
  afterLead?: React.ReactNode;
  /** Space above the printing's heading; small on a phone under the printings row (Julian, 2026-09-29: „weniger luft"). */
  gap?: string;
}

/**
 * One printing: what it is, and where it can be had (ROADMAP 1.11 / 1.2).
 *
 * The old block put fourteen controls in one column for a single edition —
 * five buy buttons, six search buttons, the market switcher, the availability
 * probe and the preview link — under two headings that asked the same
 * question, with "AbeBooks" and "eBay" each appearing twice. `linkPlan` sorts
 * them into three zones instead, and everything that is not one of the two or
 * three shops with a chance goes behind a fold.
 */
function EditionBlock({ edition, workTitle, author, otherCovers, searchLinks, searchWords, anyEditionLinks, market, onMarketChange, verdict, afterLead, gap = 'mt-6' }: EditionBlockProps) {
  const t = useT();
  const locale = useLocale();
  // Reset whenever the edition or the market changes: an answer belongs to
  // one ISBN in one market's shops.
  const [checked, setChecked] = useState<{ key: string; byProvider: Map<string, ShopStatus> } | null>(null);
  const key = `${edition.id} ${market}`;
  const shops = checked?.key === key ? checked.byProvider : null;

  // The analytics note which verdict the reader saw (ROADMAP 3.1b, K8).
  useReportVerdict(edition.isbn13 ? verdict.status : undefined);
  const plan = useMemo(
    () => linkPlan({ edition, buyLinks: edition.buyLinks, searchLinks, anyEditionLinks, market, verdict: verdict.status, t }),
    [edition, searchLinks, anyEditionLinks, market, verdict.status, t],
  );
  // Which of the links were built from the ISBN, and so go through the count.
  const fromIsbn = useMemo(() => new Set(edition.buyLinks.map(l => l.provider)), [edition.buyLinks]);

  const hint = [edition.publisher, edition.year].filter(Boolean).join(' ');
  // Like a catalogue card, "Penguin Books, 2010 (English)" — not a row of dots (6.84).
  const language = edition.language ? languageName(edition.language, locale) : undefined;
  const head = [[edition.publisher, edition.year ? String(edition.year) : undefined].filter(Boolean).join(', '), language ? `(${language})` : undefined]
    .filter(Boolean).join(' ');
  /*
    56 % of cover-bearing editions carry a title of their own — "Die Enden der
    Parabel", "El arco iris de gravedad". That is worth a line; repeating the
    work's title one line under the work's title is not.
  */
  const ownTitle = normalizeTitle(edition.title) === normalizeTitle(workTitle) ? undefined : edition.title;
  const details: Array<[string, string | undefined]> = [
    [t('Published'), edition.publishedDate],
    [t('Format'), edition.format],
    [t('Pages'), edition.pageCount ? String(edition.pageCount) : undefined],
    [t('Also printed with'), otherCovers > 0 ? (otherCovers === 1 ? t('1 other cover') : t('{n} other covers', { n: otherCovers })) : undefined],
  ];
  const rows = details.filter(([, v]) => v);
  const moreLinks = plan.rest.length;
  const commission = commissionNote([...plan.lead, ...plan.rest, ...plan.anyEdition]);
  // The availability probe has its own switch (ROADMAP 0.1); without it the fold holds links only.
  const hasFold = moreLinks > 0 || (availabilityEnabled() && !!edition.isbn13);
  const hasInfo = !!edition.previewUrl || rows.length > 0 || !!edition.description;

  return (
    <div className={gap}>
      <p className="text-sm text-ink">{head || t('Publisher and year unknown')}</p>
      {ownTitle && <p className="mt-0.5 text-sm text-ink-2">{ownTitle}</p>}
      {edition.isbn13 && <p className="mt-0.5 text-[13px] text-ink-3">ISBN <IsbnText isbn={edition.isbn13} /></p>}

      <div className="mt-5">
        {/*
          On `differs` the verdict comes *before* the buttons, because it is
          the reason they are searches and not shops: whatever the ISBN opens
          ships the other jacket, so the row hunts the picture on screen by
          title, author, publisher and year (SPEC F2.9). On `uncompared` the
          publisher's image stands in the same place for the reader to weigh
          before clicking; the buttons stay the ISBN's (ROADMAP 6.32).
        */}
        {edition.isbn13 && (verdict.status === 'differs' || verdict.status === 'uncompared'
          || verdict.status === 'catalogueDiffers' || verdict.status === 'catalogueUncompared') && (
          <VerdictNote verdict={verdict} hint={hint} />
        )}
        {/* The pills sit right after the heading, not pushed to the far edge (Julian, 2026-09-26: „less gap before the pills"). */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-lg leading-snug text-ink">
            {verdict.status === 'differs'
              ? t('Find the cover you picked')
              : edition.isbn13 ? t('Get this printing') : t('Find this printing')}
          </h3>
          <MarketSwitcher market={market} onChange={onMarketChange} compact />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {plan.lead.map(link => (
            <ShopLink
              key={link.provider}
              link={link}
              isbn13={edition.isbn13}
              market={market}
              counted={fromIsbn.has(link.provider)}
              words={searchWords}
              status={shops?.get(link.provider)}
            />
          ))}
        </div>
        {/*
          The one sentence that justifies the order. It states a fact about the
          number — its registration group — and nothing about any shop, which
          is the same line `lib/verdicts.ts` holds one level up.
        */}
        {plan.note && <p className="mt-2 text-xs leading-relaxed text-ink-3">{plan.note}</p>}
        {/*
          Shop mode only, and only when a link shown here carries an id
          (ROADMAP 4.11): under the first row, not on the About page alone,
          because that is where the reader decides to click. Hobby mode
          builds no affiliate links, so it never appears there (E20).
        */}
        {commission && <p className="mt-2 text-xs leading-relaxed text-ink-3">{commission}</p>}
      </div>

      {afterLead}

      {hasFold && (
        <details className="group mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer list-none text-sm text-ink-2 transition-colors hover:text-ink">
            <span className="mr-1 inline-block text-accent transition-transform group-open:rotate-90">▸</span>
            {moreLinks > 0 ? t('Other ways to find it ({n})', { n: moreLinks }) : t('Check the shops')}
          </summary>
          <div className="mt-3 space-y-4">
            {plan.rest.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {plan.rest.map(link => (
                  <ShopLink
                    key={link.provider}
                    link={link}
                    isbn13={edition.isbn13}
                    market={market}
                    counted={fromIsbn.has(link.provider)}
                    words={searchWords}
                    status={shops?.get(link.provider)}
                  />
                ))}
              </div>
            )}
            {/* Off unless its own switch is on (ROADMAP 0.1): the probe is not cleared for the public site. */}
            {availabilityEnabled() && edition.isbn13 && (
              <AvailabilityCheck
                isbn13={edition.isbn13}
                checked={!!shops}
                onResult={byProvider => setChecked({ key, byProvider })}
              />
            )}
            {shops && (
              <p className="text-xs leading-relaxed text-ink-3">
                {t('Each shop was asked whether its page for this ISBN differs from its page for an ISBN that cannot exist. Only “found it” tells you anything: some shops refuse the question, and others build their results in the browser, where this check cannot follow. Nothing here is a stock check.')}
              </p>
            )}
          </div>
        </details>
      )}

      {/*
        A second fold, not a row in the first (Julian, 2026-09-26): the shops
        above are the market's retailers, this one leads to services of
        independent bookshops in a country the reader picks (ROADMAP 5.12).
      */}
      <LocalShops edition={{ isbn13: edition.isbn13, title: edition.title, author }} market={market} />

      {/*
        What is known about this printing — the preview, the dates, the blurb —
        stands open under its own line rather than behind "Other ways to find
        it" (Julian, 2026-09-11). It is not a way to find the book, and folding
        it in with the shop links hid the one part of the sidebar that is about
        the book itself.
      */}
      {hasInfo && (
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          {edition.previewUrl && (
            <a href={edition.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-accent hover:underline">
              {t('Preview on Google Books')}
            </a>
          )}
          {rows.length > 0 && (
            <dl className="divide-y divide-line border-y border-line text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {edition.description && (
            <p className="line-clamp-6 text-sm leading-relaxed text-ink-2">{edition.description}</p>
          )}
        </div>
      )}

      {/*
        Julian, 2026-09-09: where a shop that could pay commission has a link
        to exactly this printing, that link wins and this row does not appear
        at all. It shows up only when no such link is possible — a foreign
        ISBN, or none — and it says plainly that it leads somewhere else.
      */}
      {plan.anyEdition.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-lg leading-snug text-ink">{t('Or read it in another edition')}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.anyEdition.map(link => (
              <a
                key={link.provider}
                // Through the counting redirect, which rebuilds the same search from the table (ROADMAP 3.1).
                href={trackedSearchHref(link.provider, { title: displayTitle(workTitle), author }, market)}
                target="_blank"
                rel={link.affiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
                className="btn"
              >
                {link.label}
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            {t('These search for “{title}” by title. Whatever they carry is a different printing from the one above, with a cover of its own.', { title: displayTitle(workTitle) })}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Says what the publisher's current image for this ISBN shows (SPEC §9.3
 * step 13). Measured on *Beloved*: for half the ISBNs where Google Books has
 * an image, it is a different jacket than the catalogue scan.
 *
 * The wording names the source on purpose. No shop is ever contacted: the
 * retailer links are URL templates built from the ISBN, and the only lookup
 * is Google Books, which carries the image from the publisher's metadata
 * feed. Shops usually draw on the same feed, so the image is good evidence
 * for what will arrive, but it is not a reading of any shop's page, and the
 * text must not claim otherwise (Julian, 2026-09-07).
 */
/*
  Two states speak, and both show a picture the reader has to weigh.
  `differs` (Julian, 2026-09-11: „es sollte nur eine anmerkung geben bei
  differs"): the number ships another jacket, so the row below hunts the
  picture instead. `uncompared` (ROADMAP 6.32): the fold could not compare
  the two, so the publisher's image stands beside the note and the reader
  decides; the ISBN links keep their place. The other states added a
  sentence under every printing that changed nothing; saying nothing claims
  nothing (N12), and the About page still explains every state in the words
  of `lib/verdicts.ts`. Both were kept when main met production on
  2026-09-11, where 1.11 and 6.32 had each rewritten this function.
*/
/**
 * The ISBN as the reader sees it: hyphenated, in the text face, with the
 * zeros and hyphens from Geist Mono (ROADMAP 6.61). Display only — every
 * link on this page is built from the bare `isbn13`.
 */
function IsbnText({ isbn }: { isbn: string }) {
  return (
    <>
      {isbnRuns(isbn).map((run, i) =>
        run.mono ? <span key={i} className="font-mono">{run.text}</span> : run.text,
      )}
    </>
  );
}

function VerdictNote({ verdict, hint }: {
  verdict: Extract<IsbnVerdict, { status: 'differs' | 'uncompared' | 'catalogueDiffers' | 'catalogueUncompared' }>;
  hint: string;
}) {
  const t = useT();
  // Open Library stood in for Google (ROADMAP 1.12): the picture is the catalogue's scan, and the labels must not call it the publisher's.
  const catalogue = verdict.status === 'catalogueDiffers' || verdict.status === 'catalogueUncompared';
  return (
    <div className="mb-4 flex items-start gap-3">
      <a
        href={`?cover=${encodeURIComponent(verdict.cover.id)}`}
        className="shrink-0"
        aria-label={catalogue ? t('See Open Library’s cover for this ISBN') : t('See the publisher’s current image for this ISBN')}
      >
        <span className="cover-shadow relative block h-20 w-[3.4rem] overflow-hidden rounded-[3px] bg-surface-2">
          <CoverImage
            src={verdict.cover.urlSmall ?? verdict.cover.url}
            alt={catalogue ? t('Open Library’s cover for this ISBN') : t('The publisher’s current image for this ISBN')}
            sizes="55px"
          />
        </span>
      </a>
      <p className="text-xs leading-relaxed text-ink-3">
        <span className="text-ink-2">{t(VERDICT_LEAD[verdict.status])}</span>{' '}
        {verdict.status === 'differs' ? (
          <>
            {t('It is the one beside this note, so that is what a new copy is likely to be.')}
            {hint ? ` ${t('The searches below look for {hint} second-hand instead.', { hint })}` : ` ${t('The searches below look for this printing instead.')}`}
          </>
        ) : verdict.status === 'catalogueDiffers' ? (
          t('It is the one beside this note.')
        ) : (
          t('It is the one beside this note; if it looks like the cover on screen, a new copy probably will too.')
        )}
      </p>
    </div>
  );
}

/**
 * One shop button.
 *
 * A link built from the ISBN goes through our own redirect, which counts the
 * click and rebuilds the target from the table, so it can never become an
 * open redirect (SPEC §10 C9). A shop searched by words goes through it too
 * since ROADMAP 3.1: only the words travel, and the redirect rebuilds the
 * shop's URL from the same table. Image searches and catalogues stay plain.
 */
function ShopLink({ link, isbn13, market, counted, words, status }: {
  link: BuyLink;
  isbn13?: string;
  market: Market;
  /** Built from the ISBN, so the counting redirect applies. */
  counted: boolean;
  /** The words a shop search was built from. */
  words?: WordsQuery;
  status?: ShopStatus;
}) {
  const t = useT();
  const href = counted && isbn13
    ? trackedBuyHref(link.provider, isbn13, market)
    : words && isWordsProvider(link.provider) ? trackedSearchHref(link.provider, words, market) : link.url;
  return (
    <a
      href={href}
      target="_blank"
      // `sponsored` states a paid relationship; in hobby mode there is none (E20).
      rel={counted && commerceEnabled() ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
      className="btn"
      title={status ? t(SHOP_STATUS_TITLE[status]) : shopLinkTitle(link, t)}
    >
      {link.label}
      {/*
        No "search" tag any more (Julian, 2026-09-11: it costs room on every
        button). The label names the question the button puts, and whether
        the URL opens a results page or a book's page stays in the tooltip.
      */}
      {status && <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">{t(SHOP_STATUS_LABEL[status])}</span>}
    </a>
  );
}

/*
  What the button opens, as far as the URL itself says. `linkPlan` withdraws
  `kind` where the number was not issued in this market's registration area,
  so a foreign ISBN never gets "this book's page" written under it — that
  would be a claim about a shop nobody asked (ROADMAP 1.11 lever 3).
*/
function shopLinkTitle(link: BuyLink, t: Translate): string {
  if (link.kind === 'product') return t('{shop}: this book’s page', { shop: link.label });
  if (link.kind === 'search') return t('{shop}: search results', { shop: link.label });
  return link.label;
}

/**
 * The detail page's whole interactive body (SPEC §3 F2).
 *
 * It lives here rather than in `app/book/[id]/page.tsx` so that the route
 * itself can be a server component and carry the page's metadata: title,
 * description, Open Graph image and structured data (SPEC §10 D10). Nothing
 * about the behaviour changed in the move.
 */
export default function BookDetailPage({ walls = false }: { walls?: boolean }) {
  return (
    <WallsOn.Provider value={walls}>
      <Suspense>
        <BookDetail />
      </Suspense>
    </WallsOn.Provider>
  );
}

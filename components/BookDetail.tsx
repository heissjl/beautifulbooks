'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import CoverGallery, { type CoverTab } from '@/components/CoverGallery';
import DecadeLink from '@/components/DecadeLink';
import AvailabilityCheck, { SHOP_STATUS_LABEL, SHOP_STATUS_TITLE } from '@/components/AvailabilityCheck';
import CoverImage from '@/components/CoverImage';
import CoverSheet from '@/components/CoverSheet';
import WorkPanel from '@/components/WorkPanel';
import ShareMenu from '@/components/ShareMenu';
import LoadingStage from '@/components/LoadingStage';
import MarketSwitcher from '@/components/MarketSwitcher';
import SiteFooter from '@/components/SiteFooter';
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
import { leadCover } from '@/lib/scene';
import { useOverflowsX } from '@/components/useOverflowsX';
import { searchLinksFor, trackedBuyHref } from '@/lib/buylinks';
import { linkPlan, orderEditionsForMarket } from '@/lib/linkplan';
import { coverIdFromSegment, coverUrlFor } from '@/lib/coverurl';
import decadePages from '@/data/decade-pages.json';
import { VERDICT_LEAD } from '@/lib/verdicts';
import { commerceEnabled } from '@/lib/sitemode';
import type { ShopStatus } from '@/lib/availability';
import type { Market } from '@/lib/market';
import type { BuyLink, Cover, EditionView } from '@/lib/model';
import { displayTitle, languageName, normalizeTitle } from '@/lib/normalize';
import type { ImageSignature } from '@/lib/imagesig';
import { coverForId, leadLanguagesSettled, orderGroups, type MergedWork, type Truncation } from '@/lib/pages';
import { groupByDecade, worthAPage } from '@/lib/decades';
import { shapeOf } from '@/lib/queryshape';
import { foldDuplicateCovers, groupCoversByLanguage, verifyIsbnCover, type IsbnVerdict } from '@/lib/works';

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
function BackLink({ href, toResults }: { href: string; toResults: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-md py-1 pr-2 text-sm text-ink-2 transition-colors hover:text-ink">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {toResults ? 'Results' : 'Home'}
    </Link>
  );
}

function Shell({ children, backHref, toResults, right }: { children: React.ReactNode; backHref: string; toResults: boolean; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader left={<BackLink href={backHref} toResults={toResults} />} right={right} search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-8 sm:px-6 lg:px-8">{children}</main>
      <SiteFooter />
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

/**
 * Folds and groups the covers of a wall.
 *
 * Folding cannot happen on the server: it only ever sees one page of
 * editions, and duplicates sit across pages (SPEC §9.3 step 11). `extra`
 * carries the retail covers fetched for a selected ISBN (step 13a); they
 * join before folding, so a retail image identical to the catalogue scan
 * folds into it instead of showing up twice.
 */
function buildWall(
  merged: MergedWork<EditionView>,
  extra: readonly Cover[],
  extraSignatures: ReadonlyMap<string, ImageSignature>,
  preferred: string | undefined,
) {
  const all = [...merged.covers, ...extra];
  const signatures = new Map(merged.signatures);
  for (const [id, sig] of extraSignatures) signatures.set(id, sig);

  /*
    Which editions carried each scan *before* folding (ROADMAP 6.14, and the
    ordering in `orderEditionsForMarket`). Folding merges the members' edition
    ids into the representative, so afterwards a tile lists printings that
    never had that picture; this map remembers who did.
  */
  const editionsByScan = new Map<string, readonly string[]>(all.map(c => [c.id, c.editionIds]));
  const covers = foldDuplicateCovers(all, signatures, merged.editions);
  const coversById = new Map(covers.map(c => [c.id, c]));
  const ordered = orderGroups(groupCoversByLanguage(covers, merged.editions, preferred, signatures), preferred);
  const groups: CoverTab[] = ordered.map(g => ({
    language: g.language,
    covers: g.coverIds.map(id => coversById.get(id)).filter((c): c is Cover => !!c),
  }));
  // `signatures` goes out too: the verdict must know which pictures the fold
  // could compare at all (ROADMAP 6.32).
  return { covers, coversById, groups, editionsByScan, signatures };
}

/**
 * What the wall is showing and how much of the catalogue it has seen
 * (SPEC §9.3 step 11, F). Open Library knows far more editions than carry a
 * cover, so the honest statement is "n covers out of m edition records
 * checked", never "every cover".
 */
export function progressLabel(covers: number, merged: Pick<MergedWork, 'checked' | 'total' | 'done' | 'truncated'>): string {
  const n = `${covers} cover${covers === 1 ? '' : 's'}`;
  const checked = merged.checked.toLocaleString('en');
  const total = merged.total.toLocaleString('en');
  if (!merged.done) return `${n} · ${checked} of ${total} editions checked`;
  const reason: Record<Exclude<Truncation, null>, string> = {
    cap: `${n} · first ${checked} of ${total} editions checked`,
    error: `${n} · ${checked} of ${total} editions checked, the source stopped answering`,
  };
  if (merged.truncated) return reason[merged.truncated];
  return `${n} from ${total} edition${merged.total === 1 ? '' : 's'}`;
}

/** "Scribner 1996" style caption from the editions carrying a cover. */
function captionFor(cover: Cover, editionsById: ReadonlyMap<string, EditionView>): string {
  const eds = cover.editionIds.map(id => editionsById.get(id)).filter((e): e is EditionView => !!e);
  const first = eds[0];
  if (!first) return '';
  const parts = [first.publisher, first.year ? String(first.year) : undefined].filter(Boolean);
  const more = eds.length > 1 ? ` +${eds.length - 1}` : '';
  return parts.join(' ') + more;
}

/** Back to the search the user came from (SPEC F2.7). */
function backHrefFrom(searchParams: URLSearchParams): string {
  const params = new URLSearchParams();
  const q = searchParams.get('q');
  const lang = searchParams.get('lang');
  if (q) params.set('q', q);
  if (lang) params.set('lang', lang);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

function BookDetail() {
  const params = useParams<{ id: string; coverId?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') ?? '';
  const backHref = backHrefFrom(searchParams);
  // A query means there is a result list behind the back link; a bare `?lang=`
  // does not (ROADMAP 6.28).
  const cameFromResults = !!searchParams.get('q');
  const preview = useWorkPreview(params.id);

  // Market for buy links (E9): the user's choice, else detected by the server.
  const [chosenMarket, setMarket] = useMarket();
  // Sidebar or bottom sheet; the two are exclusive so the cover image is
  // fetched once (SPEC §10 E13).
  const isDesktop = useIsDesktop();
  const requestKey = `${params.id} ${lang} ${chosenMarket ?? ''}`;

  // Editions arrive page by page and keep arriving while the user looks
  // around (SPEC §9.3 step 11).
  const pages = useWorkPages(params.id, lang, chosenMarket);

  // The selected cover lives in the URL (?cover=) so it can be shared (SPEC F2.6).
  /*
    A share address carries the cover in the path (`/book/<id>/cover/<cover>`,
    ROADMAP 6.20) so that its preview can show it; inside the page the query
    stays the source of truth, and picking another cover goes back to it.
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

  const selectedId = routeCover ?? searchParams.get('cover') ?? coverForIsbn;

  // Which ISBN to ask about is decided on the catalogue alone. Retail covers
  // never change *which edition* is being looked at, and deriving the
  // question from an answer that depends on it would chase its own tail.
  const lookupIsbns = useMemo(() => {
    if (!pages.merged) return [];
    const wall = buildWall(pages.merged, [], new Map(), lang || undefined);
    const cover = coverForId(wall, selectedId);
    if (!cover) return [];
    const byId = new Map(pages.merged.editions.map(e => [e.id, e]));
    return cover.editionIds.map(id => byId.get(id)?.isbn13).filter((i): i is string => !!i);
  }, [pages.merged, lang, selectedId]);

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
    const { merged, work, market } = pages;
    if (!merged || !work || !market) return null;
    const wall = buildWall(merged, isbnCovers.covers, isbnCovers.signatures, lang || undefined);
    const editionsById = new Map(merged.editions.map(e => [e.id, e]));
    const captions = new Map(wall.covers.map(c => [c.id, captionFor(c, editionsById)]));
    // How many covers each edition appears with (to flag reprints, SPEC F2.5).
    const coversPerEdition = new Map<string, number>();
    for (const c of wall.covers) for (const id of c.editionIds) coversPerEdition.set(id, (coversPerEdition.get(id) ?? 0) + 1);
    return { work, market, merged, ...wall, editionsById, captions, coversPerEdition };
  }, [pages, lang, isbnCovers]);

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


  if (pages.status === 'notfound' || pages.status === 'error') {
    return (
      <Shell backHref={backHref} toResults={cameFromResults}>
        <div className="py-24 text-center">
          <p className="font-display text-2xl text-ink">
            {pages.status === 'notfound' ? 'Book not found' : pages.message}
          </p>
          <Link href={backHref} className="mt-4 inline-block text-sm text-accent hover:underline">Back to search</Link>
        </div>
      </Shell>
    );
  }

  if (inScene || !view) {
    const work = view?.work;
    return (
      <Shell backHref={backHref} toResults={cameFromResults}>
        <TitleBlock
          title={work?.title ?? preview?.title}
          authors={work?.authors ?? preview?.authors}
          meta={work?.editionCount ? `${work.editionCount.toLocaleString('en')} editions` : undefined}
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
      editions={selected.editionIds.map(id => view.editionsById.get(id)).filter((e): e is EditionView => !!e)}
      coversPerEdition={view.coversPerEdition}
      workTitle={work.title}
      anyEditionLinks={pages.anyEditionLinks}
      editionsByScan={view.editionsByScan}
      author={work.authors[0]}
      query={searchParams.get('q') ?? ''}
      market={view.market}
      onMarketChange={setMarket}
      share={<ShareMenu workId={work.id} coverId={selected.id} title={work.title} author={work.authors[0]} />}
      verdictFor={isbn13 => verifyIsbnCover(
        selected,
        isbnCovers.byIsbn.get(isbn13) ?? [],
        view.covers,
        isbnCovers.asked.has(isbn13),
        isbnCovers.unavailable.has(isbn13),
        view.signatures,
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
    work.firstPublishYear ? `Open Library dates it to ${work.firstPublishYear}` : undefined,
    progressLabel(view.covers.length, merged),
  ].filter(Boolean).join(' · ');

  return (
    <Shell
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
        <p className="text-ink-2">Neither catalogue has a cover for this book.</p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
          {/*
            Room for the sheet's peek bar, so the last row stays reachable —
            but only when a cover is picked, or a phone shows a dead strip
            under the last row of tiles from the moment the page opens.
          */}
          <div className={`min-w-0 lg:col-span-2 lg:pb-0 ${selected ? 'pb-20' : ''}`}>
            <CoverGallery
              groups={view.groups}
              selectedCover={selected}
              onSelectCover={c => selectCover(c.id)}
              captions={view.captions}
              belowTabs={hasDecades ? <DecadeLink workId={work.id} /> : undefined}
            />
            <p className="mt-6 max-w-prose text-xs leading-relaxed text-ink-3">
              Covers come from Open Library and Google Books. Most edition records carry no
              scan, so a book has had covers neither catalogue knows.
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
            <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
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
            </aside>
          )}
        </div>
      )}
      {!isDesktop && selected && (
        <CoverSheet
          coverUrl={selected.url}
          caption={view.captions.get(selected.id) ?? ''}
          share={<ShareMenu workId={work.id} coverId={selected.id} title={work.title} author={work.authors[0]} placement="up" compact />}
        >
          {details}
        </CoverSheet>
      )}
    </Shell>
  );
}

/** A quiet line that fills while later edition pages load; gone when done. */
function ScanProgress({ checked, total, done }: { checked: number; total: number; done: boolean }) {
  if (done || total === 0) return null;
  const pct = Math.min(100, Math.round((checked / total) * 100));
  return (
    <div
      className="mb-6 h-px w-full max-w-3xl bg-line"
      role="progressbar"
      aria-label="Editions checked"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-px bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

interface CoverDetailsProps {
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
  const similar = useSimilarCovers(coverId).slice(0, 3);
  if (similar.length === 0) return null;
  return (
    <section className="mt-4" aria-label="Covers that look like this one">
      <p className="kicker">Looks like this</p>
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
                <CoverImage src={match.url} alt={`${match.title} by ${match.author}`} sizes="125px" />
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

function CoverDetails({ cover, editions, coversPerEdition, workTitle, anyEditionLinks, editionsByScan, author, query, market, onMarketChange, verdictFor, share }: CoverDetailsProps) {
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
  const { scroller: scanScroller, content: scanContent, overflows: scanOverflows, atEnd: scanAtEnd, onScroll: measureScanRow } = useOverflowsX();
  // Derived, like the printing above it: another cover replaces the list.
  const shownScan = pickedScan && scans.includes(pickedScan) ? pickedScan : cover.id;
  const shownUrl = shownScan === cover.id ? cover.url : coverUrlFor(shownScan, 'L') ?? cover.url;

  /*
    Which printing leads is a decision now, not the catalogue's arrival order
    (ROADMAP 1.11 lever 2, sharpened by Julian on 2026-09-09). It follows the
    scan on screen: pick another scan of the same design above, and the
    printing that carried *that* one comes to the front.
  */
  const carriedBy = new Set(editionsByScan.get(shownScan) ?? []);
  const ordered = orderEditionsForMarket(editions, market, { carriedBy, verdictOf: isbn13 => verdictFor(isbn13).status });
  const [pickedId, setPicked] = useState<string | null>(null);
  /*
    Derived, never corrected from an effect: picking another cover replaces
    the list under this component, and an id that is no longer in it falls
    back to the first (the repo's set-state-in-effect rule).
  */
  const shown = ordered.find(e => e.id === pickedId) ?? ordered[0];

  return (
    <div>
      {/*
        Sharing sits above the cover, not below it and not up in the header:
        what a reader wants to send is the picture they just picked, and the
        space under it is the scarcest on the page (ROADMAP 1.2). On a phone
        the same control is in the bar beside "Details", so it is hidden here
        rather than shown twice. (Julian, 2026-09-09.)
      */}
      {share && <div className="mb-3 hidden justify-end lg:flex">{share}</div>}
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
        <CoverImage src={shownUrl} alt="Selected cover" sizes="(max-width: 640px) 180px, (max-width: 1024px) 320px, 30vw" priority />
      </div>
      <p className="mt-2 text-xs text-ink-3">
        {/* Named for the scan on screen, not for the tile it was folded into. */}
        Image from {shownScan.startsWith('gb:') ? 'Google Books' : 'Open Library'}
        {editions.length > 1 ? ` · on ${editions.length} editions` : ''}
      </p>

      {scans.length > 1 && (
        <section className="mt-4" aria-label="Scans folded into this tile">
          <p className="kicker">The same cover, {scans.length} scans</p>
          {/*
            One row that scrolls sideways, never a second row (ROADMAP 6.14a):
            *Fahrenheit 451* carries eight scans, and a wrapped second row
            costs the column the height that 1.2 had just won back. The fading
            edge appears only while there is more to the right — a fade over
            a row that fits would hide a slice of the last tile for nothing.
          */}
          <div className="relative mt-2">
            <div ref={scanScroller} onScroll={measureScanRow} className="snap-x overflow-x-auto pb-1 [scrollbar-width:thin]">
            <ul ref={scanContent} className="flex w-max gap-2">
            {scans.map((id, i) => (
              <li key={id} className="snap-start">
                <button
                  type="button"
                  onClick={() => setPickedScan(id)}
                  aria-pressed={id === shownScan}
                  title={i === 0 ? 'The scan the wall shows' : 'Another scan of the same cover'}
                  className={`cover-shadow relative block h-16 w-[2.7rem] overflow-hidden rounded-[3px] bg-surface-2 transition-opacity ${
                    id === shownScan ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <CoverImage src={coverUrlFor(id, 'M') ?? ''} alt={i === 0 ? 'The scan the wall shows' : `Scan ${i + 1} of this cover`} sizes="44px" />
                </button>
              </li>
            ))}
            </ul>
            </div>
            {scanOverflows && !scanAtEnd && (
              <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-bg to-transparent" />
            )}
          </div>
          {/* N13: what is on screen, not the rule that put it there. */}
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            Different scans of the same design, sometimes of different printings.
          </p>
        </section>
      )}

      <SimilarCovers coverId={cover.id} query={query} />

      {/*
        A folded cover can sit on several printings, and the whole apparatus
        below used to repeat for every one of them — the 2,351 px of content
        in an 804 px column measured in ROADMAP 1.2. One printing is open,
        the others are one chip each.
      */}
      {ordered.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-1.5" role="group" aria-label="Printings that carry this cover">
          {ordered.map(edition => (
            <button
              key={edition.id}
              type="button"
              onClick={() => setPicked(edition.id)}
              aria-pressed={edition.id === shown?.id}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                edition.id === shown?.id ? 'border-accent text-accent' : 'border-line text-ink-3 hover:text-ink-2'
              }`}
            >
              {[edition.publisher, edition.year].filter(Boolean).join(' · ') || 'This printing'}
            </button>
          ))}
        </div>
      )}

      {shown && (
        <EditionBlock
          key={shown.id}
          edition={shown}
          workTitle={workTitle}
          otherCovers={(coversPerEdition.get(shown.id) ?? 1) - 1}
          searchLinks={searchLinksFor({ title: shown.title, author, publisher: shown.publisher, year: shown.year, coverUrl: cover.url, editionId: shown.id }, market)}
          anyEditionLinks={anyEditionLinks}
          market={market}
          onMarketChange={onMarketChange}
          verdict={shown.isbn13 ? verdictFor(shown.isbn13) : { status: 'unknown' }}
        />
      )}
    </div>
  );
}

interface EditionBlockProps {
  edition: EditionView;
  /** To decide whether this printing's own title is worth a line (56 % differ). */
  workTitle: string;
  otherCovers: number;
  searchLinks: EditionView['buyLinks'];
  anyEditionLinks: BuyLink[];
  market: Market;
  onMarketChange: (market: Market) => void;
  verdict: IsbnVerdict;
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
function EditionBlock({ edition, workTitle, otherCovers, searchLinks, anyEditionLinks, market, onMarketChange, verdict }: EditionBlockProps) {
  // Reset whenever the edition or the market changes: an answer belongs to
  // one ISBN in one market's shops.
  const [checked, setChecked] = useState<{ key: string; byProvider: Map<string, ShopStatus> } | null>(null);
  const key = `${edition.id} ${market}`;
  const shops = checked?.key === key ? checked.byProvider : null;

  const plan = useMemo(
    () => linkPlan({ edition, buyLinks: edition.buyLinks, searchLinks, anyEditionLinks, market, verdict: verdict.status }),
    [edition, searchLinks, anyEditionLinks, market, verdict.status],
  );
  // Which of the links were built from the ISBN, and so go through the count.
  const fromIsbn = useMemo(() => new Set(edition.buyLinks.map(l => l.provider)), [edition.buyLinks]);

  const hint = [edition.publisher, edition.year].filter(Boolean).join(' ');
  const head = [edition.publisher, edition.year ? String(edition.year) : undefined, languageName(edition.language)].filter(Boolean).join(' · ');
  /*
    56 % of cover-bearing editions carry a title of their own — "Die Enden der
    Parabel", "El arco iris de gravedad". That is worth a line; repeating the
    work's title one line under the work's title is not.
  */
  const ownTitle = normalizeTitle(edition.title) === normalizeTitle(workTitle) ? undefined : edition.title;
  const details: Array<[string, string | undefined]> = [
    ['Published', edition.publishedDate],
    ['Format', edition.format],
    ['Pages', edition.pageCount ? String(edition.pageCount) : undefined],
    ['Also printed with', otherCovers > 0 ? `${otherCovers} other cover${otherCovers > 1 ? 's' : ''}` : undefined],
  ];
  const rows = details.filter(([, v]) => v);
  const moreLinks = plan.rest.length + (edition.previewUrl ? 1 : 0);
  const hasFold = moreLinks > 0 || rows.length > 0 || !!edition.description;

  return (
    <div className="mt-6">
      <p className="text-sm text-ink">{head || 'Publisher and year unknown'}</p>
      {ownTitle && <p className="mt-0.5 text-sm text-ink-2">{ownTitle}</p>}
      {edition.isbn13 && <p className="mt-0.5 font-mono text-[13px] text-ink-3">ISBN {edition.isbn13}</p>}

      <div className="mt-5">
        {/*
          On `differs` the verdict comes *before* the buttons, because it is
          the reason they are searches and not shops: whatever the ISBN opens
          ships the other jacket, so the row hunts the picture on screen by
          title, author, publisher and year (SPEC F2.9).
        */}
        {edition.isbn13 && verdict.status === 'differs' && <VerdictNote verdict={verdict} hint={hint} lead />}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="kicker">
            {verdict.status === 'differs'
              ? 'Find the cover you picked'
              : edition.isbn13 ? 'Get this printing' : 'Find this printing'}
          </p>
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
        {edition.isbn13 && verdict.status !== 'differs' && <VerdictNote verdict={verdict} hint={hint} />}
      </div>

      {hasFold && (
        <details className="group mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer list-none text-sm text-ink-2 transition-colors hover:text-ink">
            <span className="mr-1 inline-block text-accent transition-transform group-open:rotate-90">▸</span>
            {moreLinks > 0 ? `Other ways to find it (${moreLinks})` : 'About this printing'}
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
                    status={shops?.get(link.provider)}
                  />
                ))}
              </div>
            )}
            {edition.previewUrl && (
              <a href={edition.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-accent hover:underline">
                Preview on Google Books
              </a>
            )}
            {/* Off in hobby mode (E20): the probe is not cleared for the public site (ROADMAP 0.1). */}
            {commerceEnabled() && edition.isbn13 && (
              <AvailabilityCheck
                isbn13={edition.isbn13}
                checked={!!shops}
                onResult={byProvider => setChecked({ key, byProvider })}
              />
            )}
            {shops && (
              <p className="text-xs leading-relaxed text-ink-3">
                Each shop was asked whether its page for this ISBN differs from its page for an ISBN
                that cannot exist. Only &ldquo;found it&rdquo; tells you anything: some shops refuse the
                question, and others build their results in the browser, where this check cannot follow.
                Nothing here is a stock check.
              </p>
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
        </details>
      )}

      {/*
        Julian, 2026-09-09: where a shop that could pay commission has a link
        to exactly this printing, that link wins and this row does not appear
        at all. It shows up only when no such link is possible — a foreign
        ISBN, or none — and it says plainly that it leads somewhere else.
      */}
      {plan.anyEdition.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="kicker">Or read it in another edition</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.anyEdition.map(link => (
              <a key={link.provider} href={link.url} target="_blank" rel="noopener noreferrer" className="btn">
                {link.label}
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            These search for &ldquo;{displayTitle(workTitle)}&rdquo; by title. Whatever they carry
            is a different printing from the one above, with a cover of its own.
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
function VerdictNote({ verdict, hint, lead = false }: { verdict: IsbnVerdict; hint: string; lead?: boolean }) {
  if (verdict.status === 'verified') {
    return (
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        <span className="text-ink-2">{VERDICT_LEAD.verified}</span>{' '}
        Shops list by number and mostly use that image, so a new copy should look like this.
      </p>
    );
  }
  if (verdict.status === 'differs') {
    return (
      <div className={`flex items-start gap-3 ${lead ? 'mb-4' : 'mt-2'}`}>
        <a href={`?cover=${encodeURIComponent(verdict.cover.id)}`} className="shrink-0" aria-label="See the publisher's current image for this ISBN">
          <span className="cover-shadow relative block h-20 w-[3.4rem] overflow-hidden rounded-[3px] bg-surface-2">
            <CoverImage src={verdict.cover.urlSmall ?? verdict.cover.url} alt="The publisher's current image for this ISBN" sizes="55px" />
          </span>
        </a>
        <p className="text-xs leading-relaxed text-ink-3">
          <span className="text-ink-2">{VERDICT_LEAD.differs}</span>{' '}
          It is the one beside this note, so that is what a new copy is likely to be.
          {/*
            When this note leads, the row underneath *is* the answer to it, so
            the sentence points at it instead of leaving the reader to work out
            which of the buttons hunts the picture they clicked.
          */}
          {lead
            ? hint
              ? ` The searches below look for ${hint} second-hand instead.`
              : ' The searches below look for this printing instead.'
            : hint ? ` To get the one on screen, look for ${hint} second-hand.` : ''}
        </p>
      </div>
    );
  }
  /*
    Not compared, so not judged: the picture goes beside the note and the
    reader decides (ROADMAP 6.32). The ISBN links keep their place — nothing
    has shown that the number ships another jacket.
  */
  if (verdict.status === 'uncompared') {
    return (
      <div className="mt-2 flex items-start gap-3">
        <a href={`?cover=${encodeURIComponent(verdict.cover.id)}`} className="shrink-0" aria-label="See the publisher's current image for this ISBN">
          <span className="cover-shadow relative block h-20 w-[3.4rem] overflow-hidden rounded-[3px] bg-surface-2">
            <CoverImage src={verdict.cover.urlSmall ?? verdict.cover.url} alt="The publisher's current image for this ISBN" sizes="55px" />
          </span>
        </a>
        <p className="text-xs leading-relaxed text-ink-3">
          <span className="text-ink-2">{VERDICT_LEAD.uncompared}</span>{' '}
          It is the one beside this note; if it looks like the cover on screen, a new copy probably will too.
        </p>
      </div>
    );
  }
  /*
    Everything that is not verified or differs used to fall through to the
    "no image on record" paragraph, including `pending` — so for the second
    or two while the lookup ran, the reader was told something we had not yet
    checked, and on a day with the Google quota spent it would have stood
    there permanently (2026-09-07).
  */
  if (verdict.status === 'pending') {
    return <p className="mt-2 text-xs leading-relaxed text-ink-3">{VERDICT_LEAD.pending}</p>;
  }
  if (verdict.status === 'unavailable') {
    return (
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        {VERDICT_LEAD.unavailable} Nothing can be said about which cover ships.
        {hint ? ` Look for ${hint}.` : ''}
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs leading-relaxed text-ink-3">
      {VERDICT_LEAD.unknown} Shops list by number and send the current printing.
      {hint ? ` Look for ${hint}.` : ''}
    </p>
  );
}

/**
 * One shop button.
 *
 * A link built from the ISBN goes through our own redirect, which counts the
 * click and rebuilds the target from the table, so it can never become an
 * open redirect (SPEC §10 C9). A search by title has no ISBN to count
 * against and is a plain link.
 */
function ShopLink({ link, isbn13, market, counted, status }: {
  link: BuyLink;
  isbn13?: string;
  market: Market;
  /** Built from the ISBN, so the counting redirect applies. */
  counted: boolean;
  status?: ShopStatus;
}) {
  return (
    <a
      href={counted && isbn13 ? trackedBuyHref(link.provider, isbn13, market) : link.url}
      target="_blank"
      // `sponsored` states a paid relationship; in hobby mode there is none (E20).
      rel={counted && commerceEnabled() ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
      className="btn"
      title={status ? SHOP_STATUS_TITLE[status] : shopLinkTitle(link)}
    >
      {link.label}
      {status ? (
        <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">{SHOP_STATUS_LABEL[status]}</span>
      ) : (
        link.kind === 'search' && <span className="ml-1 text-[10px] uppercase tracking-wide opacity-50">search</span>
      )}
    </a>
  );
}

/*
  What the button opens, as far as the URL itself says. `linkPlan` withdraws
  `kind` where the number was not issued in this market's registration area,
  so a foreign ISBN never gets "this book's page" written under it — that
  would be a claim about a shop nobody asked (ROADMAP 1.11 lever 3).
*/
function shopLinkTitle(link: BuyLink): string {
  if (link.kind === 'product') return `${link.label}: this book’s page`;
  if (link.kind === 'search') return `${link.label}: search results`;
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
export default function BookDetailPage() {
  return (
    <Suspense>
      <BookDetail />
    </Suspense>
  );
}

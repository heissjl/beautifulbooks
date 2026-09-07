'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import CoverGallery, { type CoverTab } from '@/components/CoverGallery';
import CoverImage from '@/components/CoverImage';
import LoadingStage from '@/components/LoadingStage';
import MarketSwitcher from '@/components/MarketSwitcher';
import SiteHeader from '@/components/SiteHeader';
import { flyCovers } from '@/components/flyCovers';
import { useLoadingScene } from '@/components/useLoadingScene';
import { useMarket } from '@/components/useMarket';
import { useIsbnCovers } from '@/components/useIsbnCovers';
import { useWorkPages } from '@/components/useWorkPages';
import { useWorkPreview } from '@/components/useWorkPreview';
import { searchLinksFor } from '@/lib/buylinks';
import type { Market } from '@/lib/market';
import type { Cover, EditionView } from '@/lib/model';
import { languageName } from '@/lib/normalize';
import type { ImageSignature } from '@/lib/imagesig';
import { leadLanguagesSettled, orderGroups, type MergedWork, type Truncation } from '@/lib/pages';
import { foldDuplicateCovers, groupCoversByLanguage, verifyIsbnCover, type IsbnVerdict } from '@/lib/works';

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-md py-1 pr-2 text-sm text-ink-2 transition-colors hover:text-ink">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Search
    </Link>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn py-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard unavailable: nothing to do, the URL is in the address bar.
        }
      }}
    >
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}

function Shell({ children, backHref, right }: { children: React.ReactNode; backHref: string; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader left={<BackLink href={backHref} />} right={right} />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">{children}</main>
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

  const covers = foldDuplicateCovers(all, signatures, merged.editions);
  const coversById = new Map(covers.map(c => [c.id, c]));
  const ordered = orderGroups(groupCoversByLanguage(covers, merged.editions, preferred, signatures), preferred);
  const groups: CoverTab[] = ordered.map(g => ({
    language: g.language,
    covers: g.coverIds.map(id => coversById.get(id)).filter((c): c is Cover => !!c),
  }));
  return { covers, coversById, groups };
}

/** The cover the URL points at, else the first one on the wall (SPEC F2.6). */
function selectCoverFrom(wall: ReturnType<typeof buildWall>, selectedId: string | null): Cover | null {
  const byId = wall.coversById.get(selectedId ?? '');
  if (byId) return byId;
  // A folded duplicate may be in the URL: resolve to its representative.
  const folded = wall.covers.find(c => c.similarIds?.includes(selectedId ?? ''));
  return folded ?? wall.groups[0]?.covers[0] ?? null;
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
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') ?? '';
  const backHref = backHrefFrom(searchParams);
  const preview = useWorkPreview(params.id);

  // Market for buy links (E9): the user's choice, else detected by the server.
  const [chosenMarket, setMarket] = useMarket();
  const requestKey = `${params.id} ${lang} ${chosenMarket ?? ''}`;

  // Editions arrive page by page and keep arriving while the user looks
  // around (SPEC §9.3 step 11).
  const pages = useWorkPages(params.id, lang, chosenMarket);

  // The selected cover lives in the URL (?cover=) so it can be shared (SPEC F2.6).
  const selectedId = searchParams.get('cover');

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

  // Which ISBN to ask about is decided on the catalogue alone. Retail covers
  // never change *which edition* is being looked at, and deriving the
  // question from an answer that depends on it would chase its own tail.
  const lookupIsbns = useMemo(() => {
    if (!pages.merged) return [];
    const wall = buildWall(pages.merged, [], new Map(), lang || undefined);
    const cover = selectCoverFrom(wall, selectedId);
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
  const scene = useLoadingScene(requestKey, pages.firstCovers, pages.page0Hashed);

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

  // Hold the scene until the pinned tabs can no longer appear underneath the
  // reader's cursor: English present, everything loaded, or three pages in,
  // whichever comes first (Julian 2026-09-07).
  const tabsSettled = !view || leadLanguagesSettled(view.groups, view.merged.done || view.merged.checked >= 300);
  const inScene = pages.status === 'loading' || (pages.status === 'ready' && (!scene.done || !tabsSettled));

  // When the scene ends, fly the staged covers to their gallery tiles.
  const flownFor = useRef('');
  useEffect(() => {
    if (inScene || !view || scene.staged.length === 0 || flownFor.current === requestKey) return;
    flownFor.current = requestKey;
    const raf = requestAnimationFrame(() => flyCovers(scene.staged));
    return () => cancelAnimationFrame(raf);
  }, [inScene, view, scene.staged, requestKey]);

  const selected = useMemo<Cover | null>(() => (view ? selectCoverFrom(view, selectedId) : null), [view, selectedId]);


  if (pages.status === 'notfound' || pages.status === 'error') {
    return (
      <Shell backHref={backHref}>
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
      <Shell backHref={backHref}>
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
  const meta = [
    work.firstPublishYear ? `first published ${work.firstPublishYear}` : undefined,
    progressLabel(view.covers.length, merged),
  ].filter(Boolean).join(' · ');

  return (
    <Shell backHref={backHref} right={<ShareButton />}>
      <TitleBlock title={work.title} authors={work.authors} meta={meta} />
      <ScanProgress checked={merged.checked} total={merged.total} done={merged.done} />

      {view.groups.length === 0 ? (
        <p className="text-ink-2">No cover images were found for this book.</p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-2">
            <CoverGallery
              groups={view.groups}
              selectedCover={selected}
              onSelectCover={c => selectCover(c.id)}
              captions={view.captions}
            />
            <p className="mt-6 max-w-prose text-xs leading-relaxed text-ink-3">
              Covers come from Open Library and Google Books. Most edition records carry no
              scan, so a book has had covers that neither catalogue knows.
            </p>
          </div>
          <aside className="lg:sticky lg:top-20 lg:self-start">
            {selected && (
              <CoverDetails
                cover={selected}
                editions={selected.editionIds.map(id => view.editionsById.get(id)).filter((e): e is EditionView => !!e)}
                coversPerEdition={view.coversPerEdition}
                author={work.authors[0]}
                market={view.market}
                onMarketChange={setMarket}
                verdictFor={isbn13 => verifyIsbnCover(
                  selected,
                  isbnCovers.byIsbn.get(isbn13) ?? [],
                  view.covers,
                  isbnCovers.asked.has(isbn13),
                )}
              />
            )}
          </aside>
        </div>
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
  author?: string;
  market: Market;
  onMarketChange: (market: Market) => void;
  /** What a shop shows for an ISBN, compared with the cover on screen. */
  verdictFor: (isbn13: string) => IsbnVerdict;
}

function CoverDetails({ cover, editions, coversPerEdition, author, market, onMarketChange, verdictFor }: CoverDetailsProps) {
  return (
    <div>
      <div className="cover-shadow relative mx-auto aspect-[2/3] max-w-xs overflow-hidden rounded-card bg-surface-2 lg:mx-0 lg:max-w-none">
        <CoverImage src={cover.url} alt="Selected cover" sizes="(max-width: 1024px) 320px, 30vw" priority />
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Image from {cover.source === 'openlibrary' ? 'Open Library' : 'Google Books'}
        {editions.length > 1 ? ` · on ${editions.length} editions` : ''}
        {cover.similarIds?.length ? ` · ${cover.similarIds.length} duplicate scan${cover.similarIds.length > 1 ? 's' : ''} folded` : ''}
      </p>

      <div className="mt-6 space-y-8">
        {editions.map(edition => (
          <EditionBlock
            key={edition.id}
            edition={edition}
            otherCovers={(coversPerEdition.get(edition.id) ?? 1) - 1}
            searchLinks={searchLinksFor({ title: edition.title, author, publisher: edition.publisher, year: edition.year, coverUrl: cover.url, editionId: edition.id }, market)}
            market={market}
            onMarketChange={onMarketChange}
            verdict={edition.isbn13 ? verdictFor(edition.isbn13) : { status: 'unknown' }}
          />
        ))}
      </div>
    </div>
  );
}

interface EditionBlockProps {
  edition: EditionView;
  otherCovers: number;
  searchLinks: EditionView['buyLinks'];
  market: Market;
  onMarketChange: (market: Market) => void;
  verdict: IsbnVerdict;
}

function EditionBlock({ edition, otherCovers, searchLinks, market, onMarketChange, verdict }: EditionBlockProps) {
  const rows: Array<[string, string | undefined]> = [
    ['Title', edition.title],
    ['Published', edition.publishedDate],
    ['Publisher', edition.publisher],
    ['Format', edition.format],
    ['Pages', edition.pageCount ? String(edition.pageCount) : undefined],
    ['Language', languageName(edition.language)],
    ['ISBN', edition.isbn13],
    ['Also printed with', otherCovers > 0 ? `${otherCovers} other cover${otherCovers > 1 ? 's' : ''}` : undefined],
  ];
  const hint = [edition.publisher, edition.year].filter(Boolean).join(' ');
  // When the shop shows another jacket, the searches that find *this* one
  // matter more than the ISBN links, so they go first (SPEC §9.3 step 13).
  const buyFirst = verdict.status !== 'differs';
  return (
    <div>
      <dl className="divide-y divide-line border-y border-line text-sm">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2">
            <dt className="text-ink-3">{k}</dt>
            <dd className={`text-ink ${k === 'ISBN' ? 'font-mono text-[13px]' : ''}`}>{v}</dd>
          </div>
        ))}
      </dl>

      {edition.description && (
        <p className="mt-4 line-clamp-6 text-sm leading-relaxed text-ink-2">{edition.description}</p>
      )}

      {buyFirst ? (
        <>
          <BuyBlock edition={edition} hint={hint} verdict={verdict} market={market} onMarketChange={onMarketChange} />
          <SearchBlock links={searchLinks} lead={false} />
        </>
      ) : (
        <>
          <SearchBlock links={searchLinks} lead />
          <BuyBlock edition={edition} hint={hint} verdict={verdict} market={market} onMarketChange={onMarketChange} />
        </>
      )}

      {edition.previewUrl && (
        <a href={edition.previewUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-accent hover:underline">
          Preview on Google Books
        </a>
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
function VerdictNote({ verdict, hint }: { verdict: IsbnVerdict; hint: string }) {
  if (verdict.status === 'verified') {
    return (
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        <span className="text-ink-2">The publisher&rsquo;s current image for this ISBN is this cover.</span>{' '}
        Shops list by number and mostly use that image, so a new copy should look like this.
      </p>
    );
  }
  if (verdict.status === 'differs') {
    return (
      <div className="mt-2 flex items-start gap-3">
        <a href={`?cover=${encodeURIComponent(verdict.cover.id)}`} className="shrink-0" aria-label="See the publisher's current image for this ISBN">
          <span className="cover-shadow relative block h-20 w-[3.4rem] overflow-hidden rounded-[3px] bg-surface-2">
            <CoverImage src={verdict.cover.urlSmall ?? verdict.cover.url} alt="The publisher's current image for this ISBN" sizes="55px" />
          </span>
        </a>
        <p className="text-xs leading-relaxed text-ink-3">
          <span className="text-ink-2">The publisher&rsquo;s current image for this ISBN is a different cover.</span>{' '}
          It is the one beside this note, so that is what a new copy is likely to be.
          {hint ? ` To get the one on screen, look for ${hint} second-hand.` : ''}
        </p>
      </div>
    );
  }
  return (
    <p className="mt-2 text-xs leading-relaxed text-ink-3">
      No current publisher image is on record for this ISBN, so we cannot say which cover ships.
      Shops list by number and send the current printing.{hint ? ` Look for ${hint}.` : ''}
    </p>
  );
}

function BuyBlock({ edition, hint, verdict, market, onMarketChange }: {
  edition: EditionView;
  hint: string;
  verdict: IsbnVerdict;
  market: Market;
  onMarketChange: (market: Market) => void;
}) {
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="kicker">{edition.isbn13 ? 'Buy this ISBN' : 'No ISBN on record'}</p>
        <MarketSwitcher market={market} onChange={onMarketChange} compact />
      </div>
      {edition.buyLinks.length > 0 ? (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {edition.buyLinks.map(link => (
              <a key={link.provider} href={link.url} target="_blank" rel="noopener noreferrer sponsored" className="btn">
                {link.label}
              </a>
            ))}
          </div>
          <VerdictNote verdict={verdict} hint={hint} />
        </>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          This edition predates ISBNs or has none on record, so shops cannot look it up directly. Use the searches below.
        </p>
      )}
    </div>
  );
}

function SearchBlock({ links, lead }: { links: EditionView['buyLinks']; lead: boolean }) {
  return (
    <div className="mt-5">
      <p className="kicker">Find this exact cover</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {links.map(link => (
          <a key={link.provider} href={link.url} target="_blank" rel="noopener noreferrer" className="btn">
            {link.label}
          </a>
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        {lead
          ? 'These search for the printing shown above by title, publisher and year, or by the cover image itself.'
          : 'Title, publisher and year at antiquarian and auction sites; Google Lens and TinEye search by the cover image.'}
      </p>
    </div>
  );
}

export default function BookDetailPage() {
  return (
    <Suspense>
      <BookDetail />
    </Suspense>
  );
}

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
import { useWorkPreview } from '@/components/useWorkPreview';
import { searchLinksFor } from '@/lib/buylinks';
import type { Market } from '@/lib/market';
import type { Cover, EditionView } from '@/lib/model';
import { languageName } from '@/lib/normalize';
import type { WorkDetailResponse } from '@/app/api/works/[id]/route';

type Loaded =
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | { status: 'fast'; data: WorkDetailResponse }
  | { status: 'full'; data: WorkDetailResponse };

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
  const [loaded, setLoaded] = useState<{ key: string; state: Loaded } | null>(null);


  // The selected cover lives in the URL (?cover=) so it can be shared (SPEC F2.6).
  const selectedId = searchParams.get('cover');
  const selectCover = (coverId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('cover', coverId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKey;
    const query = new URLSearchParams();
    if (lang) query.set('lang', lang);
    if (chosenMarket) query.set('market', chosenMarket);
    const base = `/api/works/${encodeURIComponent(params.id)}`;
    const url = (stage: 'fast' | 'full') => `${base}?${new URLSearchParams({ ...Object.fromEntries(query), stage })}`;

    const load = async (stage: 'fast' | 'full'): Promise<WorkDetailResponse | null> => {
      const res = await fetch(url(stage), { signal: controller.signal });
      if (res.status === 404 || res.status === 400) { setLoaded({ key, state: { status: 'notfound' } }); return null; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
      return (await res.json()) as WorkDetailResponse;
    };

    (async () => {
      try {
        const fast = await load('fast');
        if (!fast || controller.signal.aborted) return;
        setLoaded({ key, state: { status: 'fast', data: fast } });
        const full = await load('full');
        if (!full || controller.signal.aborted) return;
        setLoaded({ key, state: { status: 'full', data: full } });
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoaded({ key, state: { status: 'error', message: err instanceof Error ? err.message : 'Request failed' } });
      }
    })();

    return () => controller.abort();
  }, [params.id, lang, chosenMarket, requestKey]);

  const state = useMemo<Loaded | { status: 'loading' }>(
    () => (loaded?.key === requestKey ? loaded.state : { status: 'loading' }),
    [loaded, requestKey],
  );

  // Loading scene (SPEC 8.1): paced by the hook; runs at least two covers long.
  const sceneCovers = state.status === 'fast' || state.status === 'full' ? state.data.covers : null;
  const scene = useLoadingScene(requestKey, sceneCovers, state.status === 'full');
  const inScene = state.status === 'loading' || ((state.status === 'fast' || state.status === 'full') && !scene.done);

  const view = useMemo(() => {
    if (state.status !== 'fast' && state.status !== 'full') return null;
    const { data } = state;
    const editionsById = new Map(data.editions.map(e => [e.id, e]));
    const coversById = new Map(data.covers.map(c => [c.id, c]));
    const groups: CoverTab[] = data.groups.map(g => ({
      language: g.language,
      covers: g.coverIds.map(id => coversById.get(id)).filter((c): c is Cover => !!c),
    }));
    const captions = new Map(data.covers.map(c => [c.id, captionFor(c, editionsById)]));
    // How many covers each edition appears with (to flag reprints, SPEC F2.5).
    const coversPerEdition = new Map<string, number>();
    for (const c of data.covers) for (const id of c.editionIds) coversPerEdition.set(id, (coversPerEdition.get(id) ?? 0) + 1);
    return { data, editionsById, coversById, groups, captions, coversPerEdition };
  }, [state]);

  // When the scene ends, fly the staged covers to their gallery tiles.
  const flownFor = useRef('');
  useEffect(() => {
    if (inScene || !view || scene.staged.length === 0 || flownFor.current === requestKey) return;
    flownFor.current = requestKey;
    const raf = requestAnimationFrame(() => flyCovers(scene.staged));
    return () => cancelAnimationFrame(raf);
  }, [inScene, view, scene.staged, requestKey]);

  const selected = useMemo<Cover | null>(() => {
    if (!view) return null;
    const byId = view.coversById.get(selectedId ?? '');
    if (byId) return byId;
    // A folded duplicate may be in the URL: resolve to its representative.
    const folded = view.data.covers.find(c => c.similarIds?.includes(selectedId ?? ''));
    return folded ?? view.groups[0]?.covers[0] ?? null;
  }, [view, selectedId]);

  if (state.status === 'notfound' || state.status === 'error') {
    return (
      <Shell backHref={backHref}>
        <div className="py-24 text-center">
          <p className="font-display text-2xl text-ink">
            {state.status === 'notfound' ? 'Book not found' : state.message}
          </p>
          <Link href={backHref} className="mt-4 inline-block text-sm text-accent hover:underline">Back to search</Link>
        </div>
      </Shell>
    );
  }

  if (inScene || !view) {
    const work = view?.data.work;
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
          expected={view?.data.covers.length}
        />
      </Shell>
    );
  }

  const { work } = view.data;
  const meta = [
    work.editionCount ? `${work.editionCount.toLocaleString('en')} editions` : undefined,
    work.firstPublishYear ? `first published ${work.firstPublishYear}` : undefined,
    `${view.data.covers.length} covers${state.status === 'fast' ? ', tidying duplicates' : ''}`,
  ].filter(Boolean).join(' · ');

  return (
    <Shell backHref={backHref} right={<ShareButton />}>
      <TitleBlock title={work.title} authors={work.authors} meta={meta} />

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
          </div>
          <aside className="lg:sticky lg:top-20 lg:self-start">
            {selected && (
              <CoverDetails
                cover={selected}
                editions={selected.editionIds.map(id => view.editionsById.get(id)).filter((e): e is EditionView => !!e)}
                coversPerEdition={view.coversPerEdition}
                author={work.authors[0]}
                market={view.data.market}
                onMarketChange={setMarket}
              />
            )}
          </aside>
        </div>
      )}
    </Shell>
  );
}

interface CoverDetailsProps {
  cover: Cover;
  editions: EditionView[];
  coversPerEdition: ReadonlyMap<string, number>;
  author?: string;
  market: Market;
  onMarketChange: (market: Market) => void;
}

function CoverDetails({ cover, editions, coversPerEdition, author, market, onMarketChange }: CoverDetailsProps) {
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
}

function EditionBlock({ edition, otherCovers, searchLinks, market, onMarketChange }: EditionBlockProps) {
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

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="kicker">{edition.isbn13 ? 'Buy this ISBN' : 'No ISBN on record'}</p>
          <MarketSwitcher market={market} onChange={onMarketChange} compact />
        </div>
        {edition.buyLinks.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {edition.buyLinks.map(link => (
              <a key={link.provider} href={link.url} target="_blank" rel="noopener noreferrer sponsored" className="btn">
                {link.label}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            This edition predates ISBNs or has none on record, so shops cannot look it up directly. Use the searches below.
          </p>
        )}
        {edition.buyLinks.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            Sellers list by ISBN and ship the current printing, so the cover may differ from the one shown.
            {hint ? ` Look for ${hint}.` : ''}
          </p>
        )}
      </div>

      <div className="mt-5">
        <p className="kicker">Find this exact cover</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {searchLinks.map(link => (
            <a key={link.provider} href={link.url} target="_blank" rel="noopener noreferrer" className="btn">
              {link.label}
            </a>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          Title, publisher and year at antiquarian and auction sites; Google Lens and TinEye search by the cover image.
        </p>
      </div>

      {edition.previewUrl && (
        <a href={edition.previewUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-accent hover:underline">
          Preview on Google Books
        </a>
      )}
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

'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import CoverGallery, { type CoverTab } from '@/components/CoverGallery';
import CoverImage from '@/components/CoverImage';
import SiteHeader from '@/components/SiteHeader';
import type { Cover, EditionView } from '@/lib/model';
import { languageName } from '@/lib/normalize';
import type { WorkDetailResponse } from '@/app/api/works/[id]/route';

type State =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | { status: 'done'; data: WorkDetailResponse };

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

function Skeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading book">
      <div className="h-10 w-1/2 rounded bg-surface-2"></div>
      <div className="mt-3 h-5 w-1/4 rounded bg-surface-2"></div>
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:col-span-2">
          {[...Array(8)].map((_, i) => <div key={i} className="aspect-[2/3] rounded-card bg-surface-2"></div>)}
        </div>
        <div className="aspect-[2/3] rounded-card bg-surface-2"></div>
      </div>
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

  const requestKey = `${params.id} ${lang}`;
  const [loaded, setLoaded] = useState<{ key: string; state: State } | null>(null);

  // The selected cover lives in the URL (?cover=) so it can be shared (SPEC F2.6).
  const selectedId = searchParams.get('cover');
  const selectCover = (coverId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('cover', coverId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const controller = new AbortController();
    const qs = lang ? `?lang=${encodeURIComponent(lang)}` : '';
    fetch(`/api/works/${encodeURIComponent(params.id)}${qs}`, { signal: controller.signal })
      .then(async res => {
        if (res.status === 404 || res.status === 400) return setLoaded({ key: requestKey, state: { status: 'notfound' } });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
        setLoaded({ key: requestKey, state: { status: 'done', data: (await res.json()) as WorkDetailResponse } });
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setLoaded({ key: requestKey, state: { status: 'error', message: err instanceof Error ? err.message : 'Request failed' } });
      });
    return () => controller.abort();
  }, [params.id, lang, requestKey]);

  const state = useMemo<State>(
    () => (loaded?.key === requestKey ? loaded.state : { status: 'loading' }),
    [loaded, requestKey],
  );

  const view = useMemo(() => {
    if (state.status !== 'done') return null;
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

  const selected = useMemo<Cover | null>(() => {
    if (!view) return null;
    return view.coversById.get(selectedId ?? '') ?? view.groups[0]?.covers[0] ?? null;
  }, [view, selectedId]);

  if (state.status === 'loading') return <Shell backHref={backHref}><Skeleton /></Shell>;

  if (state.status === 'notfound' || state.status === 'error' || !view) {
    return (
      <Shell backHref={backHref}>
        <div className="py-24 text-center">
          <p className="font-display text-2xl text-ink">
            {state.status === 'notfound' ? 'Book not found' : state.status === 'error' ? state.message : 'Nothing to show'}
          </p>
          <Link href={backHref} className="mt-4 inline-block text-sm text-accent hover:underline">Back to search</Link>
        </div>
      </Shell>
    );
  }

  const { work } = view.data;
  const meta = [
    work.editionCount ? `${work.editionCount.toLocaleString('en')} editions` : undefined,
    work.firstPublishYear ? `first published ${work.firstPublishYear}` : undefined,
    `${view.data.covers.length} covers`,
  ].filter(Boolean).join(' · ');

  return (
    <Shell backHref={backHref} right={<ShareButton />}>
      <div className="mb-8 max-w-3xl">
        <h1 className="text-4xl leading-[1.05] text-ink sm:text-5xl">{work.title}</h1>
        <p className="mt-3 text-lg text-ink-2">{work.authors.join(', ')}</p>
        <p className="mt-1 text-sm text-ink-3">{meta}</p>
      </div>

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
              />
            )}
          </aside>
        </div>
      )}
    </Shell>
  );
}

function CoverDetails({ cover, editions, coversPerEdition }: { cover: Cover; editions: EditionView[]; coversPerEdition: ReadonlyMap<string, number> }) {
  return (
    <div>
      <div className="cover-shadow relative mx-auto aspect-[2/3] max-w-xs overflow-hidden rounded-card bg-surface-2 lg:mx-0 lg:max-w-none">
        <CoverImage src={cover.url} alt="Selected cover" sizes="(max-width: 1024px) 320px, 30vw" priority />
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Image from {cover.source === 'openlibrary' ? 'Open Library' : 'Google Books'}
        {editions.length > 1 ? ` · on ${editions.length} editions` : ''}
      </p>

      <div className="mt-6 space-y-8">
        {editions.map(edition => (
          <EditionBlock key={edition.id} edition={edition} otherCovers={(coversPerEdition.get(edition.id) ?? 1) - 1} />
        ))}
      </div>
    </div>
  );
}

function EditionBlock({ edition, otherCovers }: { edition: EditionView; otherCovers: number }) {
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

      {edition.buyLinks.length > 0 && (
        <div className="mt-5">
          <p className="kicker">Find copies of this ISBN</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {edition.buyLinks.map(link => (
              <a key={link.provider} href={link.url} target="_blank" rel="noopener noreferrer sponsored" className="btn">
                {link.label}
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            Sellers list by ISBN and ship the current printing, so the cover may differ from the one shown.
            {edition.publisher || edition.year ? ` Look for ${[edition.publisher, edition.year].filter(Boolean).join(' ')}.` : ''}
          </p>
        </div>
      )}

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

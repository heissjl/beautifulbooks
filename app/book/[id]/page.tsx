'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import EditionsByLanguage, { type LanguageTab } from '@/components/EditionsByLanguage';
import type { EditionView } from '@/lib/model';
import { languageName } from '@/lib/normalize';
import type { WorkDetailResponse } from '@/app/api/works/[id]/route';

type State =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | { status: 'done'; data: WorkDetailResponse };

function Shell({ children, backHref }: { children: React.ReactNode; backHref: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <header className="border-b border-amber-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href={backHref} className="flex items-center gap-2 text-gray-600 hover:text-amber-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to search
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/2 mb-3"></div>
      <div className="h-6 bg-gray-200 rounded w-1/4 mb-8"></div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        {[...Array(12)].map((_, i) => <div key={i} className="aspect-[2/3] bg-gray-200 rounded-lg"></div>)}
      </div>
      <div className="bg-gray-200 rounded-2xl h-96"></div>
    </div>
  );
}

function BookDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') ?? '';
  const backHref = lang ? `/?lang=${lang}` : '/';

  const requestKey = `${params.id}\u0000${lang}`;
  const [loaded, setLoaded] = useState<{ key: string; state: State } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const groups = useMemo<LanguageTab[]>(() => {
    if (state.status !== 'done') return [];
    const byId = new Map(state.data.editions.map(e => [e.id, e]));
    return state.data.groups.map(g => ({
      language: g.language,
      editions: g.editionIds.map(id => byId.get(id)).filter((e): e is EditionView => !!e),
    }));
  }, [state]);

  const selected = useMemo<EditionView | null>(() => {
    if (state.status !== 'done') return null;
    return state.data.editions.find(e => e.id === selectedId) ?? groups[0]?.editions[0] ?? null;
  }, [state, selectedId, groups]);

  if (state.status === 'loading') return <Shell backHref={backHref}><Skeleton /></Shell>;

  if (state.status === 'notfound' || state.status === 'error') {
    return (
      <Shell backHref={backHref}>
        <div className="text-center py-20">
          <p className="text-gray-700 text-lg">
            {state.status === 'notfound' ? 'Book not found' : state.message}
          </p>
          <Link href={backHref} className="inline-block mt-4 text-amber-600 hover:text-amber-700">Return to search</Link>
        </div>
      </Shell>
    );
  }

  const { work } = state.data;

  return (
    <Shell backHref={backHref}>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{work.title}</h1>
        <p className="text-xl text-gray-600">by {work.authors.join(', ')}</p>
        {work.editionCount && (
          <p className="text-sm text-gray-500 mt-1">
            {work.editionCount} editions known{work.firstPublishYear ? `, first published ${work.firstPublishYear}` : ''}
          </p>
        )}
      </div>

      {groups.length > 0 ? (
        <div className="mb-8">
          <EditionsByLanguage groups={groups} selectedEdition={selected} onSelectEdition={e => setSelectedId(e.id)} />
        </div>
      ) : (
        <p className="text-gray-600 mb-8">No editions with cover images were found for this book.</p>
      )}

      {selected && <EditionDetails edition={selected} />}
    </Shell>
  );
}

function EditionDetails({ edition }: { edition: EditionView }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden">
      <div className="p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Edition Details</h2>
        <div className="grid md:grid-cols-5 gap-8">
          <div className="md:col-span-2">
            <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-xl sticky top-24">
              <Image src={edition.coverUrl} alt={`${edition.title} cover`} fill sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" unoptimized priority />
            </div>
          </div>

          <div className="md:col-span-3 space-y-6">
            <div className="grid grid-cols-2 gap-4 p-6 bg-amber-50 rounded-xl">
              {edition.title && <Field label="Title" value={edition.title} />}
              {edition.publishedDate && <Field label="Published" value={edition.publishedDate} />}
              {edition.publisher && <Field label="Publisher" value={edition.publisher} />}
              {edition.pageCount && <Field label="Pages" value={String(edition.pageCount)} />}
              {edition.isbn13 && <Field label="ISBN" value={edition.isbn13} mono />}
              {edition.format && <Field label="Format" value={edition.format} />}
              <Field label="Language" value={languageName(edition.language)} />
              <Field label="Source" value={edition.source === 'openlibrary' ? 'Open Library' : 'Google Books'} />
            </div>

            {edition.description && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <p className="text-gray-700 leading-relaxed">{edition.description}</p>
              </div>
            )}

            {edition.buyLinks.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Find this edition</h3>
                <div className="flex flex-wrap gap-3">
                  {edition.buyLinks.map(link => (
                    <a
                      key={link.provider}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md hover:shadow-lg font-medium"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {edition.previewUrl && (
              <div className="pt-4 border-t border-gray-200">
                <a href={edition.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium">
                  Preview on Google Books
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
      <p className={`text-gray-900 font-semibold ${mono ? 'font-mono text-sm' : ''}`}>{value}</p>
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

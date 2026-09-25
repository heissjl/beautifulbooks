import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CoverWall from '@/components/CoverWall';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { allCollections, authorsShown, collectionBySlug, coverLine } from '@/lib/collections';
import { SITE_URL } from '@/lib/seo';

/**
 * One thematic collection (ROADMAP 5.10, SPEC F8): a title, a paragraph and
 * a wall of hand-picked covers, each leading to its book's own wall.
 *
 * Everything comes from `data/collections.json`, so the page is built once
 * and asks nobody anything; the covers load in the browser like the home
 * page's. Only the slugs the file knows exist — anything else is a 404, and
 * so is a draft on a production build.
 */
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return allCollections().map(c => ({ slug: c.slug }));
}

/** "A, B and C" — or "A, B and 4 more" once the list stops being readable. */
function nameLine(names: string[], max = 4): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, max - 1).join(', ')} and ${names.length - (max - 1)} more`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const c = collectionBySlug(slug);
  if (!c) return {};
  // Authors only: a series' scope is publishers, and "73 books by Gollancz" named them as writers (2026-09-25).
  const names = c.kind === 'authors' ? authorsShown(c) : [];
  const description = `${c.works.length} ${c.works.length === 1 ? 'book' : 'books'}${names.length ? ` by ${nameLine(names)}` : ''}, ${coverLine(c.kind)}. ${c.intro}`.slice(0, 300);
  return {
    title: c.title,
    description,
    alternates: { canonical: `${SITE_URL}/collections/${c.slug}` },
    openGraph: { type: 'website', title: c.title, description, url: `${SITE_URL}/collections/${c.slug}` },
    ...(c.published ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug } = await params;
  const c = collectionBySlug(slug);
  if (!c) notFound();
  const names = c.kind === 'authors' ? authorsShown(c) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        left={
          <Link href="/collections" className="rounded-md py-1 pr-2 text-sm text-ink-2 transition-colors hover:text-ink">
            ← Collections
          </Link>
        }
        search={<HeaderSearch />}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        {!c.published && (
          <p className="mb-6 inline-block rounded-md border border-accent/40 px-3 py-1 text-xs text-accent">
            Draft — visible under <code>next dev</code> only
          </p>
        )}
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">{c.title}</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">{c.intro}</p>
        {/*
          What the wall holds, counted from the file — never "all" or "the
          best" (CLAUDE.md, SPEC §9.3 step 15). For an author collection the
          line names only authors with a book on the wall.
        */}
        <p className="mt-3 text-sm text-ink-3">
          {c.works.length} {c.works.length === 1 ? 'book' : 'books'}
          {names.length > 0 && <> by {names.length} {names.length === 1 ? 'author' : 'authors'}</>}
          , {coverLine(c.kind)}.
        </p>
        <div className="mt-8">
          <CoverWall works={c.works} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

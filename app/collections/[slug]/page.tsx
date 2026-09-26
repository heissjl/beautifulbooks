import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CoverWall from '@/components/CoverWall';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { authorsShown, coverLine } from '@/lib/collections';
import { liveCollectionBySlug } from '@/lib/collections-live';
import { SITE_URL } from '@/lib/seo';
import { friendSignedIn } from '@/lib/suggest/session';

/**
 * One thematic collection (ROADMAP 5.10, SPEC F8): a title, a paragraph and
 * a wall of hand-picked covers, each leading to its book's own wall.
 *
 * Everything comes from `data/collections.json`, so the page is built once
 * and asks nobody anything; the covers load in the browser like the home
 * page's. Only the slugs the file knows exist — anything else is a 404.
 *
 * **A draft in production is shown only to a signed-in friend** (Julian,
 * 2026-09-25: „have the drafts also in production for the curation behind
 * login"). So the page renders on every request and reads the /curate
 * cookie; a draft is a 404 without it and never indexed. Built ahead with
 * `generateStaticParams`, reading the cookie made every draft a 500 in the
 * production build (DYNAMIC_SERVER_USAGE, measured 2026-09-25) — rendering
 * per request costs nothing external, the file is read in memory.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** The published collection, or — for a signed-in friend only — the draft. */
async function findCollection(slug: string) {
  const visible = await liveCollectionBySlug(slug);
  if (visible) return visible;
  return (await friendSignedIn()) ? liveCollectionBySlug(slug, { includeDrafts: true }) : null;
}


/** "A, B and C" — or "A, B and 4 more" once the list stops being readable. */
function nameLine(names: string[], max = 4): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, max - 1).join(', ')} and ${names.length - (max - 1)} more`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const c = await findCollection(slug);
  if (!c) return {};
  // Authors only: a series' scope is publishers, and "73 books by Gollancz" named them as writers (2026-09-25).
  const names = c.kind === 'authors' ? authorsShown(c) : [];
  const description = `${c.works.length} ${c.works.length === 1 ? 'book' : 'books'}${names.length ? ` by ${nameLine(names)}` : ''}, ${coverLine(c.kind, c.coverSource)}. ${c.intro}`.slice(0, 300);
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
  const c = await findCollection(slug);
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
            Draft — not on the public site; visible under <code>next dev</code> and to friends signed in on /curate
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
          , {coverLine(c.kind, c.coverSource)}.
        </p>
        <div className="mt-8">
          <CoverWall works={c.works} />
        </div>
        {/*
          The source of the cover credits, required by its licence (CC BY 4.0)
          and by N12: the names are ISFDB's, for the printing shown, and a tile
          without a name means ISFDB names nobody for it, not that nobody made it.
        */}
        {c.coverCredits === 'isfdb' && (
          <p className="mt-10 max-w-2xl text-xs text-ink-3">
            Cover artists as named by the{' '}
            <a href="https://www.isfdb.org/" className="underline underline-offset-2 hover:text-accent">Internet Speculative Fiction Database</a>{' '}
            for the printing shown (<a href="https://creativecommons.org/licenses/by/4.0/" className="underline underline-offset-2 hover:text-accent">CC BY 4.0</a>). Where a tile names nobody, ISFDB does not credit that printing, or credits several artists.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

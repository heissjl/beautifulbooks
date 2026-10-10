import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CoverWall from '@/components/CoverWall';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import WallsInvite from '@/components/WallsInvite';
import { wallsEnabled } from '@/lib/walls/switch';
import SiteHeader from '@/components/SiteHeader';
import BackLink from '@/components/BackLink';
import { authorsShown, coverLine } from '@/lib/collections';
import { liveCollectionBySlug } from '@/lib/collections-live';
import { SITE_URL } from '@/lib/seo';
import { friendSignedIn } from '@/lib/suggest/session';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/server';
import { type Translate } from '@/lib/i18n/translate';
import { measure } from '@/app/api/measure';
import { introParts, introText } from '@/lib/introlinks';

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
  /** Set by the German tree (ROADMAP 6.85); Next itself passes none. */
  locale?: Locale;
}

/** The published collection, or — for a signed-in friend only — the draft. */
async function findCollection(slug: string) {
  const visible = await liveCollectionBySlug(slug);
  if (visible) return visible;
  return (await friendSignedIn()) ? liveCollectionBySlug(slug, { includeDrafts: true }) : null;
}


/** "A, B and C" — or "A, B and 4 more" once the list stops being readable. */
function nameLine(names: string[], max = 4, t: Translate = translator(DEFAULT_LOCALE)): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= max) return t('{list} and {last}', { list: names.slice(0, -1).join(', '), last: names[names.length - 1] });
  return t('{list} and {n} more', { list: names.slice(0, max - 1).join(', '), n: names.length - (max - 1) });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const c = await findCollection(slug);
  if (!c) return {};
  // Authors only: a series' scope is publishers, and "73 books by Gollancz" named them as writers (2026-09-25).
  const names = c.kind === 'authors' ? authorsShown(c) : [];
  const description = `${c.works.length} ${c.works.length === 1 ? 'book' : 'books'}${names.length ? ` by ${nameLine(names)}` : ''}, ${coverLine(c.kind, c.coverSource, c.works.filter(w => w.image).length, c.scope)}. ${introText(c.intro)}`.slice(0, 300);
  return {
    title: c.title,
    description,
    alternates: { canonical: `${SITE_URL}/collections/${c.slug}` },
    // The image is the collection's own card, opengraph-image.tsx beside this file.
    openGraph: { type: 'website', title: c.title, description, url: `${SITE_URL}/collections/${c.slug}` },
    ...(c.published ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function CollectionPage({ params, locale = DEFAULT_LOCALE }: PageProps) {
  measure('page-collections');
  const t = translator(locale);
  const { slug } = await params;
  const c = await findCollection(slug);
  if (!c) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        left={<BackLink href="/collections" label={t('Collections')} />}
        search={<HeaderSearch />}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        {!c.published && (
          <p className="mb-6 inline-block rounded-md border border-accent/40 px-3 py-1 text-xs text-accent">
            {t('Draft — not on the public site; visible under')} <code>next dev</code> {t('and to friends signed in on /curate')}
          </p>
        )}
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">{c.title}</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          {introParts(c.intro).map((p, i) => ('href' in p
            ? <a key={i} href={p.href} rel="noopener" className="underline decoration-ink-3 underline-offset-2 hover:text-ink">{p.label}</a>
            : p.text))}
        </p>
        {/*
          No count line under the intro (Julian, 2026-10-05: „kill the
          sub-header"; Jules Verne lost it on 2026-09-26). The metadata keeps
          the count and how the covers were chosen.
        */}
        <div className="mt-8">
          <CoverWall works={c.works} selectCover setSize={c.setSize} tall={c.tileShape === 'tall'} from={{ href: `/collections/${c.slug}`, title: c.title }} />
        </div>
        {/* Under a wall someone else chose: the way to one's own (5.13b). */}
        {wallsEnabled() && <WallsInvite className="mt-8">{t('Create your own collection — from any cover, or from a photo of your shelf')}</WallsInvite>}
        {/*
          The source of the cover credits, required by its licence (CC BY 4.0)
          and by N12: the names are ISFDB's, for the printing shown, and a tile
          without a name means ISFDB names nobody for it, not that nobody made it.
        */}
        {c.coverCredits === 'isfdb' && (
          <p className="mt-10 max-w-2xl text-xs text-ink-3">
            {t('Cover artists as named by the')}{' '}
            <a href="https://www.isfdb.org/" className="underline underline-offset-2 hover:text-accent">Internet Speculative Fiction Database</a>{' '}
            {t('for the printing shown')} (<a href="https://creativecommons.org/licenses/by/4.0/" className="underline underline-offset-2 hover:text-accent">CC BY 4.0</a>). {t('Where a tile names nobody, ISFDB does not credit that printing, or credits several artists.')}
          </p>
        )}
        {c.coverCredits === 'artwork' && (
          <p className="mt-10 max-w-2xl text-xs text-ink-3">
            {t('The paintings are named as the books credit them on the back cover, for the printing shown, read from scans at the Internet Archive or from collectors quoting their own copies. Where a tile names nothing, no such credit was found — the picture is not therefore anonymous.')}
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

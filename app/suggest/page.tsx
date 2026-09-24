import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import SuggestLogin from '@/components/SuggestLogin';
import SuggestTool, { type SuggestCollection } from '@/components/SuggestTool';
import { allCollections } from '@/lib/collections';
import { SESSION_COOKIE, sessionValid, suggestEnabled } from '@/lib/suggest/auth';

/**
 * Suggestions for collections, for friends with the password (ROADMAP 5.10a,
 * SPEC F8.4). Without `SUGGEST_PASSWORD` this page does not exist; with it,
 * it is a password field until the cookie says otherwise. Never indexed and
 * never linked from the site: the way in is a link Julian hands out.
 *
 * Friends see every collection, drafts too, because filling a draft is what
 * they are asked for — by title and the books already in it, which is what a
 * suggestion needs to avoid repeating one.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Suggest books for a collection',
  robots: { index: false, follow: false },
};

function forTool(): SuggestCollection[] {
  /*
    Drafts included on purpose, also in production: `allCollections` hides
    them there, so this reads the parsed file with drafts. The tool shows
    titles and book titles, nothing a friend could not see on a published page.
  */
  return allCollections({ includeDrafts: true }).map(c => ({
    slug: c.slug,
    title: c.title,
    kind: c.kind,
    scope: c.scope,
    works: c.works.map(w => ({ id: w.id, title: w.title, author: w.author })),
  }));
}

export default async function SuggestPage() {
  if (!suggestEnabled()) notFound();
  const signedIn = sessionValid((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24">
        {/* Julian, 2026-09-24: „schreibe oben als Hinweis: Für Caitlin". Worded as he asked, in German. */}
        <p className="mb-4 inline-block rounded-md border border-accent/40 px-3 py-1 text-sm text-accent" lang="de">Für Caitlin</p>
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">Suggest a book for a collection</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          Pick a collection, find a book, choose the cover you would put on the wall. Julian looks at every
          suggestion and decides what goes in; nothing you send appears on the site by itself.
        </p>
        <div className="mt-8">{signedIn ? <SuggestTool collections={forTool()} /> : <SuggestLogin />}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import CurateTool, { type StartingPoint } from '@/components/CurateTool';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import SuggestLogin from '@/components/SuggestLogin';
import { liveCollections } from '@/lib/collections-live';
import { draftStoreFromEnv, listDrafts, type Draft } from '@/lib/curate/drafts';
import { SESSION_COOKIE, sessionValid, suggestEnabled } from '@/lib/suggest/auth';
import { adminSignedIn } from '@/lib/suggest/session';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/translate';
import { rich } from '@/components/rich';

/**
 * The collection curation tool, online for friends (ROADMAP 5.10b, SPEC
 * F8.5; Julian, 2026-09-24: „ich wollte dass die kuratier-app auch online ist
 * für meine freunde … die kuratier-app für sammlungen"). Behind the same
 * password as `/suggest`, never indexed, never linked from the site.
 *
 * The drafts are read here on the server, so the tool arrives with them and
 * needs no loading effect in the browser. A store that does not answer is
 * said as such, not shown as "no drafts yet" (N12).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Curate a collection',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  locale?: Locale;
}

export default async function CuratePage({ searchParams, locale = DEFAULT_LOCALE }: PageProps) {
  const t = translator(locale);
  if (!suggestEnabled()) notFound();
  const signedIn = sessionValid((await cookies()).get(SESSION_COOKIE)?.value);
  const d = (await searchParams).d;

  let drafts: Draft[] | null = null;
  let storeError = '';
  if (signedIn) {
    const store = draftStoreFromEnv();
    if (!store) storeError = t('The draft store is not configured on this deployment.');
    else {
      try {
        drafts = await listDrafts(store);
      } catch {
        storeError = t('The draft store did not answer. Reload in a moment.');
      }
    }
  }
  const fileCollections = await liveCollections({ includeDrafts: true });
  const admin = signedIn && (await adminSignedIn());
  const startingPoints: StartingPoint[] = fileCollections.map(c => ({ slug: c.slug, title: c.title, works: c.works.length }));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24">
        {/*
          Julian, 2026-09-24: „schreibe oben als Hinweis: Für Caitlin", worded as
          he asked, in German — and „erst nach dem login zu sehen": a stranger
          at the password field learns no name.
        */}
        {signedIn && <p className="mb-4 inline-block rounded-md border border-accent/40 px-3 py-1 text-sm text-accent" lang="de">Für Caitlin</p>}
        <h1 className="text-3xl leading-tight text-ink sm:text-4xl">{t('Curate a collection')}</h1>
        <p className="mt-4 max-w-2xl text-base text-ink-2">
          {/* Julian, 2026-09-25: only this sentence stays of the introduction. */}
          {rich(t('For a single book, the {form} is faster.'), { form: <Link href="/suggest" className="text-accent underline underline-offset-4">{t('quick suggestion form')}</Link> })}
        </p>
        {/* Signed in as a friend: the admin password can be entered here (5.10g). */}
        {signedIn && !admin && (
          <details className="mt-4 max-w-sm text-sm text-ink-3">
            <summary className="cursor-pointer">Admin</summary>
            <div className="mt-2"><SuggestLogin /></div>
          </details>
        )}
        <div className="mt-8">
          {!signedIn ? (
            <SuggestLogin />
          ) : storeError ? (
            <p className="text-sm text-accent" role="alert">{storeError}</p>
          ) : (
            <CurateTool
              initialDrafts={drafts ?? []}
              startingPoints={startingPoints}
              // The site's collections with their switches and drafts now live in the tool's start page (2026-09-26).
              collections={fileCollections.map(c => ({ slug: c.slug, title: c.title, works: c.works.length, published: c.published }))}
              initialId={typeof d === 'string' ? d : undefined}
              admin={admin}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

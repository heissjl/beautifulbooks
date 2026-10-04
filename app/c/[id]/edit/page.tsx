import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import CollectionEditor from '@/components/CollectionEditor';
import HeaderSearch from '@/components/HeaderSearch';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { hasApiKey } from '@/lib/recognize';
import { isWallId, toPublic, type Wall } from '@/lib/walls/model';
import { startOptions } from '@/lib/walls/startoptions';
import { wallStoreFromEnv } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator } from '@/lib/i18n/translate';

/**
 * The editing mode of a reader's collection (ROADMAP 5.13m, SPEC F9.5a).
 * Whether this browser may edit is the store's answer, asked by the editor
 * itself; anyone else is sent on to the view. Never indexed, never counted
 * as a view.
 */
type Props = { params: Promise<{ id: string }>; locale?: Locale };

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit your collection',
  robots: { index: false, follow: false },
};

export default async function EditWallPage({ params, locale = DEFAULT_LOCALE }: Props) {
  const t = translator(locale);
  const { id } = await params;
  if (!wallsEnabled() || !isWallId(id)) notFound();
  const store = wallStoreFromEnv();
  let wall: Wall | null | 'down';
  try {
    wall = store ? await store.get(id) : 'down';
  } catch {
    wall = 'down';
  }
  if (!wall) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      {wall === 'down' ? (
        // A silent store is not a missing collection (SPEC N12).
        <main className="flex-1 py-24 text-center text-ink-2">{t('The store did not answer. Try again in a moment.')}</main>
      ) : (
        <Suspense>
          <CollectionEditor initial={toPublic(wall)} photoOn={hasApiKey()} startOptions={await startOptions()} />
        </Suspense>
      )}
      <SiteFooter />
    </div>
  );
}

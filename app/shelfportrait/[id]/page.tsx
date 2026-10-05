import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sharedMetadata, SharedPage } from '@/app/shelfportrait/shared';
import type { Board } from '@/lib/inspiration/board';
import { ID } from '@/lib/inspiration/shortid';
import { linkStoreFromEnv } from '@/lib/inspiration/store';
import { inspirationEnabled } from '@/lib/inspiration/switch';
import type { Locale } from '@/lib/i18n/locale';

/**
 * A shared board under its short link, `/shelfportrait/<8 characters>`
 * (ROADMAP 5.18b). The id is looked up in the links' own store.
 *
 * Three answers that must not be mixed up (SPEC N12): the board; "not on
 * record here" for an id the store does not hold — never "no such board",
 * the link was once real and a store can be emptied; and "did not answer"
 * when the store is silent or this deployment has none.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; locale?: Locale };

async function load(id: string): Promise<Board | 'unknown' | 'down'> {
  const store = linkStoreFromEnv();
  if (!store) return 'down';
  try {
    return (await store.get(id)) ?? 'unknown';
  } catch {
    return 'down';
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const found = inspirationEnabled() && ID.test(id) ? await load(id) : 'unknown';
  return sharedMetadata(typeof found === 'string' ? null : found);
}

export default async function InspirationLinkPage({ params }: Props) {
  const { id } = await params;
  if (!inspirationEnabled() || !ID.test(id)) notFound();
  const found = await load(id);
  return (
    <SharedPage
      board={typeof found === 'string' ? null : found}
      path={`/shelfportrait/${id}`}
      missing={found === 'down' ? 'The store of the links did not answer. Try again in a moment.' : 'This link’s board is not on record here.'}
    />
  );
}

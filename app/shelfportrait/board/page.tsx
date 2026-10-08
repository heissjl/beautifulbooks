import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { boardFromSearch, sharedMetadata, SharedPage } from '@/app/shelfportrait/shared';
import { boardQuery, filledCount } from '@/lib/inspiration/board';
import { inspirationEnabled } from '@/lib/inspiration/switch';
import type { Locale } from '@/lib/i18n/locale';
import { measure } from '@/app/api/measure';

/**
 * A shared board under its long address, `/shelfportrait/board?b=…&by=…`
 * (ROADMAP 5.18b): the board is in the address, so this page needs no store.
 * It is what "Done — share it" hands out on a deployment without the links'
 * Redis, and it keeps working after one exists.
 */
export const dynamic = 'force-dynamic';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>>; locale?: Locale };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const board = await boardFromSearch(searchParams);
  return sharedMetadata(filledCount(board) > 0 ? board : null);
}

export default async function InspirationBoardPage({ searchParams }: Props) {
  measure('page-portrait');
  if (!inspirationEnabled()) notFound();
  const board = await boardFromSearch(searchParams);
  const filled = filledCount(board) > 0;
  return <SharedPage board={filled ? board : null} path={`/shelfportrait/board?${boardQuery(board)}`} missing="This address holds no books. Make a board of your own at /shelfportrait." />;
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HeaderSearch from '@/components/HeaderSearch';
import InspirationEditor, { type Named } from '@/components/InspirationEditor';
import InspirationFaq from '@/components/InspirationFaq';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { boardFromSearch } from '@/app/shelfportrait/shared';
import { boardQuery, filledCount, sizeOf } from '@/lib/inspiration/board';
import { drawStarters } from '@/lib/inspiration/starters';
import { starterPool } from '@/lib/inspiration/starterpool';
import { describeBoard } from '@/lib/inspiration/describe';
import { inspirationEnabled } from '@/lib/inspiration/switch';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { SITE_URL } from '@/lib/seo';
import { measure } from '@/app/api/measure';

/**
 * "My Shelf-Portrait" (ROADMAP 5.18b): three, six or nine books on a board,
 * each with the cover its reader loves, and a picture to share. Behind a switch like
 * the cover game — on in previews and on a laptop, off in production until
 * it is switched on (`lib/inspiration/switch.ts`).
 *
 * The board lives in the address (`?b=…`), so the page is rendered per
 * request: a reload, or a link pasted before "Done", opens with its covers
 * and their titles already there.
 *
 * `locale` is taken so that the German mirror can render this page, and not
 * used yet: the page is English only until its sentences are settled.
 */
export const metadata: Metadata = {
  title: 'My Shelf-Portrait',
  description: 'The books that define you — three, six or nine of them, each with the cover you love. Pick them, then share the picture.',
  // Indexed since 2026-10-06 (Julian: „lass sie uns indizieren"); one address, whatever board is in the query.
  alternates: { canonical: `${SITE_URL}/shelfportrait` },
};

export const dynamic = 'force-dynamic';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>>; locale?: Locale };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `locale` is the mirror's contract (see above)
export default async function InspirationPage({ searchParams, locale = DEFAULT_LOCALE }: Props) {
  measure('page-portrait');
  if (!inspirationEnabled()) notFound();
  const board = await boardFromSearch(searchParams);
  const names: Record<string, Named> = {};
  for (const b of (await describeBoard(board)).books) if (b?.title) names[b.workId] = { title: b.title, author: b.author };
  // Three examples on an empty board of nine (5.18b, 2026-10-06), drawn anew for every empty visit.
  const starters = filledCount(board) === 0 && sizeOf(board) === 9 ? drawStarters(await starterPool(), Math.random) : [];
  for (const s of starters) names[s.book.id] = { title: s.book.title, author: s.book.author };
  return (
    // Room at the bottom on a phone: the editor's band is fixed there and would cover the footer.
    <div className="flex min-h-screen flex-col pb-14 sm:pb-0">
      <SiteHeader search={<HeaderSearch />} />
      <InspirationEditor initialQuery={boardQuery(board)} initialNames={names} starters={starters}>
        <InspirationFaq />
      </InspirationEditor>
      <SiteFooter />
    </div>
  );
}

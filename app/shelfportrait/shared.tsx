import type { Metadata } from 'next';
import { headers } from 'next/headers';
import HeaderSearch from '@/components/HeaderSearch';
import InspirationShared from '@/components/InspirationShared';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { type Board, boardQuery, parseBoard, SIZE_WORD, sizeOf } from '@/lib/inspiration/board';
import { versusEnabled } from '@/lib/hotornot/switch';
import { describeBoard } from '@/lib/inspiration/describe';
import { PICTURE_VERSION, titleOf } from '@/lib/inspiration/share';
import { wallsEnabled } from '@/lib/walls/switch';

/**
 * What the two shared addresses have in common (ROADMAP 5.18b): the short
 * link `/shelfportrait/<id>` and the long form `/shelfportrait/board?b=…`, which
 * needs no store. Not a route itself — a file beside the pages.
 */

/** One value per name: a repeated parameter is somebody typing into the address bar, and the first one counts. */
export async function boardFromSearch(searchParams: Promise<Record<string, string | string[] | undefined>> | undefined): Promise<Board> {
  const raw = (await searchParams) ?? {};
  const params = new URLSearchParams();
  for (const name of ['b', 'by', 'n']) {
    const value = raw[name];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) params.set(name, first);
  }
  return parseBoard(params);
}

/** The address of this deployment as the reader reached it: a preview has its own host, and a shared link must name it. */
export async function origin(): Promise<string> {
  const host = (await headers()).get('host') ?? 'buyitscovers.com';
  return `${/^(localhost|127\.|\[::1\])/.test(host) ? 'http' : 'https'}://${host}`;
}

export async function sharedMetadata(board: Board | null): Promise<Metadata> {
  const title = titleOf(board?.by ?? '');
  const description = `${board ? SIZE_WORD[sizeOf(board)] : 'Nine'} books, each with a favourite cover. Take your Shelf-Portrait.`;
  // Not indexed while the page lives behind its switch; the card makes a shared link show the covers.
  const images = board ? [{ url: `${await origin()}/api/inspiration/poster?${boardQuery(board)}&format=card&v=${PICTURE_VERSION}`, width: 1200, height: 630 }] : undefined;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { type: 'website', title, description, ...(images ? { images } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}

/** The shared view of a board, or one sentence when there is no board to show. `path` is the address it was reached under. */
export async function SharedPage({ board, path, missing }: { board: Board | null; path: string; missing?: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 lg:px-8">
        {board ? (
          <InspirationShared board={await describeBoard(board)} query={boardQuery(board)} link={`${await origin()}${path}`} walls={wallsEnabled()} versus={versusEnabled()} />
        ) : (
          <p className="py-24 text-center text-ink-2">{missing}</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

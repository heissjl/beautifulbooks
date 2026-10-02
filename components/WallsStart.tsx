'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BookSearch from './BookSearch';
import CoverImage from './CoverImage';
import IdLinkNotice from './IdLinkNotice';
import WallIdField from './WallIdField';
import WallPhoto from './WallPhoto';
import WallPicker from './WallPicker';
import type { Destination } from './WallProposal';
import WallSample from './WallSample';
import StartFromPicker from './StartFromPicker';
import type { StartOption } from '@/lib/walls/jumpstart';
import { addTiles, createWall, useMyWalls } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import { defaultTitle, editHref } from '@/lib/walls/edit';
import { tileCoverId, type Tile } from '@/lib/walls/model';

const WORK = /^OL\d+W$/;

/**
 * The lobby of a reader's collections (ROADMAP 5.13a, 5.13c, 5.13m): their
 * own collections, each opening in its editor (Julian, 2026-09-29: „wenn ich
 * eine collection in der create ansicht anklicke lande ich in der
 * anzeigesicht, dort kann ich aber nichts machen“), and three ways to start a
 * new one — a book, six random favourites or another collection, a photo.
 * Every start ends in the editor of the new collection. A search result opens
 * the book's covers here, between two rules; the first cover picked makes the
 * collection and the page becomes its editor with the same book open.
 */
export default function WallsStart({ photoOn, startOptions = [] }: { photoOn: boolean; startOptions?: StartOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { me, setMe } = useMyWalls();

  const workParam = params.get('work');
  const workId = workParam && WORK.test(workParam) ? workParam : null;
  const q = params.get('q') ?? '';

  function go(next: { q?: string; work?: string | null }) {
    const p = new URLSearchParams(params.toString());
    for (const key of ['q', 'work'] as const) {
      const value = next[key];
      if (value === undefined) continue;
      if (value) p.set(key, value);
      else p.delete(key);
    }
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function commit(dest: Destination, tiles: Tile[]) {
    const wall = 'wall' in dest ? await addTiles(dest.wall, tiles) : await createWall(dest.title, tiles);
    router.push(editHref(wall.id));
  }

  async function emptyWall() {
    try {
      const wall = await createWall(defaultTitle(me.walls));
      router.push(editHref(wall.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'The collection could not be made.');
    }
  }

  const heading = 'font-display text-2xl text-ink';

  return (
    <>
      <IdLinkNotice me={me} onChange={setMe} />
      {me.walls.length > 0 && (
        <section className="mt-10" aria-labelledby="yours">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
            <h2 id="yours" className={heading}>Your collections</h2>
            <span className="text-xs text-ink-3 sm:text-sm">A click opens it for editing</span>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {me.walls.map((w) => (
              <li key={w.id} className="rounded-card border border-line bg-surface p-3 hover:border-accent">
                <Link href={editHref(w.id)} className="group block">
                  <span className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 4 }, (_, i) => w.tiles[i]).map((t, i) => (
                      <span key={t?.coverId ?? i} className="relative block aspect-[2/3] overflow-hidden rounded-[2px] bg-surface-2">
                        {t && <CoverImage src={coverUrlFor(tileCoverId(t), 'S') ?? ''} alt="" sizes="60px" />}
                      </span>
                    ))}
                  </span>
                  <span className="mt-2 block truncate text-sm text-ink group-hover:text-accent">{w.title}</span>
                  <span className="block text-xs text-ink-3">
                    {w.tiles.length} {w.tiles.length === 1 ? 'cover' : 'covers'}
                    {w.unsaved && <span className="ml-2 text-accent">not saved yet</span>}
                    {!w.unsaved && w.showcase === 'shown' && <span className="ml-2">· shown</span>}
                  </span>
                </Link>
                <span className="mt-2 flex items-center gap-3 text-sm">
                  <Link href={editHref(w.id)} className="rounded-full bg-ink px-3 py-0.5 text-bg transition-colors hover:bg-accent">Edit</Link>
                  <Link href={`/c/${w.id}`} className="text-ink-2 underline underline-offset-2 hover:text-accent">View</Link>
                </span>
              </li>
            ))}
            <li className="flex min-h-[8rem] items-center justify-center rounded-card border-[1.5px] border-dashed border-line">
              <button type="button" onClick={emptyWall} className="px-3 py-2 text-sm text-ink-2 hover:text-accent">+ New, empty collection</button>
            </li>
          </ul>
        </section>
      )}

      <section className="mt-12" aria-labelledby="new">
        {me.walls.length > 0 && (
          <div className="border-b border-line pb-2">
            <h2 id="new" className={heading}>Start a new one</h2>
          </div>
        )}
        <div className={`mt-6 grid gap-12 ${photoOn ? 'lg:grid-cols-2' : 'max-w-2xl'}`}>
          <div className="min-w-0">
            <h3 className="font-display text-xl text-ink">From a book</h3>
            <p className="mt-2 text-sm text-ink-2">Find a book and pick the covers you love from all the ones it has had.</p>
            <BookSearch
              key={q}
              q={q}
              workId={workId}
              onSearch={(value) => go({ q: value, work: null })}
              onPick={(id) => {
                go({ work: id });
                requestAnimationFrame(() => document.getElementById('picker')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
              }}
            />
            <WallSample onCommit={commit} />
            <StartFromPicker options={startOptions} />
          </div>

          {/* Without a key the photo cannot be read, so the section is not shown at all (Julian, 2026-09-28). */}
          {photoOn && (
            <div className="min-w-0">
              <h3 className="font-display text-xl text-ink">From a photo</h3>
              <p className="mt-2 text-sm text-ink-2">Photograph a shelf or a pile of books. We read the titles and offer them as covers.</p>
              <WallPhoto photoOn={photoOn} walls={me.walls} onCommit={commit} />
            </div>
          )}
        </div>
      </section>

      {workId && (
        <WallPicker
          key={workId}
          workId={workId}
          target={null}
          newTitle={defaultTitle(me.walls)}
          // The first cover made the collection: from here on the page is its editor, same book open.
          onWall={(wall) => router.replace(editHref(wall.id, { q, work: workId }), { scroll: false })}
          onClose={() => go({ work: null })}
        />
      )}

      <WallIdField me={me} onChange={setMe} />
    </>
  );
}

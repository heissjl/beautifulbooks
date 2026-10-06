'use client';

import Link from '@/components/Link';
import CoverImage from './CoverImage';
import { rememberWall, tileAnchor } from './cameFrom';
import { storeWorkPreview } from './useWorkPreview';
import { wallCover, type CuratedWork } from '@/lib/curated';
import type { WallWork } from '@/lib/collections';
import { tileTitle } from '@/lib/normalize';
import { useT } from './i18n';

type Tile = CuratedWork | WallWork;

interface CoverWallProps {
  works: Tile[];
  /**
   * Open the work's wall with this very cover selected (`?cover=`), as a
   * collection wants: the tile is a chosen printing, and the reader clicked
   * that one, not the book in general (Julian, 2026-09-26).
   */
  selectCover?: boolean;
  /**
   * A wall of sets (`Collection.setSize`): each edition in a block of its
   * own under its name, seven across even on a phone, or three with two
   * blocks side by side from `md`.
   */
  setSize?: 3 | 7;
  /**
   * No author line under the title: the "More by …" row names her once in
   * its heading, and six times the same name under six tiles is noise
   * (ROADMAP 6.53).
   */
  hideAuthor?: boolean;
  /** The grid's classes, for a row that needs other columns than the wall (6.53: 3 / 6). */
  gridClassName?: string;
  /** The page this wall stands on, so a book opened from it can lead back by name (components/cameFrom.ts). */
  from?: { href: string; title: string };
}

/* Literal class strings, so Tailwind sees them. */
const SET_GRID: Record<3 | 7, string> = {
  3: 'grid grid-cols-3 gap-3 lg:gap-4',
  7: 'grid grid-cols-7 gap-1.5 sm:gap-3 lg:gap-4',
};
const SETS: Record<3 | 7, string> = {
  3: 'grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2',
  7: 'space-y-10',
};

const keyOf = (w: Tile) => `${w.id}:${'image' in w && w.image ? w.image : w.coverId}`;
const anchorOf = (w: Tile) => tileAnchor(w.id, w.coverId);

function CoverTile({ w, selectCover, caption, hideAuthor = false, from }: { w: Tile; selectCover: boolean; caption: boolean; hideAuthor?: boolean; from?: { href: string; title: string } }) {
  const t = useT();
  const target = ('coverWork' in w && w.coverWork) || w.id;
  // A site-served image is on no wall of Open Library's, so there is no cover to select there.
  const image = 'image' in w ? w.image : undefined;
  return (
    <Link
      href={selectCover && !image ? `/book/${target}?cover=${encodeURIComponent(`ol:${w.coverId}`)}` : `/book/${target}`}
      className="group block focus-visible:outline-none"
      title={caption ? undefined : `${tileTitle(w.title)} — ${w.author}`}
      onClick={() => {
        storeWorkPreview(target, { title: w.title, authors: [w.author], coverUrls: [wallCover({ coverId: w.coverId, image }, 'L')] });
        if (from) rememberWall({ href: `${from.href}#${anchorOf(w)}`, title: from.title, workId: target });
      }}
    >
      <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg">
        <CoverImage src={wallCover({ coverId: w.coverId, image }, 'M')} alt={t('{title} by {author}', { title: w.title, author: w.author })} sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw" />
      </div>
      {caption && (
        <>
          {/*
            Two lines each, as on the result cards. One line cut 9 of 18
            titles on a phone and 1 on a desktop — "Der…" is not a
            shorter "Der Steppenwolf", it is no title (ROADMAP 6.30, N14).
          */}
          <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-ink transition-colors group-hover:text-accent">{tileTitle(w.title)}</p>
          {!hideAuthor && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-3">{w.author}</p>}
          {/*
            The cover artist, only on collections that show credits (6.52)
            and only where ISFDB names one for this printing; the page says
            where the names come from.
          */}
          {'coverArtists' in w && w.coverArtists && w.coverArtists.length > 0 && (
            <p className="mt-0.5 line-clamp-1 text-[11px] italic leading-snug text-ink-3">Cover: {w.coverArtists.join(', ')}</p>
          )}
          {/* A painting and its painter, two lines at most, where the printing credits it (coverCredits: artwork). */}
          {'coverArt' in w && w.coverArt && (
            <p className="mt-0.5 line-clamp-2 text-[11px] italic leading-snug text-ink-3" title={w.coverArt}>Cover: {w.coverArt}</p>
          )}
        </>
      )}
    </Link>
  );
}

/** Consecutive tiles of one edition; without names, blocks of `size`. */
function groupSets(works: readonly Tile[], size: number): Array<{ name?: string; works: Tile[] }> {
  const out: Array<{ name?: string; works: Tile[] }> = [];
  for (const w of works) {
    const name = 'set' in w ? w.set : undefined;
    const last = out[out.length - 1];
    if (last && (name ? last.name === name : !last.name && last.works.length < size)) last.works.push(w);
    else out.push({ name, works: [w] });
  }
  return out;
}

/**
 * A wall of hand-picked covers, one per work, each linking to the work's own
 * wall: the home page's curated eighteen (SPEC §8.1) and every thematic
 * collection (SPEC F8) use the same grid, so a collection looks like the page
 * a reader already knows.
 *
 * A wall of sets (Harry Potter, The Lord of the Rings) shows each edition as
 * a block under its name instead: the same seven titles under every row said
 * nothing, and the name of the edition is what tells the rows apart.
 */
export default function CoverWall({ works, selectCover = false, setSize, hideAuthor = false, gridClassName, from }: CoverWallProps) {
  if (setSize) {
    return (
      <div className={SETS[setSize]}>
        {groupSets(works, setSize).map((set, i) => (
          <section key={`${set.name ?? 'set'}-${i}`} aria-label={set.name}>
            {set.name && <h2 className="mb-3 text-sm font-medium text-ink-2">{set.name}</h2>}
            <ul className={SET_GRID[setSize]}>
              {set.works.map(w => (
                <li key={keyOf(w)} id={from ? anchorOf(w) : undefined} className="scroll-mt-24"><CoverTile w={w} selectCover={selectCover} caption={false} from={from} /></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }
  return (
    <ul className={gridClassName ?? 'grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:gap-6'}>
      {works.map(w => (
        <li key={keyOf(w)} id={from ? anchorOf(w) : undefined} className="scroll-mt-24"><CoverTile w={w} selectCover={selectCover} caption hideAuthor={hideAuthor} from={from} /></li>
      ))}
    </ul>
  );
}

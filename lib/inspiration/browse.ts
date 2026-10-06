/**
 * The lists a reader can scroll instead of searching (ROADMAP 5.18a, 5.18b).
 *
 * **Server only**: it imports `data/popular-works.json` (236 KB) and the
 * curated list, and would ship both to every browser if a client component
 * imported it — the trap of `lib/coverindex.ts`. The editor asks
 * `/api/inspiration/browse` instead.
 *
 * Two lists, both files in the repository, so browsing asks Open Library
 * nothing but the cover images:
 * - the works Julian picked a cover for (`lib/curated.ts`), and
 * - the works Open Library's readers marked as read most often, cut at five
 *   editions on record — below that the list is single records with no wall
 *   behind them (50 of 995 rows, docs/history.md).
 */
import { isHiddenCover } from '../hiddencovers';
import popularFile from '@/data/popular-works.json';
import { CURATED_LIST } from '../curated';
import { browsable, type PopularFile } from '../popularworks';

export const POPULAR_MIN_EDITIONS = 5;

export interface BrowseWork {
  id: string;
  title: string;
  author: string;
  /** `ol:<number>` */
  coverId: string;
}

export interface BrowseList {
  id: 'curated' | 'popular';
  /** The day the list was built, where it has one. */
  builtAt?: string;
  works: BrowseWork[];
}

const popular = popularFile as PopularFile;

const LISTS: BrowseList[] = [
  { id: 'curated', works: CURATED_LIST.map(w => ({ id: w.id, title: w.title, author: w.author, coverId: `ol:${w.coverId}` })) },
  {
    id: 'popular',
    builtAt: popular.builtAt,
    works: browsable(popular.works, POPULAR_MIN_EDITIONS).map(w => ({ id: w.id, title: w.title, author: w.author, coverId: w.coverId })),
  },
];

/** What the lists already say about a work, so a browsed book costs no request for its title. Where both name a work, the curated spelling stands. */
/** The lists as the editor shows them: without a work whose cover was taken off the site on request (2.18k). */
export function browseLists(): BrowseList[] {
  return LISTS.map(l => ({ ...l, works: l.works.filter(w => !isHiddenCover(w.coverId)) }));
}

const LISTED = new Map([...LISTS].reverse().flatMap(l => l.works).map(w => [w.id, { title: w.title, author: w.author }]));

export function listedWork(workId: string): { title: string; author: string } | undefined {
  return LISTED.get(workId);
}

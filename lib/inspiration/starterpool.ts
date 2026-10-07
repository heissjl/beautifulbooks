/**
 * The books an empty board's examples are drawn from (`starters.ts`).
 * **Server only**, like `browse.ts`, which it reads: the curated list and the
 * published collections, never a request. A collection's pick counts only
 * when its cover is an Open Library image on the work's own wall — the cover
 * window of the editor shows that wall, and an example should be a cover the
 * reader can find there again.
 */
import { liveCollections } from '../collections-live';
import { isHiddenCover } from '../hiddencovers';
import { browseLists } from './browse';
import type { StarterBook } from './starters';

export async function starterPool(): Promise<StarterBook[]> {
  const curated = browseLists().find(l => l.id === 'curated')?.works ?? [];
  const collections = (await liveCollections({ includeDrafts: false }))
    .filter(c => c.published)
    .flatMap(c => c.works)
    .filter(w => w.coverId > 0 && !w.image && !w.coverWork)
    .map(w => ({ id: w.id, title: w.title, author: w.author, coverId: `ol:${w.coverId}` }));
  return [...curated, ...collections].filter(b => !isHiddenCover(b.coverId));
}

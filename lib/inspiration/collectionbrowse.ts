/**
 * The published collections as lists to browse in the Shelf-Portrait's book
 * picker (ROADMAP 5.18b; Julian, 2026-10-07: „add the option to browse a
 * curated collection for the shelfportrait book picker. third pill, with
 * dropdown").
 *
 * Pure, over collections the caller has read (`liveCollections`), so the
 * rules can be tested without a store. A book is offered with the cover the
 * collection chose for it, and only where that cover is an Open Library image
 * on the work's own wall — the rule of the board's examples
 * (`starterpool.ts`): the cover window shows that wall, and a site-served
 * image or a cover filed under another work would not be there. A collection
 * with no such book is not offered at all.
 */
import type { Collection } from '../collections';
import { isHiddenCover } from '../hiddencovers';
import type { BrowseWork } from './browse';

export interface CollectionEntry {
  slug: string;
  title: string;
  /** Books the picker can offer, after the rule above. */
  count: number;
}

export function pickerWorks(collection: Collection): BrowseWork[] {
  const seen = new Set<string>();
  const out: BrowseWork[] = [];
  for (const w of collection.works) {
    if (!(w.coverId > 0) || w.image || w.coverWork || seen.has(w.id)) continue;
    const coverId = `ol:${w.coverId}`;
    if (isHiddenCover(coverId)) continue;
    seen.add(w.id);
    out.push({ id: w.id, title: w.title, author: w.author, coverId });
  }
  return out;
}

/** The published collections in the site's order, each with the number of books it can offer. */
export function collectionEntries(collections: Collection[]): CollectionEntry[] {
  return collections
    .filter(c => c.published)
    .map(c => ({ slug: c.slug, title: c.title, count: pickerWorks(c).length }))
    .filter(e => e.count > 0);
}

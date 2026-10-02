/**
 * The collections a reader may start from or take covers from (ROADMAP 5.13k,
 * 5.13m): the published curated ones and the most visited of those readers
 * show. Server only — it reads the collections file and the store. A silent
 * store leaves the readers' out rather than failing the page.
 */
import { liveCollections } from '@/lib/collections-live';
import { curatedOption, readerOption, type StartOption } from './jumpstart';
import { toPublic } from './model';
import { shownWalls, wallStoreFromEnv } from './store';

/** Readers' collections offered, the most visited first: a page's worth. */
const READER_OPTIONS = 30;

export async function startOptions(): Promise<StartOption[]> {
  const curated = (await liveCollections({ includeDrafts: false }).catch(() => [])).map(curatedOption);
  const store = wallStoreFromEnv();
  const shown = store ? await shownWalls(store).catch(() => []) : [];
  const readers = shown
    .sort((a, b) => b.views - a.views)
    .slice(0, READER_OPTIONS)
    .map((s) => readerOption(toPublic(s.wall)));
  return [...curated, ...readers].filter((o): o is StartOption => !!o);
}

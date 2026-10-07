/**
 * The printing a chosen cover belongs to, for the line under it on a shared
 * board — "2016 · Penguin Random House" (ROADMAP 5.18b, server only).
 *
 * The board's address holds the work and the cover id, not the edition.
 * Open Library's cover host keeps a record per image that names the edition
 * it was uploaded to (`olid`), and that edition's record has its publisher
 * and date: two small requests per book, each cached a day, instead of the
 * editions pages the cover window reads (up to three of a hundred). Measured
 * 2026-10-06 on Gatsby's cover 9396760 → OL26398085M. It names the edition
 * the image was uploaded to, which is usually but not always the newest
 * printing with that cover.
 *
 * Asks Open Library and never Google (E10). A record that does not come
 * leaves the line out: a silent source is not "no edition" (N12).
 */
import { parseYear } from '../normalize';
import { fetchJson } from '../sources/http';
import { OL_REVALIDATE, OL_TIMEOUTS } from '../sources/openlibrary';
import { garbled } from './covers';

export interface ChosenEdition {
  year?: number;
  publisher?: string;
}

const EDITION_KEY = /^OL\d{1,10}M$/;

/** The edition a cover record names, or null. */
export function editionOfCoverRecord(record: unknown): string | null {
  const olid = (record as { olid?: unknown } | null)?.olid;
  return typeof olid === 'string' && EDITION_KEY.test(olid) ? olid : null;
}

/** Year and publisher of an edition record; a publisher whose letters were lost is left out. Null when neither is there. */
export function editionLine(record: unknown): ChosenEdition | null {
  const r = record as { publishers?: unknown; publish_date?: unknown } | null;
  const first = Array.isArray(r?.publishers) ? r.publishers[0] : undefined;
  const publisher = typeof first === 'string' && first.trim() && !garbled(first) ? first.trim() : undefined;
  const year = parseYear(typeof r?.publish_date === 'string' ? r.publish_date : undefined);
  return year || publisher ? { ...(year ? { year } : {}), ...(publisher ? { publisher } : {}) } : null;
}

export async function chosenEdition(coverId: string): Promise<ChosenEdition | null> {
  const m = /^ol:(\d{1,12})$/.exec(coverId);
  if (!m) return null;
  const options = { timeoutMs: OL_TIMEOUTS.work, revalidate: OL_REVALIDATE.work };
  try {
    const olid = editionOfCoverRecord(await fetchJson<unknown>(`https://covers.openlibrary.org/b/id/${m[1]}.json`, options));
    if (!olid) return null;
    return editionLine(await fetchJson<unknown>(`https://openlibrary.org/books/${olid}.json`, options));
  } catch {
    return null;
  }
}

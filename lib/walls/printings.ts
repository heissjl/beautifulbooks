/**
 * The printing a cover belongs to, for tiles that arrived without one (ROADMAP
 * 5.13f). Server only. A tile from "6 random favourites" or from a photo knows
 * its cover, not its edition, and the list of books said "Printing not on
 * record" for all of them — untrue, nobody had asked (Julian, 2026-09-28:
 * „warum ist das printing nie on record, stimmt das?“; SPEC N12).
 *
 * Open Library answers it in two small requests, both cached for a month:
 * `covers.openlibrary.org/b/id/<id>.json` names the edition the scan was
 * uploaded to (`olid`), and `/books/<olid>.json` gives publisher, date and
 * ISBNs. That is the printing *this scan* came from; other printings may carry
 * the same design.
 */
import { cleanIsbn, isbn10to13, parseYear } from '@/lib/normalize';
import { fetchJson } from '@/lib/sources/http';
import type { Printing } from './model';

const TIMEOUT_MS = 8_000;
const REVALIDATE = 60 * 60 * 24 * 30;

interface CoverMeta {
  olid?: string | null;
}
interface EditionJson {
  publishers?: string[];
  publish_date?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  physical_format?: string;
}

export type PrintingLookup = { found: Printing } | { none: true };

type Fetch = <T>(url: string) => Promise<T>;
const defaultFetch: Fetch = (url) => fetchJson(url, { timeoutMs: TIMEOUT_MS, revalidate: REVALIDATE });

/** The printing from an edition record; null for an e-book (E21). Pure. */
export function printingFromEdition(e: EditionJson): Printing | null {
  if (/e-?book|electronic|kindle/i.test(e.physical_format ?? '')) return null;
  const isbn10 = cleanIsbn(e.isbn_10?.[0]);
  const isbn13 = cleanIsbn(e.isbn_13?.[0]) ?? (isbn10 ? isbn10to13(isbn10) : undefined);
  const year = parseYear(e.publish_date);
  const publisher = e.publishers?.[0]?.trim();
  return {
    ...(isbn13 ? { isbn13 } : {}),
    ...(isbn10 ? { isbn10 } : {}),
    ...(publisher ? { publisher } : {}),
    ...(year ? { year } : {}),
  };
}

/**
 * Throws when a source does not answer — the caller must then leave the tile
 * as "not looked up", never mark it as having no printing.
 */
export async function lookUpPrinting(coverId: string, get: Fetch = defaultFetch): Promise<PrintingLookup> {
  const meta = await get<CoverMeta>(`https://covers.openlibrary.org/b/id/${coverId}.json`);
  const olid = typeof meta.olid === 'string' && /^OL\d+M$/.test(meta.olid) ? meta.olid : null;
  if (!olid) return { none: true };
  const printing = printingFromEdition(await get<EditionJson>(`https://openlibrary.org/books/${olid}.json`));
  return printing && Object.keys(printing).length > 0 ? { found: printing } : { none: true };
}

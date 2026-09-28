/**
 * The printing and the size of a cover's book (ROADMAP 5.13f, 5.13i). Server
 * only. A tile from "6 random favourites" or a photo knows its cover, not its
 * edition, and the list said "Printing not on record" without anyone having
 * asked (Julian, 2026-09-28; SPEC N12). A tile from a book's wall knows its
 * printings but not its size.
 *
 * Open Library answers most of it: `covers.openlibrary.org/b/id/<id>.json`
 * names the edition the scan was uploaded to (`olid`) and the scan's width and
 * height; `/books/<olid>.json` gives publisher, date, ISBNs, format and, rarely
 * (2.8 % measured), `physical_dimensions`. Where it has no size, the height
 * comes from a national library by the ISBN's group (DNB for 3, BnF for 2, the
 * Library of Congress for 0 and 1) and the width from the scan's proportions
 * (docs/plans/research-book-dimensions.md). All cached for a month.
 */
import { cleanIsbn, isbn10to13, parseYear } from '@/lib/normalize';
import { fetchJson } from '@/lib/sources/http';
import { parseLibraryHeight, parseOlDimensions, sizeFromFormat, widthFromScan, FORMAT_CM, type BookSize } from './dimensions';
import type { Printing } from './model';

const TIMEOUT_MS = 8_000;
/** The Library of Congress server is slow and plain HTTP (research): a short wait, then an estimate. */
const LIBRARY_TIMEOUT_MS = 6_000;
const REVALIDATE = 60 * 60 * 24 * 30;

interface CoverMeta {
  olid?: string | null;
  width?: number;
  height?: number;
}
interface EditionJson {
  publishers?: string[];
  publish_date?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  physical_format?: string;
  physical_dimensions?: string;
  pagination?: string;
}

export type PrintingLookup = { found: Printing } | { none: true };

export interface BookLookup {
  /** Absent when the tile already had its printing and none was asked for. */
  printing?: PrintingLookup;
  size: BookSize;
}

type Fetch = <T>(url: string) => Promise<T>;
type FetchText = (url: string, timeoutMs: number) => Promise<string>;

const defaultFetch: Fetch = (url) => fetchJson(url, { timeoutMs: TIMEOUT_MS, revalidate: REVALIDATE });
const defaultText: FetchText = async (url, timeoutMs) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: REVALIDATE } } as RequestInit);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
};

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

/** Which library to ask for a 13-digit ISBN, by its registration group. Pure. */
export function libraryFor(isbn13: string): { name: 'dnb' | 'bnf' | 'loc'; url: string } | null {
  const group = isbn13.startsWith('978') ? isbn13[3] : null;
  if (group === '3') return { name: 'dnb', url: `https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=num%3D${isbn13}&recordSchema=MARC21-xml` };
  if (group === '2') return { name: 'bnf', url: `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.isbn%20adj%20%22${isbn13}%22&recordSchema=unimarcxchange` };
  if (group === '0' || group === '1') return { name: 'loc', url: `http://lx2.loc.gov:210/lcdb?version=1.1&operation=searchRetrieve&query=bath.isbn=${isbn13}&recordSchema=marcxml` };
  return null;
}

/** The size statement from a MARC21 (300 $c) or UNIMARC (215 $d) record, as text. Pure. */
export function sizeStatement(xml: string): string | undefined {
  const field = (tag: string, code: string) =>
    new RegExp(`tag="${tag}"[^>]*>[\\s\\S]*?<(?:\\w+:)?subfield code="${code}">([^<]*)<`, 'i').exec(xml)?.[1];
  return field('300', 'c') ?? field('215', 'd');
}

/**
 * The size of a printing, from the best source that answers. Never throws for
 * a silent library: that book is then estimated, and marked so.
 */
export async function sizeFor(
  edition: EditionJson | null,
  isbn13: string | undefined,
  scan: { width?: number; height?: number },
  getText: FetchText = defaultText,
): Promise<BookSize> {
  const ol = parseOlDimensions(edition?.physical_dimensions) ?? parseOlDimensions(/cm/.test(edition?.pagination ?? '') ? edition?.pagination : undefined);
  if (ol) return { ...ol, source: 'openlibrary' };
  const library = isbn13 ? libraryFor(isbn13) : null;
  if (library) {
    try {
      const stated = parseLibraryHeight(sizeStatement(await getText(library.url, LIBRARY_TIMEOUT_MS)));
      if (stated) {
        const w = stated.w ?? widthFromScan(stated.h, scan.width, scan.height) ?? Math.round(stated.h * 0.65 * 10) / 10;
        return { h: stated.h, w, source: 'library' };
      }
    } catch {
      // Silent library: estimated below, never "no size".
    }
  }
  const byFormat = sizeFromFormat(edition?.physical_format);
  if (byFormat) return { ...byFormat, source: 'format' };
  return { ...FORMAT_CM.trade, source: 'assumed' };
}

/**
 * Printing (when asked) and size of the book a cover belongs to. Throws when
 * Open Library does not answer — the caller then leaves the tile untouched,
 * never marks it as having no printing.
 */
export async function lookUpBook(
  coverId: string,
  known: { isbn13?: string; needPrinting: boolean },
  get: Fetch = defaultFetch,
  getText: FetchText = defaultText,
): Promise<BookLookup> {
  const meta = await get<CoverMeta>(`https://covers.openlibrary.org/b/id/${coverId}.json`);
  const olid = typeof meta.olid === 'string' && /^OL\d+M$/.test(meta.olid) ? meta.olid : null;
  const edition = olid ? await get<EditionJson>(`https://openlibrary.org/books/${olid}.json`) : null;
  const fromEdition = edition ? printingFromEdition(edition) : null;
  const printing: PrintingLookup | undefined = known.needPrinting
    ? fromEdition && Object.keys(fromEdition).length > 0
      ? { found: fromEdition }
      : { none: true }
    : undefined;
  const isbn13 = known.isbn13 ?? fromEdition?.isbn13;
  const size = await sizeFor(edition, isbn13, { width: meta.width, height: meta.height }, getText);
  return { ...(printing ? { printing } : {}), size };
}

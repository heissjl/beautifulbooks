/**
 * Pure parsers for Open Library API responses. No I/O; the HTTP client lives
 * in openlibrary.ts (SPEC.md §7 step 3). Kept separate so the parsing can be
 * tested against recorded fixtures.
 */
import type { Edition, Work, WorkSummary } from '../model';
import {
  cleanAuthors, cleanIsbn, isbn10to13, looksLikeNonBook, parseYear, toIsoLanguage,
} from '../normalize';

/** Subset of a `/search.json` doc as requested via `fields=` in the client. */
export interface OlSearchDoc {
  key: string;
  title: string;
  subtitle?: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  edition_count?: number;
  cover_i?: number;
  cover_edition_key?: string;
  /** 3-letter codes of languages this work has editions in. */
  language?: string[];
  subject?: string[];
}

/** Subset of a `/works/{id}/editions.json` entry. */
export interface OlEditionEntry {
  key: string;
  title?: string;
  subtitle?: string;
  /** Author *keys* only. Names are not included by this endpoint. */
  authors?: Array<{ key: string }>;
  works?: Array<{ key: string }>;
  publishers?: string[];
  publish_date?: string;
  languages?: Array<{ key: string }>;
  isbn_10?: string[];
  isbn_13?: string[];
  covers?: number[];
  number_of_pages?: number;
  physical_format?: string;
}

export function olCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'L'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

export function olWorkId(key: string): string {
  return key.replace('/works/', '');
}

/**
 * Converts search docs to work summaries. Docs without a cover or without
 * an author, and non-book titles, are dropped (SPEC §2.2, §3 F3.4).
 */
export function parseSearchDocs(docs: readonly OlSearchDoc[]): WorkSummary[] {
  const out: WorkSummary[] = [];
  for (const doc of docs) {
    if (!doc.key || !doc.title || !doc.cover_i || doc.cover_i <= 0) continue;
    if (looksLikeNonBook(doc.title)) continue;
    const authors = cleanAuthors(doc.author_name);
    if (authors.length === 0) continue;

    const languages = Array.from(
      new Set((doc.language ?? []).map(toIsoLanguage).filter((l): l is string => !!l)),
    );

    out.push({
      id: olWorkId(doc.key),
      title: doc.title,
      authors,
      firstPublishYear: doc.first_publish_year,
      editionCount: doc.edition_count,
      coverUrls: [olCoverUrl(doc.cover_i)],
      languages,
    });
  }
  return out;
}

function parseFormat(raw: string | undefined): Edition['format'] {
  if (!raw) return undefined;
  const f = raw.toLowerCase();
  if (/hardcover|hardback|gebunden|tapa dura|reli[ée]|cartonn/.test(f)) return 'hardcover';
  if (/paperback|softcover|taschenbuch|mass market|r[uú]stica|broch[ée]|poche|bolsillo/.test(f)) return 'paperback';
  if (/e-?book|kindle|epub|electronic/.test(f)) return 'ebook';
  return 'other';
}

/**
 * Converts edition entries of one work to Editions. Entries without a cover
 * are dropped. Author names come from the work because the endpoint only
 * returns author keys (SPEC §3 F3.1).
 */
export function parseEditions(entries: readonly OlEditionEntry[], work: Work): Edition[] {
  const out: Edition[] = [];
  for (const e of entries) {
    const coverId = e.covers?.find(c => c > 0);
    if (!coverId || !e.key) continue;
    const title = e.title?.trim() || work.title;
    if (looksLikeNonBook(title) || /audio/i.test(e.physical_format ?? '')) continue;

    const isbn13 = cleanIsbn(e.isbn_13?.[0]);
    const isbn10 = cleanIsbn(e.isbn_10?.[0]);

    out.push({
      id: `ol:${e.key.replace('/books/', '')}`,
      workId: work.id,
      source: 'openlibrary',
      title,
      coverUrl: olCoverUrl(coverId, 'L'),
      coverUrlSmall: olCoverUrl(coverId, 'M'),
      language: toIsoLanguage(e.languages?.[0]?.key),
      publisher: e.publishers?.[0],
      publishedDate: e.publish_date,
      year: parseYear(e.publish_date),
      isbn13: isbn13 ?? (isbn10 ? isbn10to13(isbn10) : undefined),
      isbn10,
      pageCount: e.number_of_pages,
      format: parseFormat(e.physical_format),
    });
  }
  return out;
}

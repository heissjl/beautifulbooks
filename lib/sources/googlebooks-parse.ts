/**
 * Pure parser for Google Books `volumes` responses. No I/O.
 *
 * Google Books has no work concept, so this yields edition candidates that
 * still need to be attached to a work by title + author (SPEC §3 F3.2).
 */
import type { SourceEdition } from '../model';
import {
  cleanAuthors, cleanIsbn, isbn10to13, looksLikeNonBook, parseYear, stripHtml, toIsoLanguage,
} from '../normalize';

export interface GbVolume {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    printType?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    pageCount?: number;
    language?: string;
    previewLink?: string;
  };
  saleInfo?: { buyLink?: string };
}

/** A source edition that is not yet assigned to a work. */
export interface EditionCandidate extends Omit<SourceEdition, 'workId'> {
  authors: string[];
  /** Convenience: the single Google cover, also present in `covers[0]`. */
  coverUrl: string;
}

/** Larger, curl-free cover from the thumbnail URL Google returns. */
export function gbCoverUrl(thumbnail: string, zoom: 1 | 2 | 3 = 2): string {
  return thumbnail
    .replace(/^http:\/\//, 'https://')
    .replace(/&edge=curl/, '')
    .replace(/zoom=\d/, `zoom=${zoom}`);
}

export function parseVolumes(items: readonly GbVolume[] | undefined): EditionCandidate[] {
  const out: EditionCandidate[] = [];
  for (const v of items ?? []) {
    const info = v.volumeInfo;
    const thumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
    if (!v.id || !info.title || !thumb) continue;
    if (info.printType && info.printType !== 'BOOK') continue;
    if (looksLikeNonBook(info.title, info.description)) continue;
    const authors = cleanAuthors(info.authors);
    if (authors.length === 0) continue;

    const ids = info.industryIdentifiers ?? [];
    const isbn13 = cleanIsbn(ids.find(i => i.type === 'ISBN_13')?.identifier);
    const isbn10 = cleanIsbn(ids.find(i => i.type === 'ISBN_10')?.identifier);

    out.push({
      id: `gb:${v.id}`,
      source: 'googlebooks',
      title: info.title,
      authors,
      coverUrl: gbCoverUrl(thumb, 2),
      covers: [{ id: `gb:${v.id}`, url: gbCoverUrl(thumb, 2), urlSmall: gbCoverUrl(thumb, 1) }],
      language: toIsoLanguage(info.language),
      publisher: info.publisher,
      publishedDate: info.publishedDate,
      year: parseYear(info.publishedDate),
      isbn13: isbn13 ?? (isbn10 ? isbn10to13(isbn10) : undefined),
      isbn10,
      pageCount: info.pageCount,
      description: stripHtml(info.description),
      previewUrl: info.previewLink,
    });
  }
  return out;
}

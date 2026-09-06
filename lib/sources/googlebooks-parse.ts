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

export const GB_COVER_WIDTH_LARGE = 800;
export const GB_COVER_WIDTH_SMALL = 300;

/**
 * Cover URL at a usable size from the thumbnail URL Google returns.
 *
 * Only `zoom=1` (and 5) come from Google's cover database; `zoom=2` and up
 * are pages from the book scan and can be a half-title page instead of the
 * cover (observed for Mumbo Jumbo 9780684824772). Larger versions of the
 * zoom=1 cover are requested with the `fife=w<px>` resize parameter, which
 * caps at the native size.
 */
export function gbCoverUrl(thumbnail: string, width: number = GB_COVER_WIDTH_LARGE): string {
  const base = thumbnail
    .replace(/^http:\/\//, 'https://')
    .replace(/&edge=curl/, '')
    .replace(/&fife=[^&]*/, '')
    .replace(/zoom=\d/, 'zoom=1');
  return `${base}&fife=w${width}`;
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
      coverUrl: gbCoverUrl(thumb),
      covers: [{ id: `gb:${v.id}`, url: gbCoverUrl(thumb), urlSmall: gbCoverUrl(thumb, GB_COVER_WIDTH_SMALL) }],
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

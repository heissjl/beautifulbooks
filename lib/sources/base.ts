import type { BookEdition } from '@/types/book';

export interface BookSource {
  name: string;
  search(query: string, options?: SearchOptions): Promise<BookEdition[]>;
  getEditions(workId: string): Promise<BookEdition[]>;
  getDetails(id: string): Promise<BookEdition | null>;
}

export interface SearchOptions {
  language?: string;
  maxResults?: number;
  includeAudiobooks?: boolean;
}

export interface NormalizedBook {
  workId: string;
  title: string;
  normalizedTitle: string;
  authors: string[];
  normalizedAuthors: string[];
  editions: BookEdition[];
  primaryEdition?: BookEdition; // The edition that defines this work (for linking)
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAuthor(author: string): string {
  return author
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

export function isAudiobook(book: BookEdition): boolean {
  const title = book.title?.toLowerCase() || '';
  const description = book.description?.toLowerCase() || '';

  const audioIndicators = [
    'audiobook',
    'audio book',
    'audio cd',
    'audio edition',
    'unabridged audio',
    'narrated by',
    'audio download',
    'mp3 cd',
  ];

  return audioIndicators.some(indicator =>
    title.includes(indicator) || description.includes(indicator)
  );
}

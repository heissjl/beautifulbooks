import type { BookEdition, OpenLibraryWork } from '@/types/book';
import type { BookSource, SearchOptions } from './base';
import { isAudiobook } from './base';

const OPEN_LIBRARY_API = 'https://openlibrary.org/search.json';

// Map Open Library 3-letter codes to 2-letter ISO codes
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'eng': 'en',
  'spa': 'es',
  'fre': 'fr',
  'ger': 'de',
  'ita': 'it',
  'por': 'pt',
  'rus': 'ru',
  'jpn': 'ja',
  'chi': 'zh',
};

// Reverse map: 2-letter ISO codes to Open Library 3-letter codes
const ISO_TO_OL_CODE: Record<string, string> = {
  'en': 'eng',
  'es': 'spa',
  'fr': 'fre',
  'de': 'ger',
  'it': 'ita',
  'pt': 'por',
  'ru': 'rus',
  'ja': 'jpn',
  'zh': 'chi',
};

function normalizeLanguageCode(olCode: string | undefined): string | undefined {
  if (!olCode) return undefined;
  return LANGUAGE_CODE_MAP[olCode] || olCode;
}

function toOpenLibraryLanguageCode(isoCode: string | undefined): string | undefined {
  if (!isoCode) return undefined;
  return ISO_TO_OL_CODE[isoCode] || isoCode;
}

export class OpenLibrarySource implements BookSource {
  name = 'Open Library';

  async search(query: string, options: SearchOptions = {}): Promise<BookEdition[]> {
    try {
      const { maxResults = 10, includeAudiobooks = false, language } = options;

      let searchUrl = `${OPEN_LIBRARY_API}?q=${encodeURIComponent(query)}&limit=${maxResults}`;

      // Add language filter if specified (convert 2-letter ISO to 3-letter OL code)
      if (language) {
        const olLanguageCode = toOpenLibraryLanguageCode(language);
        if (olLanguageCode) {
          searchUrl += `&language=${olLanguageCode}`;
        }
      }

      const response = await fetch(searchUrl);

      if (!response.ok) {
        throw new Error('Open Library API request failed');
      }

      const data = await response.json();

      if (!data.docs) {
        return [];
      }

      return data.docs
        .map((doc: OpenLibraryWork) => {
          const book = this.convertToEdition(doc, language);
          console.log(`[OpenLibrary] Converted: "${book.title}" by ${book.authors?.join(', ')} - lang: ${book.language}, cover: ${book.coverImage ? 'YES' : 'NO'}`);
          return book;
        })
        .filter((book: BookEdition) => {
          if (!book.coverImage) {
            console.log(`[OpenLibrary] FILTERED OUT (no cover): "${book.title}"`);
            return false;
          }
          if (!includeAudiobooks && isAudiobook(book)) {
            console.log(`[OpenLibrary] FILTERED OUT (audiobook): "${book.title}"`);
            return false;
          }

          // Additional language filter on results
          if (language && book.language && book.language !== language) {
            console.log(`[OpenLibrary] FILTERED OUT (language ${book.language} !== ${language}): "${book.title}"`);
            return false;
          }

          const lowerTitle = book.title?.toLowerCase() || '';
          if (lowerTitle.includes('journal') || lowerTitle.includes('proceedings')) {
            console.log(`[OpenLibrary] FILTERED OUT (journal/proceedings): "${book.title}"`);
            return false;
          }

          console.log(`[OpenLibrary] KEPT: "${book.title}" by ${book.authors?.join(', ')}`);
          return true;
        });
    } catch (error) {
      console.error('Error fetching from Open Library:', error);
      return [];
    }
  }

  async getEditions(workIdOrTitle: string): Promise<BookEdition[]> {
    try {
      let workId = workIdOrTitle;

      // If it's not a work ID (doesn't start with OL and end with W), search for it
      if (!workIdOrTitle.match(/^OL\d+W$/)) {
        // It's a title, search for the work first
        const searchResponse = await fetch(
          `${OPEN_LIBRARY_API}?q=${encodeURIComponent(workIdOrTitle)}&limit=1`
        );

        if (!searchResponse.ok) {
          return [];
        }

        const searchData = await searchResponse.json();

        if (!searchData.docs || searchData.docs.length === 0) {
          return [];
        }

        // Extract work ID from the first result
        const workKey = searchData.docs[0].key;
        if (!workKey) {
          return [];
        }

        workId = workKey.replace('/works/', '');
      }

      // Now fetch editions using the work ID
      const editionsResponse = await fetch(
        `https://openlibrary.org/works/${workId}/editions.json?limit=100`
      );

      if (!editionsResponse.ok) {
        return [];
      }

      const editionsData = await editionsResponse.json();

      if (!editionsData.entries) {
        return [];
      }

      return editionsData.entries
        .filter((edition: any) => {
          return edition.covers && edition.covers.length > 0 && edition.covers[0] > 0;
        })
        .map((edition: any) => this.convertEditionToBookEdition(edition));
    } catch (error) {
      console.error('Error fetching Open Library editions:', error);
      return [];
    }
  }

  async getDetails(workId: string): Promise<BookEdition | null> {
    try {
      const response = await fetch(`https://openlibrary.org/works/${workId}.json`);

      if (!response.ok) {
        return null;
      }

      const work = await response.json();

      const editionResponse = await fetch(
        `https://openlibrary.org/search.json?q=key:/works/${workId}&limit=1`
      );

      const editionData = await editionResponse.json();

      if (editionData.docs && editionData.docs.length > 0) {
        return this.convertToEdition(editionData.docs[0]);
      }

      return null;
    } catch (error) {
      console.error('Error fetching Open Library details:', error);
      return null;
    }
  }

  private convertToEdition(work: OpenLibraryWork, requestedLanguage?: string): BookEdition {
    const isbn = work.isbn?.[0];
    const coverId = work.cover_i;
    const workId = work.key?.replace('/works/', '') || '';

    // Open Library returns language as an array like ["eng", "fre", "spa"]
    // If we filtered by language, use the requested language (the work was returned because it has that language)
    // Otherwise, take the first language as the primary language
    let primaryLanguage: string | undefined;
    if (requestedLanguage && work.language?.length) {
      // Use the requested language if the work has it
      const olRequestedLang = toOpenLibraryLanguageCode(requestedLanguage);
      if (work.language.includes(olRequestedLang || '')) {
        primaryLanguage = requestedLanguage;
      } else {
        // Fallback to first language
        primaryLanguage = normalizeLanguageCode(work.language[0]);
      }
    } else {
      // No language filter, just use first language
      primaryLanguage = normalizeLanguageCode(work.language?.[0]);
    }

    return {
      id: `ol-${workId}`,
      sourceId: workId,
      source: 'open-library',
      workId: workId,
      title: work.title,
      authors: work.author_name,
      publisher: work.publisher?.[0],
      publishedDate: work.publish_date?.[0] || work.first_publish_year?.toString(),
      coverImage: coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
        : undefined,
      isbn,
      language: primaryLanguage,
      editionCount: work.edition_count,
      buyLinks: isbn
        ? [
            {
              name: 'Amazon',
              url: `https://www.amazon.com/s?k=${isbn}`,
            },
            {
              name: 'AbeBooks',
              url: `https://www.abebooks.com/servlet/SearchResults?isbn=${isbn}`,
            },
            {
              name: 'Book Depository',
              url: `https://www.bookdepository.com/search?searchTerm=${isbn}`,
            },
          ]
        : [],
    };
  }

  private convertEditionToBookEdition(edition: any): BookEdition {
    const isbn = edition.isbn_13?.[0] || edition.isbn_10?.[0];
    const coverId = edition.covers[0];
    const editionKey = edition.key.replace('/books/', '');

    // Extract and normalize language code
    const rawLanguage = edition.languages?.[0]?.key?.replace('/languages/', '');
    const language = normalizeLanguageCode(rawLanguage);

    return {
      id: `ol-edition-${editionKey}`,
      sourceId: editionKey,
      source: 'open-library',
      title: edition.title || '',
      authors: edition.authors?.map((a: any) => a.name).filter(Boolean) || [],
      publisher: edition.publishers?.[0],
      publishedDate: edition.publish_date,
      coverImage: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
      isbn,
      pageCount: edition.number_of_pages,
      language,
      buyLinks: isbn
        ? [
            {
              name: 'Amazon',
              url: `https://www.amazon.com/s?k=${isbn}`,
            },
            {
              name: 'AbeBooks',
              url: `https://www.abebooks.com/servlet/SearchResults?isbn=${isbn}`,
            },
            {
              name: 'Book Depository',
              url: `https://www.bookdepository.com/search?searchTerm=${isbn}`,
            },
          ]
        : [],
    };
  }
}

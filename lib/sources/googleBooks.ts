import type { BookEdition, GoogleBooksVolume } from '@/types/book';
import type { BookSource, SearchOptions } from './base';
import { isAudiobook } from './base';

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

export class GoogleBooksSource implements BookSource {
  name = 'Google Books';

  async search(query: string, options: SearchOptions = {}): Promise<BookEdition[]> {
    try {
      const { language = 'en', maxResults = 20, includeAudiobooks = false } = options;

      let queryParams = `q=intitle:${encodeURIComponent(query)}`;
      queryParams += `&maxResults=${maxResults}`;
      queryParams += '&printType=books';
      queryParams += '&orderBy=relevance';

      if (language) {
        queryParams += `&langRestrict=${language}`;
      }

      const response = await fetch(`${GOOGLE_BOOKS_API}?${queryParams}`);

      if (!response.ok) {
        throw new Error('Google Books API request failed');
      }

      const data = await response.json();

      if (!data.items) {
        return [];
      }

      return data.items
        .map((item: GoogleBooksVolume) => this.convertToEdition(item))
        .filter((book: BookEdition) => {
          if (!book.coverImage) return false;
          if (!includeAudiobooks && isAudiobook(book)) return false;

          // Additional language filter on results (Google Books langRestrict is unreliable)
          if (language && book.language && book.language !== language) {
            return false;
          }

          const lowerTitle = book.title?.toLowerCase() || '';
          if (lowerTitle.includes('journal') || lowerTitle.includes('proceedings')) {
            return false;
          }

          return true;
        });
    } catch (error) {
      console.error('Error fetching from Google Books:', error);
      return [];
    }
  }

  async getEditions(workTitle: string): Promise<BookEdition[]> {
    try {
      const response = await fetch(
        `${GOOGLE_BOOKS_API}?q=intitle:${encodeURIComponent(workTitle)}&maxResults=40&printType=books&orderBy=relevance`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      if (!data.items) {
        return [];
      }

      return data.items
        .filter((item: GoogleBooksVolume) => {
          const info = item.volumeInfo;
          if (!info.imageLinks?.thumbnail) return false;
          const titleMatch = info.title?.toLowerCase().includes(workTitle.toLowerCase());
          return titleMatch;
        })
        .map((item: GoogleBooksVolume) => this.convertToEdition(item));
    } catch (error) {
      console.error('Error fetching Google Book editions:', error);
      return [];
    }
  }

  async getDetails(id: string): Promise<BookEdition | null> {
    try {
      const response = await fetch(`${GOOGLE_BOOKS_API}/${id}`);

      if (!response.ok) {
        return null;
      }

      const volume: GoogleBooksVolume = await response.json();
      return this.convertToEdition(volume);
    } catch (error) {
      console.error('Error fetching Google Book details:', error);
      return null;
    }
  }

  private convertToEdition(volume: GoogleBooksVolume): BookEdition {
    const isbn = volume.volumeInfo.industryIdentifiers?.find(
      id => id.type === 'ISBN_13' || id.type === 'ISBN_10'
    )?.identifier;

    return {
      id: `gb-${volume.id}`,
      sourceId: volume.id,
      source: 'google-books',
      title: volume.volumeInfo.title,
      authors: volume.volumeInfo.authors,
      publisher: volume.volumeInfo.publisher,
      publishedDate: volume.volumeInfo.publishedDate,
      description: volume.volumeInfo.description,
      coverImage: volume.volumeInfo.imageLinks?.thumbnail?.replace('http://', 'https://'),
      isbn,
      pageCount: volume.volumeInfo.pageCount,
      language: volume.volumeInfo.language,
      previewLink: volume.volumeInfo.previewLink,
      buyLinks: volume.saleInfo?.buyLink
        ? [
            {
              name: 'Google Books',
              url: volume.saleInfo.buyLink,
              price: volume.saleInfo.listPrice
                ? `${volume.saleInfo.listPrice.amount} ${volume.saleInfo.listPrice.currencyCode}`
                : undefined,
            },
          ]
        : [],
    };
  }
}

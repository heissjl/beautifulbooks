import type { BookEdition, GoogleBooksVolume, OpenLibraryWork } from '@/types/book';

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_API = 'https://openlibrary.org/search.json';

export async function searchBooks(query: string): Promise<BookEdition[]> {
  try {
    const [googleBooks, openLibraryBooks] = await Promise.all([
      searchGoogleBooks(query),
      searchOpenLibrary(query),
    ]);

    const combined = [...googleBooks, ...openLibraryBooks];

    const uniqueBooks = Array.from(
      new Map(combined.map(book => [book.id, book])).values()
    );

    return uniqueBooks;
  } catch (error) {
    console.error('Error searching books:', error);
    throw error;
  }
}

async function searchGoogleBooks(query: string): Promise<BookEdition[]> {
  try {
    const response = await fetch(
      `${GOOGLE_BOOKS_API}?q=intitle:${encodeURIComponent(query)}&maxResults=20&printType=books&orderBy=relevance&langRestrict=en`
    );

    if (!response.ok) {
      throw new Error('Google Books API request failed');
    }

    const data = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items
      .filter((item: GoogleBooksVolume) => {
        const info = item.volumeInfo;
        if (!info.imageLinks?.thumbnail) return false;
        if (info.printType && info.printType !== 'BOOK') return false;
        const lowerTitle = info.title?.toLowerCase() || '';
        if (lowerTitle.includes('journal') || lowerTitle.includes('proceedings')) return false;
        return true;
      })
      .map((item: GoogleBooksVolume) => convertGoogleBookToEdition(item));
  } catch (error) {
    console.error('Error fetching from Google Books:', error);
    return [];
  }
}

async function searchOpenLibrary(query: string): Promise<BookEdition[]> {
  try {
    const response = await fetch(
      `${OPEN_LIBRARY_API}?title=${encodeURIComponent(query)}&limit=10`
    );

    if (!response.ok) {
      throw new Error('Open Library API request failed');
    }

    const data = await response.json();

    if (!data.docs) {
      return [];
    }

    return data.docs
      .filter((doc: OpenLibraryWork) => {
        if (!doc.cover_i) return false;
        const lowerTitle = doc.title?.toLowerCase() || '';
        if (lowerTitle.includes('journal') || lowerTitle.includes('proceedings')) return false;
        return true;
      })
      .map((doc: OpenLibraryWork) => convertOpenLibraryToEdition(doc));
  } catch (error) {
    console.error('Error fetching from Open Library:', error);
    return [];
  }
}

function convertGoogleBookToEdition(volume: GoogleBooksVolume): BookEdition {
  const isbn = volume.volumeInfo.industryIdentifiers?.find(
    id => id.type === 'ISBN_13' || id.type === 'ISBN_10'
  )?.identifier;

  return {
    id: `gb-${volume.id}`,
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

function convertOpenLibraryToEdition(work: OpenLibraryWork): BookEdition {
  const isbn = work.isbn?.[0];
  const coverId = work.cover_i;

  return {
    id: `ol-${work.key.replace('/works/', '')}`,
    title: work.title,
    authors: work.author_name,
    publisher: work.publisher?.[0],
    publishedDate: work.publish_date?.[0] || work.first_publish_year?.toString(),
    coverImage: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : undefined,
    isbn,
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

export async function getBookDetails(id: string): Promise<BookEdition | null> {
  const [source, bookId] = id.split('-');

  if (source === 'gb') {
    return getGoogleBookDetails(bookId);
  } else if (source === 'ol') {
    return getOpenLibraryDetails(bookId);
  }

  return null;
}

export async function getAllEditions(id: string): Promise<BookEdition[]> {
  const [source, bookId] = id.split('-');

  if (source === 'gb') {
    return getGoogleBookEditions(bookId);
  } else if (source === 'ol') {
    return getOpenLibraryEditions(bookId);
  }

  return [];
}

async function getGoogleBookDetails(id: string): Promise<BookEdition | null> {
  try {
    const response = await fetch(`${GOOGLE_BOOKS_API}/${id}`);

    if (!response.ok) {
      return null;
    }

    const volume: GoogleBooksVolume = await response.json();
    return convertGoogleBookToEdition(volume);
  } catch (error) {
    console.error('Error fetching Google Book details:', error);
    return null;
  }
}

async function getOpenLibraryDetails(id: string): Promise<BookEdition | null> {
  try {
    const response = await fetch(`https://openlibrary.org/works/${id}.json`);

    if (!response.ok) {
      return null;
    }

    const work = await response.json();

    const editionResponse = await fetch(
      `https://openlibrary.org/search.json?q=key:/works/${id}&limit=1`
    );

    const editionData = await editionResponse.json();

    if (editionData.docs && editionData.docs.length > 0) {
      return convertOpenLibraryToEdition(editionData.docs[0]);
    }

    return null;
  } catch (error) {
    console.error('Error fetching Open Library details:', error);
    return null;
  }
}

async function getGoogleBookEditions(id: string): Promise<BookEdition[]> {
  try {
    const mainBook = await getGoogleBookDetails(id);
    if (!mainBook) return [];

    const searchQuery = mainBook.title;
    const response = await fetch(
      `${GOOGLE_BOOKS_API}?q=intitle:${encodeURIComponent(searchQuery)}&maxResults=40&printType=books&orderBy=relevance`
    );

    if (!response.ok) {
      return [mainBook];
    }

    const data = await response.json();

    if (!data.items) {
      return [mainBook];
    }

    const editions = data.items
      .filter((item: GoogleBooksVolume) => {
        const info = item.volumeInfo;
        if (!info.imageLinks?.thumbnail) return false;
        const titleMatch = info.title?.toLowerCase().includes(searchQuery.toLowerCase());
        return titleMatch;
      })
      .map((item: GoogleBooksVolume) => convertGoogleBookToEdition(item));

    const uniqueEditions = Array.from(
      new Map(editions.map(book => [book.id, book])).values()
    );

    return uniqueEditions.length > 0 ? uniqueEditions : [mainBook];
  } catch (error) {
    console.error('Error fetching Google Book editions:', error);
    return [];
  }
}

async function getOpenLibraryEditions(workId: string): Promise<BookEdition[]> {
  try {
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

    const editions: BookEdition[] = editionsData.entries
      .filter((edition: any) => {
        return edition.covers && edition.covers.length > 0 && edition.covers[0] > 0;
      })
      .map((edition: any) => {
        const isbn = edition.isbn_13?.[0] || edition.isbn_10?.[0];
        const coverId = edition.covers[0];

        return {
          id: `ol-edition-${edition.key.replace('/books/', '')}`,
          title: edition.title || '',
          authors: edition.authors?.map((a: any) => a.name || 'Unknown') || [],
          publisher: edition.publishers?.[0],
          publishedDate: edition.publish_date,
          coverImage: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
          isbn,
          pageCount: edition.number_of_pages,
          language: edition.languages?.[0]?.key?.replace('/languages/', ''),
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
      });

    return editions;
  } catch (error) {
    console.error('Error fetching Open Library editions:', error);
    return [];
  }
}

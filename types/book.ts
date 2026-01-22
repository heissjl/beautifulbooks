export interface BookEdition {
  id: string;
  sourceId?: string;
  source?: string;
  workId?: string;
  title: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  coverImage?: string;
  spineImage?: string;
  isbn?: string;
  pageCount?: number;
  language?: string;
  previewLink?: string;
  buyLinks?: BuyLink[];
  editionCount?: number;
}

export interface BuyLink {
  name: string;
  url: string;
  price?: string;
}

export interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    printType?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    pageCount?: number;
    language?: string;
    previewLink?: string;
  };
  saleInfo?: {
    buyLink?: string;
    listPrice?: {
      amount: number;
      currencyCode: string;
    };
  };
}

export interface OpenLibraryWork {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  publisher?: string[];
  publish_date?: string[];
  edition_count?: number;
  language?: string[]; // Array of language codes like ["eng", "fre"]
}

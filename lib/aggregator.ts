import type { BookEdition } from '@/types/book';
import type { BookSource, SearchOptions, NormalizedBook } from './sources/base';
import { normalizeTitle, normalizeAuthor } from './sources/base';
import { GoogleBooksSource } from './sources/googleBooks';
import { OpenLibrarySource } from './sources/openLibrary';

/**
 * SIMPLE SEARCH AGGREGATOR - Clean rewrite
 *
 * Core principles:
 * 1. Work = Title + Author (language is an edition attribute)
 * 2. Trust Open Library workIds - they're already correct groupings
 * 3. Only filter by author when we don't have a trustworthy workId
 * 4. Keep it simple - fewer edge cases, clearer logic
 */
export class BookAggregator {
  private sources: BookSource[];

  constructor() {
    this.sources = [
      new OpenLibrarySource(),
      new GoogleBooksSource(),
    ];
  }

  async search(query: string, options: SearchOptions = {}): Promise<NormalizedBook[]> {
    // Step 1: Get search results from all sources
    const allSearchResults = await Promise.all(
      this.sources.map(source => source.search(query, options))
    );
    const flatResults = allSearchResults.flat();

    // Step 2: Group into works (Title + Author)
    const works = this.groupIntoWorks(flatResults);

    // Step 3: For each work, fetch ALL editions
    const worksWithAllEditions = await Promise.all(
      works.map(work => this.fetchAllEditionsForWork(work))
    );

    // Step 4: Remove empty works and sort by relevance
    return worksWithAllEditions
      .filter(work => work.editions.length > 0)
      .sort((a, b) => {
        const aScore = this.calculateRelevance(a, query);
        const bScore = this.calculateRelevance(b, query);
        return bScore - aScore;
      });
  }

  async getAllEditions(bookId: string): Promise<BookEdition[]> {
    const [source, id] = bookId.split('-', 2);

    // Get the book details first
    const book = await this.getBookDetails(bookId);
    if (!book) return [];

    // If it has a workId (Open Library), use that
    if (book.workId) {
      const olSource = this.sources.find(s => s.name === 'Open Library') as OpenLibrarySource;
      if (olSource) {
        return olSource.getEditions(book.workId);
      }
    }

    // Otherwise, search by title and filter by author
    const allEditions = await Promise.all(
      this.sources.map(s => s.getEditions(book.title))
    );

    return this.filterEditionsByAuthor(allEditions.flat(), book.authors || []);
  }

  async getBookDetails(bookId: string): Promise<BookEdition | null> {
    const [source, id] = bookId.split('-', 2);

    let bookSource: BookSource | undefined;
    if (source === 'gb') {
      bookSource = this.sources.find(s => s.name === 'Google Books');
    } else if (source === 'ol') {
      bookSource = this.sources.find(s => s.name === 'Open Library');
    }

    if (!bookSource) return null;
    return bookSource.getDetails(id);
  }

  private groupIntoWorks(editions: BookEdition[]): NormalizedBook[] {
    const workMap = new Map<string, NormalizedBook>();

    for (const edition of editions) {
      const key = this.makeWorkKey(edition);

      if (workMap.has(key)) {
        // Add to existing work
        const work = workMap.get(key)!;
        if (!work.editions.some(e => e.id === edition.id)) {
          work.editions.push(edition);
        }
      } else {
        // Create new work
        workMap.set(key, {
          workId: edition.workId || key,
          title: edition.title,
          normalizedTitle: normalizeTitle(edition.title),
          authors: edition.authors || [],
          normalizedAuthors: (edition.authors || []).map(normalizeAuthor),
          editions: [edition],
          primaryEdition: edition,
        });
      }
    }

    return Array.from(workMap.values());
  }

  private makeWorkKey(edition: BookEdition): string {
    const title = normalizeTitle(edition.title);
    const author = edition.authors?.[0] ? normalizeAuthor(edition.authors[0]) : 'unknown';

    // If we have an Open Library workId, use it with author
    // (workIds can sometimes be shared by different authors)
    if (edition.workId && edition.workId.startsWith('OL')) {
      return `${edition.workId}::${author}`;
    }

    // Otherwise use title + author
    return `${title}::${author}`;
  }

  private async fetchAllEditionsForWork(work: NormalizedBook): Promise<NormalizedBook> {
    const firstEdition = work.editions[0];

    // Case 1: We have an Open Library workId - TRUST IT
    if (firstEdition.workId && firstEdition.workId.startsWith('OL')) {
      const olSource = this.sources.find(s => s.name === 'Open Library') as OpenLibrarySource;
      if (olSource) {
        try {
          const olEditions = await olSource.getEditions(firstEdition.workId);

          // Also try to get from Google Books (search by title, filter by author)
          const gbSource = this.sources.find(s => s.name === 'Google Books');
          let gbEditions: BookEdition[] = [];
          if (gbSource && work.authors.length > 0) {
            const searchResults = await gbSource.getEditions(work.title);
            gbEditions = this.filterEditionsByAuthor(searchResults, work.authors);
          }

          // Combine and deduplicate
          const allEditions = [...olEditions, ...gbEditions];
          const uniqueEditions = this.deduplicateEditions(allEditions);

          return { ...work, editions: uniqueEditions };
        } catch (error) {
          console.error(`Error fetching OL editions for ${firstEdition.workId}:`, error);
        }
      }
    }

    // Case 2: No reliable workId - search by title and filter by author
    if (work.authors.length > 0) {
      const editionResults = await Promise.all(
        this.sources.map(async (source) => {
          try {
            const editions = await source.getEditions(work.title);
            return this.filterEditionsByAuthor(editions, work.authors);
          } catch (error) {
            console.error(`Error fetching from ${source.name}:`, error);
            return [];
          }
        })
      );

      const allEditions = editionResults.flat();
      const uniqueEditions = this.deduplicateEditions(allEditions);

      return { ...work, editions: uniqueEditions };
    }

    // Fallback: just return what we have
    return work;
  }

  private filterEditionsByAuthor(editions: BookEdition[], workAuthors: string[]): BookEdition[] {
    if (workAuthors.length === 0) return editions;

    const normalizedWorkAuthors = workAuthors.map(normalizeAuthor);

    return editions.filter(edition => {
      // If edition has no authors, we can't verify - skip it
      if (!edition.authors || edition.authors.length === 0) {
        return false;
      }

      const normalizedEditionAuthors = edition.authors.map(normalizeAuthor);

      // Check if any work author matches any edition author
      return normalizedWorkAuthors.some(workAuthor =>
        normalizedEditionAuthors.some(editionAuthor =>
          workAuthor.includes(editionAuthor) || editionAuthor.includes(workAuthor)
        )
      );
    });
  }

  private deduplicateEditions(editions: BookEdition[]): BookEdition[] {
    const seen = new Map<string, BookEdition>();

    for (const edition of editions) {
      const key = this.getEditionKey(edition);

      if (!seen.has(key)) {
        seen.set(key, edition);
      } else {
        const existing = seen.get(key)!;
        // Keep the one with more complete data
        if (this.isMoreComplete(edition, existing)) {
          seen.set(key, edition);
        }
      }
    }

    return Array.from(seen.values());
  }

  private getEditionKey(edition: BookEdition): string {
    // Primary: ISBN
    if (edition.isbn) {
      return `isbn:${edition.isbn}`;
    }

    // Secondary: Cover image ID
    if (edition.coverImage) {
      const coverIdMatch = edition.coverImage.match(/\/(\d+)-[LM]\.jpg$/);
      if (coverIdMatch) {
        return `cover:${coverIdMatch[1]}`;
      }
    }

    // Tertiary: Title + Publisher + Year
    const title = normalizeTitle(edition.title);
    const publisher = edition.publisher?.toLowerCase().substring(0, 20) || '';
    const year = edition.publishedDate?.substring(0, 4) || '';

    return `${title}::${publisher}::${year}`;
  }

  private isMoreComplete(a: BookEdition, b: BookEdition): boolean {
    let scoreA = 0;
    let scoreB = 0;

    if (a.description) scoreA += 2;
    if (b.description) scoreB += 2;
    if (a.coverImage) scoreA += 1;
    if (b.coverImage) scoreB += 1;
    if (a.isbn) scoreA += 1;
    if (b.isbn) scoreB += 1;
    if (a.pageCount) scoreA += 1;
    if (b.pageCount) scoreB += 1;
    if (a.publisher) scoreA += 1;
    if (b.publisher) scoreB += 1;

    return scoreA > scoreB;
  }

  private calculateRelevance(book: NormalizedBook, query: string): number {
    const normalizedQuery = normalizeTitle(query);
    let score = 0;

    // Exact title match
    if (book.normalizedTitle === normalizedQuery) {
      score += 100;
    } else if (book.normalizedTitle.startsWith(normalizedQuery)) {
      score += 50;
    } else if (book.normalizedTitle.includes(normalizedQuery)) {
      score += 25;
    }

    // More editions = more popular
    score += Math.min(book.editions.length * 2, 20);

    return score;
  }
}

export const bookAggregator = new BookAggregator();

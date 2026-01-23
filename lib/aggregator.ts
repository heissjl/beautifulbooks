import type { BookEdition } from '@/types/book';
import type { BookSource, SearchOptions, NormalizedBook } from './sources/base';
import { normalizeTitle, normalizeAuthor } from './sources/base';
import { GoogleBooksSource } from './sources/googleBooks';
import { OpenLibrarySource } from './sources/openLibrary';

export class BookAggregator {
  private sources: BookSource[];

  constructor() {
    this.sources = [
      new GoogleBooksSource(),
      new OpenLibrarySource(),
    ];
  }

  async search(query: string, options: SearchOptions = {}): Promise<NormalizedBook[]> {
    // Step 1: Get initial search results from all sources
    console.log(`[Aggregator] Searching for "${query}" with options:`, options);
    const allResults = await Promise.all(
      this.sources.map(async (source) => {
        console.log(`[Aggregator] Querying ${source.name}...`);
        const results = await source.search(query, options);
        console.log(`[Aggregator] ${source.name} returned ${results.length} results`);
        results.forEach(r => console.log(`  - "${r.title}" by ${r.authors?.join(', ')}`));
        return results;
      })
    );

    const flatResults = allResults.flat();
    console.log(`[Aggregator] Total flat results: ${flatResults.length}`);

    // Step 2: Group by work to identify unique books
    const initialGroups = this.groupByWork(flatResults);

    // Step 3: For each work, fetch ALL editions from all sources
    const worksWithAllEditions = await Promise.all(
      initialGroups.map(async (work) => {
        const firstEdition = work.editions[0];

        // Fetch all editions for this work from all sources
        // Filter by author only (language is now an edition attribute, not work-defining)
        const allEditionsResults = await Promise.all(
          this.sources.map(async (source) => {
            try {
              // Use the work ID if available (for Open Library)
              // Still need to filter by author even with work ID
              // because Open Library work IDs can contain different books by different authors
              if (firstEdition.workId && source.name === 'Open Library') {
                const editions = await source.getEditions(firstEdition.workId);
                console.log(`[Aggregator] OL returned ${editions.length} editions for ${firstEdition.workId}`);

                // Filter to only editions that match the same author(s)
                const filtered = editions.filter(edition => {
                  // STRICT: Only include editions with author data that matches
                  // Skip editions without author data - we can't verify they belong to this work
                  if (!edition.authors || edition.authors.length === 0) {
                    return false;
                  }

                  // Skip if work has no authors (shouldn't happen)
                  if (!work.authors || work.authors.length === 0) {
                    return false;
                  }

                  const normalizedWorkAuthors = work.authors.map(a => normalizeAuthor(a));
                  const normalizedEditionAuthors = edition.authors.map(a => normalizeAuthor(a));

                  const authorMatches = normalizedWorkAuthors.some(workAuthor =>
                    normalizedEditionAuthors.some(editionAuthor =>
                      workAuthor.includes(editionAuthor) || editionAuthor.includes(workAuthor)
                    )
                  );

                  return authorMatches;
                });

                console.log(`[Aggregator] After filtering: kept ${filtered.length} editions`);
                return filtered;
              } else {
                // For Google Books, use title but then filter by author
                const editions = await source.getEditions(work.title);

                // Filter to only editions that match the same author(s)
                return editions.filter(edition => {
                  // STRICT: Only include editions with author data that matches
                  if (!edition.authors || edition.authors.length === 0) {
                    return false;
                  }

                  if (!work.authors || work.authors.length === 0) {
                    return false;
                  }

                  const normalizedWorkAuthors = work.authors.map(a => normalizeAuthor(a));
                  const normalizedEditionAuthors = edition.authors.map(a => normalizeAuthor(a));

                  const authorMatches = normalizedWorkAuthors.some(workAuthor =>
                    normalizedEditionAuthors.some(editionAuthor =>
                      workAuthor.includes(editionAuthor) || editionAuthor.includes(workAuthor)
                    )
                  );

                  return authorMatches;
                });
              }
            } catch (error) {
              console.error(`Error fetching editions from ${source.name}:`, error);
              return [];
            }
          })
        );

        const allEditions = allEditionsResults.flat();

        // Deduplicate editions
        const uniqueEditions = this.deduplicateEditions(allEditions);

        return {
          ...work,
          editions: uniqueEditions,
        };
      })
    );

    // Step 4: Filter out works with no editions and sort by relevance
    return worksWithAllEditions
      .filter(work => work.editions.length > 0) // Remove works with no editions
      .sort((a, b) => {
        const aRelevance = this.calculateRelevance(a, query);
        const bRelevance = this.calculateRelevance(b, query);
        return bRelevance - aRelevance;
      });
  }

  async getAllEditions(bookId: string): Promise<BookEdition[]> {
    // This is now mainly for the detail page to get fresh data
    // But we should return the editions we already have
    const [source, id] = bookId.split('-', 2);

    let bookSource: BookSource | undefined;
    let sourceId = id;

    if (source === 'gb') {
      bookSource = this.sources.find(s => s.name === 'Google Books');
    } else if (source === 'ol') {
      bookSource = this.sources.find(s => s.name === 'Open Library');
      if (id.startsWith('edition-')) {
        // This is an edition ID, we need to get the work ID first
        const details = await this.getBookDetails(bookId);
        if (details?.workId) {
          sourceId = details.workId;
        }
      }
    }

    if (!bookSource) {
      return [];
    }

    const details = await bookSource.getDetails(sourceId);
    if (!details) {
      return [];
    }

    // Fetch all editions from all sources
    const title = details.title;
    const workId = details.workId;
    const authors = details.authors || [];

    const allEditionsResults = await Promise.all(
      this.sources.map(async (source) => {
        try {
          if (workId && source.name === 'Open Library') {
            const editions = await source.getEditions(workId);

            // Filter to only editions that match the same author(s)
            return editions.filter(edition => {
              // STRICT: Only include editions with matching author data
              if (!edition.authors || edition.authors.length === 0) return false;
              if (!authors || authors.length === 0) return false;

              const normalizedAuthors = authors.map(a => normalizeAuthor(a));
              const normalizedEditionAuthors = edition.authors.map(a => normalizeAuthor(a));

              const authorMatches = normalizedAuthors.some(author =>
                normalizedEditionAuthors.some(editionAuthor =>
                  author.includes(editionAuthor) || editionAuthor.includes(author)
                )
              );

              return authorMatches;
            });
          } else {
            // For Google Books, fetch by title and filter by author
            const editions = await source.getEditions(title);

            // Filter to only editions that match the same author(s)
            return editions.filter(edition => {
              // STRICT: Only include editions with matching author data
              if (!edition.authors || edition.authors.length === 0) return false;
              if (!authors || authors.length === 0) return false;

              const normalizedAuthors = authors.map(a => normalizeAuthor(a));
              const normalizedEditionAuthors = edition.authors.map(a => normalizeAuthor(a));

              const authorMatches = normalizedAuthors.some(author =>
                normalizedEditionAuthors.some(editionAuthor =>
                  author.includes(editionAuthor) || editionAuthor.includes(author)
                )
              );

              return authorMatches;
            });
          }
        } catch (error) {
          console.error(`Error fetching editions from ${source.name}:`, error);
          return [];
        }
      })
    );

    const allEditions = allEditionsResults.flat();

    return this.deduplicateEditions(allEditions);
  }

  async getBookDetails(bookId: string): Promise<BookEdition | null> {
    const [source, id] = bookId.split('-', 2);

    let bookSource: BookSource | undefined;

    if (source === 'gb') {
      bookSource = this.sources.find(s => s.name === 'Google Books');
    } else if (source === 'ol') {
      bookSource = this.sources.find(s => s.name === 'Open Library');
    }

    if (!bookSource) {
      return null;
    }

    return bookSource.getDetails(id);
  }

  private groupByWork(books: BookEdition[]): NormalizedBook[] {
    const workMap = new Map<string, NormalizedBook>();

    for (const book of books) {
      const key = this.getWorkKey(book);

      if (workMap.has(key)) {
        const existing = workMap.get(key)!;
        // Don't add duplicate, just track that we found this work
        if (!existing.editions.some(e => e.id === book.id)) {
          existing.editions.push(book);
        }
      } else {
        // Use the key itself as a stable work ID (it's unique per work)
        const normalizedBook: NormalizedBook = {
          workId: book.workId || key, // Use the grouping key as fallback
          title: book.title,
          normalizedTitle: normalizeTitle(book.title),
          authors: book.authors || [],
          normalizedAuthors: (book.authors || []).map(normalizeAuthor),
          editions: [book],
          primaryEdition: book, // Keep track of the defining edition for linking
        };
        workMap.set(key, normalizedBook);
      }
    }

    return Array.from(workMap.values());
  }

  private getWorkKey(book: BookEdition): string {
    const title = normalizeTitle(book.title);
    const author = book.authors?.[0] ? normalizeAuthor(book.authors[0]) : 'unknown';

    // A WORK is defined as: book + author (language is an EDITION attribute)
    // All translations are editions of the SAME work
    // ALWAYS include author in the key, even with workId, because Open Library
    // sometimes assigns the same workId to different books by different authors
    if (book.workId) {
      return `work:${book.workId}::${author}`;
    }

    return `${title}::${author}`;
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
    // Primary: Use ISBN if available (most reliable)
    if (edition.isbn) {
      return `isbn:${edition.isbn}`;
    }

    // Secondary: Use cover image URL (often unique per edition)
    if (edition.coverImage) {
      const coverIdMatch = edition.coverImage.match(/\/(\d+)-[LM]\.jpg$/);
      if (coverIdMatch) {
        return `cover:${coverIdMatch[1]}`;
      }
    }

    // Tertiary: Use title + publisher + year
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
    const queryWords = normalizedQuery.split(' ');
    let score = 0;

    // Exact title match
    if (book.normalizedTitle === normalizedQuery) {
      score += 100;
    } else if (book.normalizedTitle.startsWith(normalizedQuery)) {
      score += 50;
    } else if (book.normalizedTitle.includes(normalizedQuery)) {
      score += 25;
    }

    // Check if query contains author name - if so, strongly prefer books BY that author
    // This helps prioritize "Gravity's Rainbow by Pynchon" over "Guide to Pynchon's Gravity's Rainbow by Someone Else"
    const queryContainsAuthor = book.normalizedAuthors.some(author =>
      queryWords.some(word => word.length > 3 && author.includes(word))
    );

    console.log(`[Relevance] "${book.title}" by ${book.authors.join(', ')}`);
    console.log(`  - Query: "${query}" -> normalized: "${normalizedQuery}"`);
    console.log(`  - Authors: ${book.normalizedAuthors.join(', ')}`);
    console.log(`  - Query contains author: ${queryContainsAuthor}`);

    if (queryContainsAuthor) {
      // Big boost if the book is BY the author mentioned in the query
      score += 150;
      console.log(`  - Author boost: +150`);
    } else {
      // Small penalty if query mentions an author but this book is by someone else
      const queryHasAuthorWord = queryWords.some(word =>
        word.length > 3 && ['by', 'author'].every(stopWord => word !== stopWord)
      );
      if (queryHasAuthorWord && book.normalizedAuthors.length > 0) {
        score -= 50;
        console.log(`  - Author penalty: -50`);
      }
    }

    // More editions = more popular/relevant
    score += Math.min(book.editions.length * 2, 20);

    console.log(`  - Total score: ${score}`);

    return score;
  }
}

export const bookAggregator = new BookAggregator();

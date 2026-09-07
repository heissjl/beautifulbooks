/**
 * Titles, descriptions and structured data for a work page (SPEC §10 D10).
 *
 * Pure, so the wording is testable. Every sentence here is subject to the
 * rule in CLAUDE.md: no copy claims completeness. That holds for the meta
 * tags in particular — nobody reads them, which is exactly why a false claim
 * would survive there longest.
 */
import type { Cover, Work } from './model';

/** Where the site is served from; needed for absolute image and canonical URLs. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const SITE_NAME = 'Beautiful Books';

/** "George Orwell", or "Mary Shelley and 2 others" when a record lists many. */
export function authorLine(authors: readonly string[]): string {
  const [first, second, ...rest] = authors;
  if (!first) return '';
  if (!second) return first;
  if (rest.length === 0) return `${first} and ${second}`;
  return `${first} and ${rest.length + 1} others`;
}

/**
 * "The covers of Nineteen Eighty-Four by George Orwell".
 *
 * The layout appends " · Beautiful Books", so this stays a noun phrase and
 * carries the two words a searcher actually types: the title and the author.
 */
export function workPageTitle(work: Pick<Work, 'title' | 'authors'>): string {
  const author = authorLine(work.authors);
  return author ? `The covers of ${work.title} by ${author}` : `The covers of ${work.title}`;
}

/**
 * The meta description. Names the source's own edition count, which is a
 * checkable number, and says in the same breath that not every record has an
 * image — the honest version of "many covers".
 */
export function workDescription(work: Pick<Work, 'title' | 'authors' | 'editionCount'>): string {
  const author = authorLine(work.authors);
  const by = author ? ` by ${author}` : '';
  const count = work.editionCount
    ? `Open Library lists ${work.editionCount.toLocaleString('en')} edition records for ${work.title}${by}. `
    : `${work.title}${by}. `;
  return `${count}See the ones that carry a cover side by side, by language and year, with the publisher and year of each.`;
}

export function workUrl(workId: string): string {
  return `${SITE_URL}/book/${workId}`;
}

/** Cover images for a work page, largest first, at most `limit`. */
export function coverImages(covers: readonly Cover[], limit = 4): string[] {
  const urls: string[] = [];
  for (const cover of covers) {
    if (urls.length >= limit) break;
    if (!urls.includes(cover.url)) urls.push(cover.url);
  }
  return urls;
}

/**
 * schema.org `Book`, deliberately short.
 *
 * No `aggregateRating` and no `offers`: we have neither ratings of our own
 * nor prices of our own, and inventing either would break Google's structured
 * data policy as well as the promise in SPEC §9.2. `sameAs` points at the
 * Open Library record so the claim can be checked at its source.
 */
export function bookJsonLd(work: Work, covers: readonly Cover[]): Record<string, unknown> {
  const authors = work.authors.filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: work.title,
    url: workUrl(work.id),
    ...(authors.length > 0 && {
      author: authors.map(name => ({ '@type': 'Person', name })),
    }),
    ...(work.firstPublishYear && { datePublished: String(work.firstPublishYear) }),
    ...(covers.length > 0 && { image: coverImages(covers) }),
    sameAs: `https://openlibrary.org/works/${work.id}`,
  };
}

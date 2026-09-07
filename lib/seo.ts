/**
 * Titles, descriptions and structured data for a work page (SPEC §10 D10).
 *
 * Pure, so the wording is testable. Every sentence here is subject to the
 * rule in CLAUDE.md: no copy claims completeness. That holds for the meta
 * tags in particular — nobody reads them, which is exactly why a false claim
 * would survive there longest.
 */
import type { Cover, Edition, Work } from './model';

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

/**
 * Which printing a cover belongs to, as far as the metadata can tell.
 *
 * Publisher and year first, because that is what distinguishes two printings.
 * Failing that the edition record itself, which at least keeps four scans of
 * one edition from filling all four slots. Null when nothing is known, and
 * then the cover is always kept: an unknown edition is not a duplicate.
 */
function printingKey(cover: Cover, editionsById: ReadonlyMap<string, Pick<Edition, 'publisher' | 'year'>>): string | null {
  for (const id of cover.editionIds) {
    const edition = editionsById.get(id);
    if (!edition) continue;
    const publisher = (edition.publisher ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return publisher ? `p:${publisher}|${edition.year ?? ''}` : `e:${id}`;
  }
  return null;
}

/**
 * Cover images for a work page, at most `limit`, avoiding obvious repeats.
 *
 * Deduplicating by URL is not enough: one printing often sits in the
 * catalogue as several records with several scans, so the shared link for
 * *Wolf Hall* showed the same Spanish edition twice out of four (found
 * 2026-09-07). The image that decides whether anyone opens a link should not
 * look careless.
 *
 * The wall folds repeats by comparing the images themselves, but that needs
 * signatures the server would have to fetch and hash — several seconds on a
 * route that a messenger's unfurler will not wait for. So this uses what is
 * already in hand: two covers filed under the same publisher **and** year are
 * treated as one printing. It is a weaker test than the wall's, and it errs
 * towards showing a repeat rather than dropping a genuinely different cover:
 * anything skipped comes back to fill the remaining slots.
 */
export function coverImages(
  covers: readonly Cover[],
  limit = 4,
  editions: readonly Pick<Edition, 'id' | 'publisher' | 'year'>[] = [],
): string[] {
  const editionsById = new Map(editions.map(e => [e.id, e]));
  const urls: string[] = [];
  const skipped: string[] = [];
  const seenPrintings = new Set<string>();

  for (const cover of covers) {
    if (urls.length >= limit) break;
    if (urls.includes(cover.url)) continue;
    const key = printingKey(cover, editionsById);
    if (key && seenPrintings.has(key)) {
      skipped.push(cover.url);
      continue;
    }
    if (key) seenPrintings.add(key);
    urls.push(cover.url);
  }
  // Better a repeat than an empty slot: a three-cover card looks unfinished.
  for (const url of skipped) {
    if (urls.length >= limit) break;
    if (!urls.includes(url)) urls.push(url);
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
export function bookJsonLd(
  work: Work,
  covers: readonly Cover[],
  editions: readonly Pick<Edition, 'id' | 'publisher' | 'year'>[] = [],
): Record<string, unknown> {
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
    ...(covers.length > 0 && { image: coverImages(covers, 4, editions) }),
    sameAs: `https://openlibrary.org/works/${work.id}`,
  };
}

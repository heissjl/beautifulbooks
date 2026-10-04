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

/**
 * The site's own shared-link card (`app/opengraph-image.tsx`, ROADMAP 6.61).
 * A page that sets `openGraph` replaces the parent's whole object, images
 * included, so a page without a card of its own names this one.
 */
/**
 * The name of the site, in one place (ROADMAP 0.5): the header, the title
 * template, the share cards and the mail sender all read it from here.
 * Never write the name out anywhere else — a test walks `app/`, `components/`
 * and `lib/` for it. The site was "Beautiful Books" until 2026-10-02 and
 * "Other Covers" for one afternoon (docs/domain-recherche.md §13–18); it
 * lives at buyitscovers.com, and beautifulcovers.vercel.app redirects there.
 */
export const SITE_NAME = 'Buy Its Covers';

/** The public repository; the contact of last resort in `userAgent`. */
export const SITE_REPOSITORY = 'https://github.com/heissjl/beautifulbooks';

export const SITE_CARD = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: `${SITE_NAME}: judge a book, buy its covers`,
};

/** "George Orwell", or "Mary Shelley and 2 others" when a record lists many. */
/**
 * How the site names itself to a catalogue: "BuyItsCovers/0.1 (<where to find
 * us>)". The address is the site itself once it is deployed — its imprint
 * carries the contact — and the public repository from a script or a dev
 * server, where the site's address is localhost and tells Open Library
 * nothing. An e-mail address, which would raise Open Library's limit from 1
 * to 3 requests a second, is ROADMAP 2.7 and Julian's to add.
 */
export function userAgent(siteUrl: string = SITE_URL): string {
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(siteUrl);
  return `${SITE_NAME.replace(/\s+/g, '')}/0.1 (${local ? SITE_REPOSITORY : siteUrl})`;
}

/**
 * JSON for a `<script type="application/ld+json">`. `JSON.stringify` leaves
 * `<` alone, and the HTML parser ends a script element at the first
 * `</script>` whatever the JSON says — so a title that contains one would
 * run as markup. Titles and descriptions come from Open Library, which
 * anyone with an account can edit, and from Google Books: not typed by a
 * visitor here, but not ours either (docs/sicherheit-2026-10-02.md, ROADMAP
 * 2.8). The escapes are valid JSON and read back as the same characters.
 */
export function jsonLdHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

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
 * The layout appends " · " and the site's name, so this stays a noun phrase and
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

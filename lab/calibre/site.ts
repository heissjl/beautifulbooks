/**
 * Everything this tool takes from the website's code, in one place (ROADMAP 5.16b).
 *
 * Julian, 2026-10-03, on where the app should live: „lokales main aber eigener
 * bereich, damit ich es später einzeln weiterführen kann". The tool is a
 * folder of its own, and this file is its only door to the rest of the
 * repository: no other file in `lab/calibre/` imports from `lib/` or
 * `scripts/` (a test holds that). Taking the tool out one day means
 * `git subtree split -P lab/calibre` and replacing this file — by copies of
 * the functions named here, or by the site as a dependency.
 *
 * What comes through: the catalogue (search, works, editions of Open
 * Library), the rules for comparing titles and authors, ISBN and language
 * codes, the image decoders, the shape of a collection, and the local
 * server's door (token, host and origin checks).
 */
export { pickWork, sameAuthor, titleScore, type WorkReason } from '../../lib/bookmatch';
export type { CollectionRecord } from '../../lib/collections';
export { coverRefFromUrl, coverUrlFor } from '../../lib/coverurl';
export { decode } from '../../lib/imagehash';
export type { SourceEdition, Work, WorkSummary } from '../../lib/model';
export { cleanIsbn, isbn10to13, toIsoLanguage } from '../../lib/normalize';
export { search } from '../../lib/search';
export { userAgent } from '../../lib/seo';
export { getEditionsPage, getWork } from '../../lib/sources/openlibrary';
export { parseEditions } from '../../lib/sources/openlibrary-parse';
export { isWallId, tileCoverId, type PublicWall } from '../../lib/walls/model';
export { isWorkId } from '../../lib/work';
export { hostAllowed, makeToken, originAllowed, tokenMatches } from '../../scripts/cockpit/guard';

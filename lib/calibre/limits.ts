/**
 * The Calibre import's sizes (ROADMAP 5.17a), where the page and the server
 * both read them; `lib/walls/calibre.ts` is server only.
 */

/** Books per request: about 1.4 catalogue requests each, three at a time — a request of 8 answers in some seconds. */
export const CALIBRE_BOOKS_PER_REQUEST = 8;

/**
 * Books one library may look up: a collection holds 500 covers (`MAX_TILES`),
 * and Julian's 421 books took 593 requests at Open Library and four minutes.
 * A larger library takes its most recently added books.
 */
export const MAX_CALIBRE_BOOKS = 500;

/** A `metadata.db` is about 2.5 KB a book; 200 MB is far beyond any library a page should read in one go. */
export const MAX_CALIBRE_FILE_BYTES = 200 * 1024 * 1024;

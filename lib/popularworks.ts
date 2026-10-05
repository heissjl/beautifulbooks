/**
 * The most-read works on Open Library, as a list this project can browse
 * (ROADMAP 5.18a; pure, client-safe).
 *
 * Open Library's search sorts by its readers' shelves: `sort=already_read`
 * orders works by how many readers marked them read. That was not known when
 * `scripts/pick-index-works.ts` was written ("Open Library has no such
 * endpoint") — measured 2026-10-05. Of the three orders tried, this is the
 * one that reads like a shelf: `readinglog` is led by what people *want* to
 * read (five self-help titles in the first six), `editions` by the Bible, a
 * colouring journal and statute books.
 *
 * Google Books has no part in it: its API orders by relevance or by date,
 * not by readers, it has no work (E5), and its quota is the site's (E10).
 *
 * The data is `data/popular-works.json`, written by
 * `scripts/build-popular-works.ts`. This module only turns search documents
 * into rows; it imports no data, so nothing ships to a browser by accident.
 */
import { titleAuthorKey } from './normalize';

/** One document of `search.json`, with the fields the builder asks for. */
export interface PopularDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  edition_count?: number;
  already_read_count?: number;
  readinglog_count?: number;
  ratings_count?: number;
}

export interface PopularWork {
  /** `OL…W` */
  id: string;
  title: string;
  /** The first author Open Library names; later entries are often translators. */
  author: string;
  /** `ol:<cover_i>`: the cover Open Library shows for the work. */
  coverId: string;
  firstPublished?: number;
  editionCount: number;
  /** Readers who marked the work as read — the order of the list. */
  alreadyRead: number;
  /** Want to read + reading + read. */
  readingLog: number;
  ratings: number;
}

export interface PopularFile {
  builtAt: string;
  /** The request the rows came from, without the page. */
  query: string;
  works: PopularWork[];
}

const WORK_KEY = /^\/works\/(OL\d+W)$/;

/**
 * Rows from search documents, in the order given. Left out: a document with
 * no cover (nothing to show), no author or no title (nothing to say), and a
 * second record of the same title by the same author — Open Library keeps
 * duplicates of well-read works, and the one read more often comes first.
 *
 * Nothing is left out for being unpopular or thinly printed: the counts go
 * with every row, and whoever uses the list decides where to cut.
 */
export function popularFromDocs(docs: readonly PopularDoc[]): PopularWork[] {
  const seen = new Set<string>();
  const ids = new Set<string>();
  const out: PopularWork[] = [];
  for (const d of docs) {
    const id = WORK_KEY.exec(d.key ?? '')?.[1];
    const title = d.title?.trim();
    const author = d.author_name?.[0]?.trim();
    if (!id || !title || !author || !d.cover_i || d.cover_i <= 0) continue;
    const key = titleAuthorKey(title, author);
    if (ids.has(id) || seen.has(key)) continue;
    ids.add(id);
    seen.add(key);
    out.push({
      id,
      title,
      author,
      coverId: `ol:${d.cover_i}`,
      ...(d.first_publish_year ? { firstPublished: d.first_publish_year } : {}),
      editionCount: d.edition_count ?? 0,
      alreadyRead: d.already_read_count ?? 0,
      readingLog: d.readinglog_count ?? 0,
      ratings: d.ratings_count ?? 0,
    });
  }
  return out;
}

/**
 * The rows a reader browses: a work with a handful of editions on record.
 * Below that the list holds records that readers' shelves pushed up but that
 * have no wall to open — measured on the first build, see docs/history.md.
 */
export function browsable(works: readonly PopularWork[], minEditions: number): PopularWork[] {
  return works.filter(w => w.editionCount >= minEditions);
}

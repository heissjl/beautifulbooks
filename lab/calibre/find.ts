/**
 * Which work is this Calibre book? (lab/calibre, ROADMAP 5.16a)
 *
 * By ISBN where the book has one — a search for the number answers with the
 * work that holds that printing, and Open Library's `/isbn/<isbn>.json` adds
 * which covers the very edition carries — and by a search for title and
 * author, judged by the site's own rule (`pickWork`, built for the shelf
 * photo). The searches go through `catalogue.ts`, so through the website
 * first; never Google (lab rule 6). The answer is a list with one entry
 * proposed; which work it really is stays Julian's click, and the click is
 * remembered.
 */
import { coverRefFromUrl, isWorkId, pickWork, userAgent, type WorkReason, type WorkSummary } from './site';
import { CatalogueError, type Catalogue } from './catalogue';
import { FileMap } from './filemap';
import type { CalibreBook } from './library';

/* ---------- pure ---------- */

/**
 * A Calibre title as a catalogue would write it. Download sites prefix a
 * series or a year — both forms stand in Julian's library:
 *   "[Philip K. Dick 04] • Flow My Tears, the Policeman Said"
 *   "1974-Rendezvous With Rama"
 */
export function cleanBookTitle(title: string): string {
  const cleaned = title
    .replace(/^\s*\[[^\]]*\]\s*[•·:\-–—]?\s*/, '')
    .replace(/^\s*(1[5-9]|20)\d{2}\s*[-–—_]\s*(?=\S)/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || title.trim();
}

/** The first author worth searching for; Calibre's "Unknown" is none. */
export function firstAuthor(book: Pick<CalibreBook, 'authors'>): string {
  const name = book.authors[0]?.trim() ?? '';
  return /^(unknown|unbekannt|various|n\/a)$/i.test(name) ? '' : name;
}

/**
 * Did the catalogue refuse the connection outright? Not a slow answer and not
 * an error page: the Internet Archive shuts the door on an address that asked
 * too much in a short time, and every further knock risks keeping it shut
 * (measured 2026-10-04: `ECONNREFUSED` from this Mac on both ports while the
 * live site still got answers). The app then stops asking for a while.
 */
export function refusedConnection(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 6; depth++) {
    const x = e as { code?: unknown; message?: unknown; cause?: unknown };
    if (x.code === 'ECONNREFUSED' || (typeof x.message === 'string' && x.message.includes('ECONNREFUSED'))) return true;
    e = x.cause;
  }
  return false;
}

export interface WorkHit {
  id: string;
  title: string;
  author: string;
  year?: number;
  /** A small cover, for the list. */
  thumb?: string;
  editions?: number;
}

export type FindReason = 'isbn' | 'remembered' | WorkReason;

export interface Found {
  hits: WorkHit[];
  /** The proposed work, when one stands out. */
  picked?: string;
  reason?: FindReason;
  /** `ol:` ids of the covers of the very edition the ISBN names. */
  editionCovers: string[];
  /** A source did not answer: not the same as "not found" (SPEC N12). */
  failed?: string;
  /** The catalogue refused the connection (`refusedConnection`): the caller should stop asking for a while. */
  refused?: true;
}

export function hitFromSummary(w: WorkSummary): WorkHit {
  const ref = w.coverUrls[0] ? coverRefFromUrl(w.coverUrls[0]) : null;
  return {
    id: w.id,
    title: w.title,
    author: w.authors[0] ?? '',
    ...(w.firstPublishYear ? { year: w.firstPublishYear } : {}),
    ...(ref?.coverId.startsWith('ol:') ? { thumb: `https://covers.openlibrary.org/b/id/${ref.coverId.slice(3)}-M.jpg` } : {}),
    ...(w.editionCount ? { editions: w.editionCount } : {}),
  };
}

/** The search's proposal: sure enough to preselect only when author and title agree. */
export function proposal(works: readonly WorkSummary[], book: { title: string; author: string }): { id: string; reason: WorkReason } | null {
  const picked = pickWork(works, book);
  if (!picked || picked.reason === 'first-result') return null;
  return { id: works[picked.index].id, reason: picked.reason };
}

/* ---------- the remembered choices ---------- */

/** Book number -> work id, per library, beside its backups: what Julian clicked once is not asked again. */
export class WorkMap extends FileMap {}

/* ---------- Open Library ---------- */

interface OlEdition {
  covers?: number[];
  works?: Array<{ key: string }>;
}

/** What Open Library lists under an ISBN: the work, and the covers of that very edition record. */
export interface IsbnEdition {
  workId: string;
  covers: string[];
}

/**
 * The one question that goes to Open Library itself — the website has no
 * route for it. Null: Open Library does not know the number.
 */
export async function editionByIsbn(isbn: string, site: string): Promise<IsbnEdition | null> {
  const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { headers: { 'user-agent': userAgent(site) }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Library answered ${res.status}`);
  const edition = (await res.json()) as OlEdition;
  const workId = edition.works?.[0]?.key?.replace('/works/', '');
  if (!workId || !isWorkId(workId)) return null;
  return { workId, covers: (edition.covers ?? []).filter((c) => c > 0).map((c) => `ol:${c}`) };
}

export interface FindOptions {
  remembered?: string;
  /** What Julian typed: replaces title and author. */
  query?: string;
  /**
   * Which covers the catalogue lists under the book's ISBN (`editionByIsbn`,
   * through the store in the app). Undefined as an answer means "not asked" —
   * Open Library is refusing this Mac and nothing is kept — and the app then
   * marks no cover as „same ISBN", without calling it a failure. Left out,
   * nobody is asked.
   */
  edition?: (isbn: string) => Promise<IsbnEdition | null | undefined>;
}

const hitOf = (work: { id: string; title: string; authors: string[]; firstPublishYear?: number; editionCount?: number }): WorkHit => ({
  id: work.id,
  title: work.title,
  author: work.authors[0] ?? '',
  ...(work.firstPublishYear ? { year: work.firstPublishYear } : {}),
  ...(work.editionCount ? { editions: work.editionCount } : {}),
});

/** One book against the catalogue. */
export async function findWorks(book: CalibreBook, catalogue: Catalogue, options: FindOptions): Promise<Found> {
  const { remembered, query } = options;
  const title = cleanBookTitle(book.title);
  const author = firstAuthor(book);
  const isbn = query ? undefined : book.isbns[0];
  const hits: WorkHit[] = [];
  // A work found twice is one entry, the fuller one.
  const add = (h: WorkHit, first = false) => {
    const at = hits.findIndex((x) => x.id === h.id);
    const merged = at >= 0 ? { ...h, ...hits.splice(at, 1)[0] } : h;
    if (first) hits.unshift(merged);
    else if (at >= 0) hits.splice(at, 0, merged);
    else hits.push(merged);
  };
  let picked: string | undefined;
  let reason: FindReason | undefined;
  let editionCovers: string[] = [];
  let editionWork: string | undefined;
  let isbnWork: WorkSummary | undefined;
  let chosen: { id: string; reason: WorkReason } | null = null;
  const failures: string[] = [];
  let refused = false;
  const failed = (err: unknown, what: string) => {
    refused ||= refusedConnection(err);
    failures.push(err instanceof CatalogueError ? err.message : what);
  };

  // The ISBN names a printing; a search for it answers with the work that holds that printing.
  const byIsbn = async () => {
    if (!isbn) return;
    try {
      isbnWork = (await catalogue.search(isbn))[0];
    } catch (err) {
      failed(err, 'The search for the ISBN did not answer.');
    }
  };

  const ownEdition = async () => {
    if (!isbn || !options.edition) return;
    try {
      const edition = await options.edition(isbn);
      if (!edition) return;
      editionCovers = edition.covers;
      editionWork = edition.workId;
    } catch (err) {
      failed(err, 'Open Library did not say which covers it lists under this ISBN.');
    }
  };

  let found: WorkSummary[] = [];
  const bySearch = async () => {
    try {
      found = await catalogue.search(query ?? `${title} ${author}`.trim());
      chosen = query ? null : proposal(found, { title, author });
      // A name Calibre spells differently can empty the first search; the title alone is the second try.
      if (!query && !chosen && author) {
        const byTitle = await catalogue.search(title);
        const second = proposal(byTitle, { title, author });
        if (second || found.length === 0) {
          found = byTitle;
          chosen = second;
        }
      }
    } catch (err) {
      failed(err, 'The search did not answer.');
    }
  };

  await Promise.all([byIsbn(), ownEdition(), bySearch()]);
  found.slice(0, 8).map(hitFromSummary).forEach((h) => add(h));

  /** A work known only by its id: its name comes with the first page of its covers, which the app needs next anyway. */
  const named = async (workId: string, what: string): Promise<boolean> => {
    if (hits.some((h) => h.id === workId)) return true;
    try {
      const page = await catalogue.page(workId, 0);
      if (!page) return false;
      add(hitOf(page.work), true);
      return true;
    } catch (err) {
      failed(err, what);
      return false;
    }
  };

  // The edition Open Library names for the ISBN is the surest; the search for the ISBN is next; then title and author.
  const byNumber = editionWork ?? (isbnWork as WorkSummary | undefined)?.id;
  if (isbnWork) add(hitFromSummary(isbnWork));
  if (byNumber && (await named(byNumber, 'The catalogue did not answer for the work of the ISBN.'))) {
    add(hits.find((h) => h.id === byNumber) as WorkHit, true);
    picked = byNumber;
    reason = 'isbn';
  } else if (chosen) {
    picked = (chosen as { id: string; reason: WorkReason }).id;
    reason = (chosen as { id: string; reason: WorkReason }).reason;
  }
  if (remembered && !query && (await named(remembered, 'The catalogue did not answer for the remembered work.'))) {
    add(hits.find((h) => h.id === remembered) as WorkHit, true);
    picked = remembered;
    reason = 'remembered';
  }
  return { hits, ...(picked ? { picked, reason } : {}), editionCovers, ...(failures.length ? { failed: [...new Set(failures)].join(' ') } : {}), ...(refused ? { refused: true as const } : {}) };
}

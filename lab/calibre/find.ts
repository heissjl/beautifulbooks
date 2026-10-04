/**
 * Which work is this Calibre book? (lab/calibre, ROADMAP 5.16a)
 *
 * By ISBN where the book has one — Open Library's `/isbn/<isbn>.json` names
 * the edition, its work and the edition's own covers — and by a search for
 * title and author through the site's own search (`lib/search.ts`) and its
 * choice (`pickWork`, built for the shelf photo). Open Library only, never
 * Google (lab rule 6). The answer is a list with one entry proposed; which
 * work it really is stays Julian's click, and the click is remembered.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pickWork, type WorkReason } from '../../lib/bookmatch';
import { coverRefFromUrl } from '../../lib/coverurl';
import type { WorkSummary } from '../../lib/model';
import { search } from '../../lib/search';
import { userAgent } from '../../lib/seo';
import { getWork } from '../../lib/sources/openlibrary';
import { isWorkId } from '../../lib/work';
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
export class WorkMap {
  private map: Record<string, string>;

  constructor(private readonly file: string) {
    this.map = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>) : {};
  }

  get(bookId: number): string | undefined {
    return this.map[String(bookId)];
  }

  all(): Record<string, string> {
    return { ...this.map };
  }

  set(bookId: number, workId: string): void {
    this.map[String(bookId)] = workId;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.map, null, 1));
    renameSync(`${this.file}.tmp`, this.file);
  }
}

/* ---------- Open Library ---------- */

interface OlEdition {
  covers?: number[];
  works?: Array<{ key: string }>;
}

async function editionByIsbn(isbn: string, site: string): Promise<{ workId: string; covers: string[] } | null> {
  const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { headers: { 'user-agent': userAgent(site) }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Library answered ${res.status}`);
  const edition = (await res.json()) as OlEdition;
  const workId = edition.works?.[0]?.key?.replace('/works/', '');
  if (!workId || !isWorkId(workId)) return null;
  return { workId, covers: (edition.covers ?? []).filter((c) => c > 0).map((c) => `ol:${c}`) };
}

const real = (works: readonly WorkSummary[]): WorkSummary[] => works.filter((w) => isWorkId(w.id));

/** One book against the catalogue. `query` replaces title and author with what Julian typed. */
export async function findWorks(book: CalibreBook, site: string, remembered?: string, query?: string): Promise<Found> {
  const title = cleanBookTitle(book.title);
  const author = firstAuthor(book);
  const hits: WorkHit[] = [];
  // The ISBN's work usually stands in the search results too, there with a picture: one entry, the fuller one.
  const add = (h: WorkHit) => {
    const have = hits.find((x) => x.id === h.id);
    if (have) Object.assign(have, { ...h, ...have });
    else hits.push(h);
  };
  let picked: string | undefined;
  let reason: FindReason | undefined;
  let editionCovers: string[] = [];
  const failures: string[] = [];

  const byIsbn = async () => {
    if (query || !book.isbns[0]) return;
    try {
      const edition = await editionByIsbn(book.isbns[0], site);
      const work = edition ? await getWork(edition.workId) : null;
      if (!edition || !work) return;
      const hit: WorkHit = { id: work.id, title: work.title, author: work.authors[0] ?? '', ...(work.firstPublishYear ? { year: work.firstPublishYear } : {}), ...(work.editionCount ? { editions: work.editionCount } : {}) };
      const at = hits.findIndex((h) => h.id === work.id);
      // Whichever answered first, the ISBN's work leads the list.
      hits.unshift(at >= 0 ? { ...hit, ...hits.splice(at, 1)[0] } : hit);
      picked = work.id;
      reason = 'isbn';
      editionCovers = edition.covers;
    } catch {
      failures.push('Open Library did not answer for the ISBN.');
    }
  };

  const bySearch = async () => {
    try {
      let works = real((await search(query ?? `${title} ${author}`.trim())).works);
      let chosen = query ? null : proposal(works, { title, author });
      // A name Calibre spells differently can empty the first search; the title alone is the second try.
      if (!query && !chosen && author) {
        const byTitle = real((await search(title)).works);
        const second = proposal(byTitle, { title, author });
        if (second || works.length === 0) {
          works = byTitle;
          chosen = second;
        }
      }
      works.slice(0, 8).map(hitFromSummary).forEach(add);
      if (chosen && !picked) {
        picked = chosen.id;
        reason = chosen.reason;
      }
    } catch {
      failures.push('The search did not answer.');
    }
  };

  await Promise.all([byIsbn(), bySearch()]);

  if (remembered && !query) {
    if (!hits.some((h) => h.id === remembered)) {
      try {
        const work = await getWork(remembered);
        if (work) hits.unshift({ id: work.id, title: work.title, author: work.authors[0] ?? '', ...(work.firstPublishYear ? { year: work.firstPublishYear } : {}) });
      } catch {
        failures.push('Open Library did not answer for the remembered work.');
      }
    }
    if (hits.some((h) => h.id === remembered)) {
      picked = remembered;
      reason = 'remembered';
    }
  }
  return { hits, ...(picked ? { picked, reason } : {}), editionCovers, ...(failures.length ? { failed: failures.join(' ') } : {}) };
}

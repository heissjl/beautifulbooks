/**
 * What the import asks Open Library, and what it remembers (lab/calibre-import, ROADMAP 5.17).
 *
 * Two questions: the edition behind an ISBN (`/isbn/<isbn>.json` — its work
 * and **its** covers, so the tile starts with the printing Julian owns), and
 * the site's own search (`lib/search.ts`, one request, never Google).
 *
 * Every answer is kept on disk, so a second run asks only what is missing —
 * a whole library is some hundred requests at 2–10 s each. **Only answers
 * are kept:** a catalogue that stays silent throws, nothing is stored, and
 * the next run asks again (SPEC N12 — silence is not "no such book").
 *
 * The files live outside the repository, beside the backups of lab/calibre:
 * a worktree is deleted, and the cache holds the list of Julian's books.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { WorkSummary } from '../../lib/model';
import { search } from '../../lib/search';
import { getEditionByIsbn, type IsbnEdition } from '../../lib/sources/openlibrary';
import { defaultBackupRoot, libraryKey } from '../calibre/safety';

/** Where one library's import keeps its cache, its results and Julian's decisions. */
export const stateDir = (library: string): string => join(defaultBackupRoot(), 'import', libraryKey(library));

/** A JSON file of answers. Written whole, through a temporary file, so a stopped run leaves the old one. */
export class DiskCache {
  private data: Record<string, unknown>;
  private dirty = 0;

  constructor(private readonly file: string) {
    this.data = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>) : {};
  }

  has(key: string): boolean {
    return key in this.data;
  }

  get<T>(key: string): T {
    return this.data[key] as T;
  }

  set(key: string, value: unknown): void {
    this.data[key] = value;
    if (++this.dirty >= 10) this.flush();
  }

  flush(): void {
    if (this.dirty === 0) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.file);
    this.dirty = 0;
  }
}

export interface CatalogueSources {
  /** The edition of an ISBN, null when Open Library has none. Throws when the catalogue does not answer. */
  edition(isbn13: string): Promise<IsbnEdition | null>;
  /** The site's search. Throws when the catalogue does not answer. */
  works(query: string): Promise<WorkSummary[]>;
}

export const liveSources: CatalogueSources = {
  edition: getEditionByIsbn,
  // `exact`: no second request for a spelling correction — a Calibre title is not a typo.
  works: async (query) => (await search(query, { exact: true })).works,
};

/** The two questions, answered from the cache where it has them. Counts what really left the machine. */
export class Catalogue {
  /** Requests sent to Open Library in this run (a search that retried counts once). */
  asked = 0;

  constructor(
    private readonly cache: DiskCache,
    private readonly sources: CatalogueSources = liveSources,
  ) {}

  async isbn(isbn13: string): Promise<IsbnEdition | null> {
    const key = `isbn:${isbn13}`;
    if (this.cache.has(key)) return this.cache.get<IsbnEdition | null>(key);
    this.asked++;
    const edition = await this.sources.edition(isbn13);
    this.cache.set(key, edition);
    return edition;
  }

  find = async (query: string): Promise<WorkSummary[]> => {
    const key = `search:${query.toLowerCase()}`;
    if (this.cache.has(key)) return this.cache.get<WorkSummary[]>(key);
    this.asked++;
    const works = await this.sources.works(query);
    this.cache.set(key, works);
    return works;
  };
}

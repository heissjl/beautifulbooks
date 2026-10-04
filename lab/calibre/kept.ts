/**
 * What the catalogue answered, kept on this Mac (lab/calibre, ROADMAP 5.16a).
 *
 * Until 2026-10-04 the app remembered answers for one run only, so every start
 * asked again for books opened the day before — the website for the work and
 * its covers, and Open Library itself for the edition an ISBN names. That one
 * direct question is the kind that got this Mac's address shut out on
 * 2026-10-04. Now every answer is a small file beside the backups:
 *
 *  - **fresh for `KEEP_DAYS`**: served without asking anyone.
 *  - **older**: the catalogue is asked again and the file replaced. When the
 *    catalogue does not answer, the old answer is served and marked as such —
 *    a book opened before stays usable while Open Library refuses this Mac.
 *  - **`notBefore`**: the reader's „Ask the catalogue again" — nothing older
 *    than that moment counts as fresh.
 *
 * A failure is never kept (SPEC N12), and neither is an answer that may be a
 * failure in disguise: the site's search turns a lookup that failed into an
 * empty list (ROADMAP 1.4), so an empty list is remembered for the run only.
 * A corrupt or foreign file is treated as no file. Nothing here deletes: a
 * library of 445 books comes to about ten megabytes (measured: 124 KB for six books).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalogue } from './catalogue';

export const KEEP_DAYS = 30;

/** An answer that did not come from the catalogue just now. */
export interface Served {
  /** When the catalogue gave it. */
  at: number;
  /** Set when the catalogue was asked now and failed: the answer is older than wanted. */
  error?: unknown;
}

export interface AskOptions {
  /** Nothing the catalogue said before this moment is fresh enough. */
  notBefore?: number;
  /** Told of every answer that came out of the store instead of the catalogue. */
  served?: (s: Served) => void;
}

export type AnswerKind = 'search' | 'page' | 'isbn';

interface KeptFile<T> {
  v: 1;
  key: string;
  at: number;
  value: T;
}

export class AnswerStore {
  private readonly asking = new Map<string, Promise<unknown>>();
  /** Answers not worth a file, for this run. */
  private readonly forRun = new Map<string, { at: number; value: unknown }>();

  constructor(
    readonly dir: string,
    private readonly freshFor = KEEP_DAYS * 86_400_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** A key that is a plain word names its file; anything else — a search someone typed — goes in as a hash. */
  private file(kind: AnswerKind, key: string): string {
    const name = /^[A-Za-z0-9_-]{1,60}$/.test(key) ? key : createHash('sha256').update(key).digest('hex').slice(0, 24);
    return join(this.dir, `${kind}-${name}.json`);
  }

  /** The kept answer of any age, or null. */
  read<T>(kind: AnswerKind, key: string): { at: number; value: T } | null {
    const file = this.file(kind, key);
    if (existsSync(file)) {
      try {
        const kept = JSON.parse(readFileSync(file, 'utf8')) as Partial<KeptFile<T>>;
        // The key is checked too: two searches whose hashes meet must not answer for each other.
        if (kept.v === 1 && kept.key === key && typeof kept.at === 'number' && 'value' in kept) return { at: kept.at, value: kept.value as T };
      } catch {
        // Half-written or not ours: as good as absent, and the next answer replaces it.
      }
    }
    return (this.forRun.get(file) as { at: number; value: T } | undefined) ?? null;
  }

  private write<T>(kind: AnswerKind, key: string, value: T, worth: boolean): void {
    const file = this.file(kind, key);
    const at = this.now();
    if (!worth) {
      this.forRun.set(file, { at, value });
      return;
    }
    this.forRun.delete(file);
    try {
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(`${file}.tmp`, JSON.stringify({ v: 1, key, at, value } satisfies KeptFile<T>));
      renameSync(`${file}.tmp`, file);
    } catch {
      // A full disk costs the memory, not the answer.
      this.forRun.set(file, { at, value });
    }
  }

  /**
   * The kept answer while it is fresh; otherwise the catalogue's, which is
   * kept when `worth` says so; and the kept one of any age when the catalogue
   * fails. Two askers of the same thing at the same time share one request.
   */
  async answer<T>(kind: AnswerKind, key: string, ask: () => Promise<T>, options: AskOptions & { worth?: (value: T) => boolean } = {}): Promise<T> {
    const have = this.read<T>(kind, key);
    const now = this.now();
    if (have && have.at >= Math.min(options.notBefore ?? 0, now) && now - have.at < this.freshFor) {
      options.served?.({ at: have.at });
      return have.value;
    }
    const file = this.file(kind, key);
    let running = this.asking.get(file) as Promise<T> | undefined;
    if (!running) {
      running = ask()
        .then((value) => {
          this.write(kind, key, value, options.worth?.(value) ?? true);
          return value;
        })
        .finally(() => this.asking.delete(file));
      this.asking.set(file, running);
    }
    try {
      return await running;
    } catch (err) {
      if (!have) throw err;
      options.served?.({ at: have.at, error: err });
      return have.value;
    }
  }
}

/** Upper and lower case and the spaces between words do not make a different search. */
const searchKey = (query: string): string => query.trim().toLowerCase().replace(/\s+/g, ' ');

/** A catalogue whose answers come out of the store where it has them; made per request, so `options.served` hears only that request. */
export function keptCatalogue(store: AnswerStore, catalogue: Catalogue, options: AskOptions = {}): Catalogue {
  return {
    search: (query) => store.answer('search', searchKey(query), () => catalogue.search(query), { ...options, worth: (works) => works.length > 0 }),
    page: (workId, offset) => store.answer('page', `${workId}-${offset}`, () => catalogue.page(workId, offset), { ...options, worth: (page) => page !== null }),
  };
}

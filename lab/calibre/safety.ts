/**
 * The one place that changes the Calibre library (lab/calibre, ROADMAP 5.16).
 *
 * Julian, 2026-10-03: „mache sicherheitsvorkehrungen, dass es mir nicht meine
 * bibliothek zerschießt". The rules, each enforced here and not by discipline:
 *
 *  1. **One command writes, and it is Calibre's own**: `calibredb set_metadata
 *     <id> --field cover:<file>`. `metadata.db` and the book folders are never
 *     written by this code. Nothing is added, removed or renamed.
 *  2. **Never while Calibre is open.** Two writers on one library is how a
 *     library breaks; the check runs before every write, and `calibredb`
 *     refuses by itself as well.
 *  3. **A copy of `metadata.db` before the first write of a session**, and
 *     **a copy of the old `cover.jpg` before every write**, each compared with
 *     its source by SHA-256 before anything is changed. Backups live outside
 *     the repository and outside the library and are never deleted by the tool.
 *  4. **The new image is decoded whole** before it is handed over (image.ts).
 *  5. **After every write the library is read again**: same books, every other
 *     book's row unchanged, this book's title, authors, folder and formats
 *     unchanged, its e-book files untouched, the new cover decodes. If any of
 *     that fails the old cover is put back and the session **stops writing**.
 *  6. **A journal** (`journal.jsonl`) records every write with its backup, so
 *     each one can be undone — from the page or with `undo.ts`, without the
 *     collection that caused it.
 *
 * The pure parts are tested; the path through `calibredb` is exercised by
 * `selftest.ts` on a throwaway library.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { checkCover, imageFacts, MIN_WIDTH, type ImageFacts } from './image';
import { bookDir, coverFile, readLibrary, type CalibreBook } from './library';

/* ---------- pure ---------- */

/** Programs that hold a Calibre library open for writing. The viewer and the editor do not. */
const WRITERS = new Set(['calibre', 'calibre-server', 'calibre-debug', 'calibre-parallel', 'calibredb']);

/**
 * The Calibre programs in `ps -axo comm=` output. By program name, not by a
 * search in the command line: this tool's own path contains "calibre".
 */
export function runningCalibre(psComm: string): string[] {
  const names = psComm.split('\n').map((line) => basename(line.trim())).filter((name) => WRITERS.has(name));
  return [...new Set(names)];
}

export interface JournalEntry {
  at: string;
  action: 'apply' | 'undo';
  state: 'start' | 'done' | 'failed';
  bookId: number;
  title: string;
  /** The cover the write put in place: `ol:…`, `gb:…`, or `backup` for an undo. */
  coverId: string;
  /** Where the cover that was there before is kept; absent when the book had none. */
  backup?: string;
  old?: ImageFacts;
  next?: ImageFacts;
  error?: string;
}

export function parseJournal(text: string): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as JournalEntry);
    } catch {
      // A half-written last line after a crash: the entries before it still count.
    }
  }
  return out;
}

/**
 * Per book, the finished writes that can still be taken back, oldest first.
 * An undo takes back the latest one; undoing twice walks back to the cover
 * the book had before the tool ever touched it.
 */
export function undoStacks(entries: readonly JournalEntry[]): Map<number, JournalEntry[]> {
  const stacks = new Map<number, JournalEntry[]>();
  for (const e of entries) {
    if (e.state !== 'done') continue;
    const stack = stacks.get(e.bookId) ?? [];
    if (e.action === 'apply') stack.push(e);
    else stack.pop();
    stacks.set(e.bookId, stack);
  }
  for (const [id, stack] of stacks) if (stack.length === 0) stacks.delete(id);
  return stacks;
}

export interface FileStamp {
  /** The file's name as a reader knows it — iCloud's placeholder `.x.epub.icloud` is `x.epub`. */
  name: string;
  /** False while iCloud has evicted the file and only a placeholder is on this Mac. */
  local: boolean;
  size: number;
  mtimeMs: number;
}

/** What changed among a book's e-book files, or null. A file iCloud moved in or out in between is not a change. */
export function changedFiles(before: readonly FileStamp[], after: readonly FileStamp[]): string | null {
  const then = new Map(before.map((f) => [f.name, f]));
  const now = new Map(after.map((f) => [f.name, f]));
  for (const [name, a] of then) {
    const b = now.get(name);
    if (!b) return `${name} is gone`;
    if (a.local && b.local && (a.size !== b.size || a.mtimeMs !== b.mtimeMs)) return `${name} was modified`;
  }
  for (const name of now.keys()) if (!then.has(name)) return `${name} appeared`;
  return null;
}

/** What a cover write must not have done to the database, or null when all is as it should be. */
export function unexpectedChange(before: readonly CalibreBook[], after: readonly CalibreBook[], bookId: number): string | null {
  if (before.length !== after.length) return `the library had ${before.length} books and now has ${after.length}`;
  const now = new Map(after.map((b) => [b.id, b]));
  for (const b of before) {
    const a = now.get(b.id);
    if (!a) return `book ${b.id} („${b.title}") is gone`;
    const same = (x: CalibreBook, y: CalibreBook) =>
      x.title === y.title && x.path === y.path && x.authors.join('|') === y.authors.join('|') && x.isbns.join('|') === y.isbns.join('|') && x.formats.join('|') === y.formats.join('|');
    if (!same(a, b)) return `book ${b.id} („${b.title}") changed in more than its cover`;
    if (b.id !== bookId && a.hasCover !== b.hasCover) return `the cover flag of another book (${b.id}, „${b.title}") changed`;
    if (b.id === bookId && !a.hasCover) return `book ${b.id} has no cover after the write`;
  }
  return null;
}

/**
 * Is the file Calibre wrote the picture it was given? Calibre may re-encode
 * and shrinks a cover above its own maximum, so the proportions must agree
 * and the width must not have grown.
 */
export function coverAsGiven(written: Pick<ImageFacts, 'width' | 'height'>, given: Pick<ImageFacts, 'width' | 'height'>): boolean {
  const ratio = (f: Pick<ImageFacts, 'width' | 'height'>) => f.width / f.height;
  if (Math.abs(ratio(written) - ratio(given)) / ratio(given) > 0.02) return false;
  return written.width === given.width || (written.width < given.width && written.width >= MIN_WIDTH);
}

/* ---------- I/O ---------- */

export function findCalibredb(): string | null {
  const candidates = [process.env.CALIBREDB, '/Applications/calibre.app/Contents/MacOS/calibredb', '/opt/homebrew/bin/calibredb', '/usr/local/bin/calibredb', '/usr/bin/calibredb'];
  return candidates.find((p): p is string => !!p && existsSync(p)) ?? null;
}

/** Outside the repository (a worktree is deleted) and outside the library (Calibre owns that folder). */
export const defaultBackupRoot = (): string => process.env.CALIBRE_BACKUP_DIR ?? join(homedir(), 'Library/Application Support/BuyItsCovers/calibre');

/**
 * A folder name for one library's backups. The journal speaks of books by
 * their number, and a rehearsal copy has the same numbers as the library it
 * was copied from — so every library gets a journal of its own.
 */
export function libraryKey(library: string): string {
  const path = resolve(library);
  return `${basename(path).replace(/[^\w .-]+/g, '_')}-${createHash('sha256').update(path).digest('hex').slice(0, 8)}`;
}

const sha256 = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex');
const stamp = (d: Date): string => d.toISOString().replace(/[:.]/g, '-');

export interface WriterOptions {
  library: string;
  calibredb: string | null;
  backupRoot: string;
}

export type WriteResult = { ok: true; entry: JournalEntry; books: CalibreBook[] } | { ok: false; error: string; halted: boolean };

export class CoverWriter {
  /** Set when a write left the library in a state the check did not expect: nothing more is written in this session. */
  halted: string | null = null;
  /** Where this library's backups, snapshots and journal are kept. */
  readonly root: string;
  private snapshotFile: string | null = null;

  constructor(private readonly o: WriterOptions) {
    this.root = join(o.backupRoot, libraryKey(o.library));
  }

  get journalFile(): string {
    return join(this.root, 'journal.jsonl');
  }

  journal(): JournalEntry[] {
    return existsSync(this.journalFile) ? parseJournal(readFileSync(this.journalFile, 'utf8')) : [];
  }

  /** Why nothing may be written right now; empty when a write may go ahead. */
  problems(): string[] {
    const out: string[] = [];
    if (this.halted) out.push(`Writing has stopped for this session: ${this.halted}`);
    if (!this.o.calibredb) out.push('calibredb was not found. Set CALIBREDB to its path.');
    if (!existsSync(join(this.o.library, 'metadata.db'))) out.push(`No metadata.db in ${this.o.library}.`);
    const running = runningCalibre(execFileSync('/bin/ps', ['-axo', 'comm='], { encoding: 'utf8' }));
    if (running.length) out.push(`Calibre is running (${running.join(', ')}). Quit it first — two programs writing one library is how a library breaks.`);
    return out;
  }

  private log(entry: JournalEntry): void {
    mkdirSync(this.root, { recursive: true });
    appendFileSync(this.journalFile, `${JSON.stringify(entry)}\n`);
  }

  /** A copy of metadata.db, once per session, before the first write. */
  private snapshot(now: Date): string {
    if (this.snapshotFile) return this.snapshotFile;
    const dir = join(this.root, 'snapshots');
    mkdirSync(dir, { recursive: true });
    const source = join(this.o.library, 'metadata.db');
    const target = join(dir, `metadata-${stamp(now)}.db`);
    copyFileSync(source, target);
    if (sha256(source) !== sha256(target)) throw new Error('The copy of metadata.db does not match the original.');
    this.snapshotFile = target;
    return target;
  }

  private stamps(dir: string): FileStamp[] {
    return readdirSync(dir)
      .map((raw) => {
        const placeholder = /^\.(.+)\.icloud$/.exec(raw);
        const name = placeholder ? placeholder[1] : raw;
        const s = statSync(join(dir, raw));
        return { name, local: !placeholder, size: s.size, mtimeMs: s.mtimeMs, isFile: s.isFile() };
      })
      // Calibre rewrites the cover and its own metadata.opf; everything else is the reader's.
      .filter((f) => f.isFile && f.name !== 'cover.jpg' && f.name !== 'metadata.opf' && f.name !== '.DS_Store')
      .map(({ name, local, size, mtimeMs }) => ({ name, local, size, mtimeMs }));
  }

  private setCover(bookId: number, file: string): string | null {
    const run = spawnSync(this.o.calibredb as string, ['set_metadata', String(bookId), '--field', `cover:${file}`, '--with-library', this.o.library], {
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (run.error) return run.error.message;
    return run.status === 0 ? null : (run.stderr || run.stdout || `calibredb ended with ${run.status}`).trim().slice(0, 600);
  }

  /** The old cover copied away and compared, or the reason it could not be. `none` when the book has no cover. */
  private backup(book: CalibreBook, now: Date): { file: string; facts: ImageFacts | null; sha: string } | 'none' | { error: string } {
    const cover = coverFile(this.o.library, book);
    if (!existsSync(cover)) {
      if (existsSync(join(bookDir(this.o.library, book), '.cover.jpg.icloud'))) {
        return { error: 'The current cover is only in iCloud, not on this Mac, so it cannot be backed up. Download the library folder in Finder first.' };
      }
      if (book.hasCover) return { error: 'Calibre says the book has a cover, but there is no cover.jpg in its folder. Run „Check library" in Calibre first.' };
      return 'none';
    }
    const dir = join(this.root, 'covers', String(book.id));
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${stamp(now)}.jpg`);
    copyFileSync(cover, file);
    const sha = sha256(cover);
    if (sha !== sha256(file)) return { error: 'The backup of the current cover does not match the original.' };
    return { file, facts: imageFacts(readFileSync(file)), sha };
  }

  /**
   * Hands `source` to Calibre as the cover of `bookId` and checks what came
   * of it. `given` is what the picture is; the backup taken here is put back
   * if the check fails.
   */
  private write(action: 'apply' | 'undo', bookId: number, source: string, given: ImageFacts, coverId: string, now: Date): WriteResult {
    const problems = this.problems();
    if (problems.length) return { ok: false, error: problems.join(' '), halted: !!this.halted };

    let before: CalibreBook[];
    try {
      before = readLibrary(this.o.library);
    } catch (err) {
      return { ok: false, error: `The library could not be read: ${(err as Error).message}`, halted: false };
    }
    const book = before.find((b) => b.id === bookId);
    if (!book) return { ok: false, error: `The library has no book ${bookId}.`, halted: false };

    let dir: string;
    let filesBefore: FileStamp[];
    try {
      this.snapshot(now);
      dir = bookDir(this.o.library, book);
      filesBefore = this.stamps(dir);
    } catch (err) {
      return { ok: false, error: `Nothing was written: ${(err as Error).message}`, halted: false };
    }
    const kept = this.backup(book, now);
    if (kept !== 'none' && 'error' in kept) return { ok: false, error: `Nothing was written. ${kept.error}`, halted: false };

    const entry: JournalEntry = {
      at: now.toISOString(),
      action,
      state: 'start',
      bookId,
      title: book.title,
      coverId,
      ...(kept !== 'none' ? { backup: kept.file, ...(kept.facts ? { old: kept.facts } : {}) } : {}),
      next: given,
    };
    this.log(entry);

    const failure = this.setCover(bookId, source);
    const fail = (error: string, changed: boolean): WriteResult => {
      let restored = '';
      if (changed && kept !== 'none') restored = this.setCover(bookId, kept.file) === null ? ' The old cover was put back.' : ` The old cover could NOT be put back automatically; it is kept at ${kept.file}.`;
      if (changed && kept === 'none') restored = ' The book had no cover before; look at it in Calibre.';
      if (changed) this.halted = error;
      this.log({ ...entry, state: 'failed', error: `${error}${restored}` });
      return { ok: false, error: `${error}${restored}`, halted: changed };
    };

    const cover = coverFile(this.o.library, book);
    if (failure) {
      const untouched = kept === 'none' ? !existsSync(cover) : existsSync(cover) && sha256(cover) === kept.sha;
      return fail(`calibredb refused: ${failure}`, !untouched);
    }

    let after: CalibreBook[];
    try {
      after = readLibrary(this.o.library);
    } catch (err) {
      return fail(`The library could not be read after the write: ${(err as Error).message}`, true);
    }
    const dbChange = unexpectedChange(before, after, bookId);
    if (dbChange) return fail(`After the write, ${dbChange}.`, true);
    const fileChange = changedFiles(filesBefore, this.stamps(dir));
    if (fileChange) return fail(`After the write, a file in the book's folder changed: ${fileChange}.`, true);
    const written = existsSync(cover) ? imageFacts(readFileSync(cover)) : null;
    if (!written) return fail('After the write, the cover file is missing or does not decode.', true);
    if (!coverAsGiven(written, given)) return fail(`After the write, the cover is ${written.width} × ${written.height}, not the ${given.width} × ${given.height} picture it was given.`, true);

    const done: JournalEntry = { ...entry, state: 'done', next: written };
    this.log(done);
    return { ok: true, entry: done, books: after };
  }

  /** A new cover for a book. The image is checked before anything else happens. */
  apply(bookId: number, image: Buffer, coverId: string, now = new Date()): WriteResult {
    const check = checkCover(image);
    if (!check.ok) return { ok: false, error: `Nothing was written. ${check.reason}`, halted: false };
    const dir = join(this.root, 'incoming');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${bookId}-${stamp(now)}.${check.format === 'png' ? 'png' : 'jpg'}`);
    writeFileSync(file, image);
    const given: ImageFacts = { format: check.format, width: check.width, height: check.height, bytes: check.bytes };
    return this.write('apply', bookId, file, given, coverId, now);
  }

  /** Takes back the latest write to a book: its backup becomes the cover again. */
  undo(bookId: number, now = new Date()): WriteResult {
    const last = undoStacks(this.journal()).get(bookId)?.at(-1);
    if (!last) return { ok: false, error: `Nothing to undo for book ${bookId}.`, halted: false };
    if (!last.backup) return { ok: false, error: 'The book had no cover before, so there is nothing to put back. Remove the cover in Calibre if you want it gone.', halted: false };
    if (!existsSync(last.backup)) return { ok: false, error: `The backup ${last.backup} is no longer there.`, halted: false };
    const given = imageFacts(readFileSync(last.backup));
    if (!given) return { ok: false, error: `The backup ${last.backup} does not decode.`, halted: false };
    return this.write('undo', bookId, last.backup, given, 'backup', now);
  }
}

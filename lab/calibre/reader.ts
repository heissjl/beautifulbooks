/**
 * The covers on the PocketBook itself (lab/calibre, ROADMAP 5.16c).
 *
 * Julian, 2026-10-04: „can we push the new covers onto the pocketbook
 * ourselves? without using calibre?" Read off his reader (Touch Lux 3,
 * firmware 5.12) that evening:
 *
 *  - The library view does not read the cover out of the book. It shows a
 *    picture of its own per file: `system/cover_chache/1/<path of the book>.png`
 *    (the folder's name is the firmware's spelling), 8-bit grey, fitted into
 *    260 × 393.
 *  - It does not renew that picture when the file changes. *Ubik* had been
 *    sent again from Calibre the day before — the file on the reader carried
 *    the new cover, the picture beside it was still April's.
 *  - Sending a book again makes it a new book for the reader. It knows a book
 *    by a hash of the file (`books_uids` in explorer-3.db): *Ubik* stood there
 *    twice, the old entry with its reading position and no file, the new one
 *    with the file and no position.
 *
 * So the way to a new cover on the reader is the picture, not the book: this
 * writes that one PNG and nothing else — never a book file, never a database.
 * The picture that was there is copied away first and can be put back. Which
 * file on the reader is which Calibre book says `metadata.calibre` in the
 * reader's root folder, which Calibre keeps (`application_id` is the book
 * number, `lpath` the file).
 *
 * What the book shows once it is open — its first page, the picture on the
 * sleeping screen — comes from the file and stays as it was.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';
import { decode } from './site';

/** The box the reader's own pictures fit into (read off 483 of them: none wider than 260, none taller than 393). */
export const THUMB_WIDTH = 260;
export const THUMB_HEIGHT = 393;
/** Where the firmware keeps the pictures of the internal storage, relative to the reader's root. */
const CACHE = 'system/cover_chache/1';

export function thumbSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(THUMB_WIDTH / width, THUMB_HEIGHT / height, 1);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * A cover as the reader keeps it: grey, 8 bit, no more than 260 × 393. Every
 * pixel is the mean of the area it covers, so a cover of 2000 pixels does not
 * turn to grit. Null when the image does not decode.
 */
export function makeThumb(image: Uint8Array): Buffer | null {
  const img = decode(image, { maxMemoryUsageInMB: 256, maxResolutionInMP: 40 });
  if (!img) return null;
  const { width, height } = thumbSize(img.width, img.height);
  const out = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * img.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * img.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / width));
      let sum = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const at = (sy * img.width + sx) * 4;
          const alpha = img.rgba[at + 3] / 255;
          // Rec. 601 luma, on white where the image is transparent.
          sum += (0.299 * img.rgba[at] + 0.587 * img.rgba[at + 1] + 0.114 * img.rgba[at + 2]) * alpha + 255 * (1 - alpha);
        }
      }
      out[y * width + x] = Math.round(sum / ((y1 - y0) * (x1 - x0)));
    }
  }
  // pngjs wants RGBA in and writes what `colorType` says: 0 is grey.
  const png = new PNG({ width, height, colorType: 0, inputColorType: 0, bitDepth: 8, inputHasAlpha: false });
  png.data = out;
  return PNG.sync.write(png, { colorType: 0, inputColorType: 0, bitDepth: 8, inputHasAlpha: false });
}

/** Is this folder a PocketBook that Calibre has seen? */
export function isReader(root: string): boolean {
  return existsSync(join(root, CACHE)) && existsSync(join(root, 'metadata.calibre'));
}

/** The connected reader: `POCKETBOOK_READER`, or the one volume that looks like one. */
export function findReader(volumes = '/Volumes'): string | null {
  const given = process.env.POCKETBOOK_READER;
  if (given) return isReader(given) ? resolve(given) : null;
  if (!existsSync(volumes)) return null;
  const found = readdirSync(volumes)
    .map((name) => join(volumes, name))
    .filter(isReader);
  return found.length === 1 ? found[0] : null;
}

/** Calibre's own list on the reader: book number -> the files it sent for it. Entries without a number are books Calibre does not have. */
export function booksOnReader(listing: unknown): Map<number, string[]> {
  const out = new Map<number, string[]>();
  if (!Array.isArray(listing)) return out;
  for (const entry of listing as { application_id?: unknown; lpath?: unknown }[]) {
    if (typeof entry?.application_id !== 'number' || typeof entry.lpath !== 'string' || !entry.lpath) continue;
    // Calibre lists what it finds anywhere on the reader, the firmware's own files included
    // (`system/config/Active Contents/….html` stood there for two of Julian's books); those are not books on a shelf.
    if (/^system\//i.test(entry.lpath)) continue;
    out.set(entry.application_id, [...(out.get(entry.application_id) ?? []), entry.lpath]);
  }
  return out;
}

export function readBooksOnReader(root: string): Map<number, string[]> {
  return booksOnReader(JSON.parse(readFileSync(join(root, 'metadata.calibre'), 'utf8')));
}

/** Where the reader keeps the picture of a book file; an error when the listing names a path that would leave the pictures' folder. */
export function thumbFile(root: string, lpath: string): string {
  const cache = resolve(root, CACHE);
  const file = resolve(cache, `${lpath}.png`);
  if (!file.startsWith(cache + sep)) throw new Error(`The reader's list names a file outside its storage: ${lpath}`);
  return file;
}

export interface ReaderEntry {
  at: string;
  action: 'put' | 'back';
  bookId: number;
  /** The book file on the reader the picture belongs to. */
  lpath: string;
  /** The cover the picture was made from, as the app's journal names it. */
  coverId?: string;
  /** Where the picture that was there is kept; absent when the reader had none. */
  backup?: string;
}

export type PutResult = { ok: true; lpaths: string[] } | { ok: false; error: string };

export class ReaderCovers {
  /** `root`: the reader. `keep`: a folder on this Mac for the pictures that were there, and the record of what was done. */
  constructor(private readonly root: string, private readonly keep: string) {}

  private get journalFile(): string {
    return join(this.keep, 'reader.jsonl');
  }

  journal(): ReaderEntry[] {
    if (!existsSync(this.journalFile)) return [];
    return readFileSync(this.journalFile, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as ReaderEntry];
        } catch {
          return [];
        }
      });
  }

  private note(entry: ReaderEntry): void {
    mkdirSync(this.keep, { recursive: true });
    writeFileSync(this.journalFile, `${JSON.stringify(entry)}\n`, { flag: 'a' });
  }

  /** One picture into place: written beside it, read back, then moved over the old one. */
  private write(file: string, bytes: Buffer): void {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.new`;
    writeFileSync(tmp, bytes);
    if (!readFileSync(tmp).equals(bytes)) throw new Error('The reader did not keep the picture as it was written.');
    renameSync(tmp, file);
    // The reader's storage is FAT; macOS puts a file's attributes there as a second file, `._<name>` — seen on the first write. Not ours to leave behind.
    for (const name of [basename(file), basename(tmp)]) rmSync(join(dirname(file), `._${name}`), { force: true });
  }

  /** The cover of a Calibre book as the picture of each file the reader has for it. Nothing but that picture is touched. */
  put(bookId: number, cover: Uint8Array, coverId?: string): PutResult {
    let lpaths: string[];
    try {
      lpaths = (readBooksOnReader(this.root).get(bookId) ?? []).filter((lpath) => existsSync(join(this.root, lpath)));
    } catch {
      return { ok: false, error: 'The reader’s list of books (metadata.calibre) could not be read.' };
    }
    if (!lpaths.length) return { ok: false, error: 'This book is not on the reader — Calibre has not sent it there.' };
    const thumb = makeThumb(cover);
    if (!thumb) return { ok: false, error: 'The cover in Calibre does not decode.' };
    try {
      for (const lpath of lpaths) {
        const file = thumbFile(this.root, lpath);
        let backup: string | undefined;
        if (existsSync(file)) {
          backup = join(this.keep, 'pictures', String(bookId), `${new Date().toISOString().replace(/[:.]/g, '-')}-${lpaths.indexOf(lpath)}.png`);
          mkdirSync(dirname(backup), { recursive: true });
          copyFileSync(file, backup);
          if (!readFileSync(backup).equals(readFileSync(file))) return { ok: false, error: 'The copy of the reader’s old picture does not match it. Nothing was changed.' };
        }
        this.write(file, thumb);
        this.note({ at: new Date().toISOString(), action: 'put', bookId, lpath, ...(coverId ? { coverId } : {}), ...(backup ? { backup } : {}) });
      }
    } catch (err) {
      return { ok: false, error: `Writing to the reader failed: ${(err as Error).message}` };
    }
    return { ok: true, lpaths };
  }

  /** The pictures the reader had before the first `put` for this book, back in place. */
  back(bookId: number): PutResult {
    const first = new Map<string, ReaderEntry>();
    for (const e of this.journal()) {
      if (e.bookId !== bookId) continue;
      if (e.action === 'back') first.delete(e.lpath);
      else if (!first.has(e.lpath)) first.set(e.lpath, e);
    }
    const todo = [...first.values()].filter((e) => e.backup && existsSync(e.backup));
    if (!todo.length) return { ok: false, error: 'Nothing is kept for this book that could be put back.' };
    try {
      for (const e of todo) {
        this.write(thumbFile(this.root, e.lpath), readFileSync(e.backup as string));
        this.note({ at: new Date().toISOString(), action: 'back', bookId, lpath: e.lpath });
      }
    } catch (err) {
      return { ok: false, error: `Writing to the reader failed: ${(err as Error).message}` };
    }
    return { ok: true, lpaths: todo.map((e) => e.lpath) };
  }

  /**
   * Per book number: is it on the reader, and which cover this tool last put
   * there as its picture. That says what was written, not what the reader
   * shows now — it can make a picture of its own again, and nothing here sees that.
   */
  status(bookIds: readonly number[]): Map<number, { onReader: boolean; put?: string }> {
    const books = readBooksOnReader(this.root);
    const last = new Map<number, ReaderEntry>();
    for (const e of this.journal()) last.set(e.bookId, e);
    return new Map(
      bookIds.map((id) => {
        const onReader = (books.get(id) ?? []).some((lpath) => existsSync(join(this.root, lpath)));
        const e = last.get(id);
        return [id, { onReader, ...(onReader && e?.action === 'put' && e.coverId ? { put: e.coverId } : {}) }];
      }),
    );
  }
}

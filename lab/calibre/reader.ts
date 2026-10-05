/**
 * The covers on the PocketBook itself (lab/calibre, ROADMAP 5.16c).
 *
 * Julian, 2026-10-04: „can we push the new covers onto the pocketbook
 * ourselves? without using calibre?" Read off his reader (Touch Lux 3,
 * firmware 5.12) that evening:
 *
 *  - The reader does not read the cover out of the book when it shows a
 *    shelf. It keeps pictures of its own, named after the book file:
 *      library      `system/cover_chache/1/<path>.png`, fitted into 260 × 393
 *                   (the folder's name is the firmware's spelling)
 *      home screen  `system/cache/desktop/1/<path>_<W>x<H>.png`, one per size
 *                   the home screen uses (268×396, 250×368, 234×343, 123×184),
 *                   and copies of those by position — `desktop/rb/<n>.png` for
 *                   the n-th recent book, `desktop/t/<n>.png` for a tile —
 *                   with `desktop/cache.dat` saying which position is which file
 *    All of them 8-bit grey PNG.
 *  - It does not renew them when the file changes. *Ubik* had been sent again
 *    from Calibre the day before — the file on the reader carried the new
 *    cover, the library picture beside it was still April's; the home-screen
 *    pictures of *Roadside Picnic* were eleven months old.
 *  - Sending a book again makes it a new book for the reader. It knows a book
 *    by a hash of the file (`books_uids` in explorer-3.db): *Ubik* stood there
 *    twice, the old entry with its reading position and no file, the new one
 *    with the file and no position.
 *
 * So the way to a new cover on the reader's shelves is the pictures, not the
 * book: this writes those PNGs and nothing else — never a book file, never a
 * database, never `cache.dat`. Each picture that was there is copied away
 * first and can be put back. Which file on the reader is which Calibre book
 * says `metadata.calibre` in the reader's root folder, which Calibre keeps
 * (`application_id` is the book number, `lpath` the file).
 *
 * **Not the sleeping screen.** That picture (`system/cache/bookcover/<hash>.<n>`,
 * a 758 × 1024 bitmap) the reader draws from the cover inside the file each
 * time the book is opened, under a new number; and the first page of the open
 * book is the file's too. Both stay as the file has them.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';
import { imageSizeFast } from './image';
import { decode } from './site';

export interface Box {
  width: number;
  height: number;
}

/** The box the library's pictures fit into (read off 483 of them: none wider than 260, none taller than 393). */
export const LIBRARY_BOX: Box = { width: 260, height: 393 };
/** Where the firmware keeps the pictures of the internal storage, relative to the reader's root. */
const LIBRARY = 'system/cover_chache/1';
const HOME = 'system/cache/desktop';
/** The reader's own name for its internal storage, as `cache.dat` writes paths. */
const MOUNT = '/mnt/ext1/';

export function thumbSize(width: number, height: number, box: Box = LIBRARY_BOX): Box {
  const scale = Math.min(box.width / width, box.height / height, 1);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

type Decoded = NonNullable<ReturnType<typeof decode>>;

/** Grey, 8 bit, fitted into the box. Every pixel is the mean of the area it covers, so a cover of 2000 pixels does not turn to grit. */
function greyThumb(img: Decoded, box: Box): Buffer {
  const { width, height } = thumbSize(img.width, img.height, box);
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
  // Colour type 0 is grey; with the same type in and out pngjs takes one byte a pixel as it is.
  const png = new PNG({ width, height, colorType: 0, inputColorType: 0, bitDepth: 8, inputHasAlpha: false });
  png.data = out;
  return PNG.sync.write(png, { colorType: 0, inputColorType: 0, bitDepth: 8, inputHasAlpha: false });
}

/** A cover as the reader keeps it. Null when the image does not decode. */
export function makeThumb(image: Uint8Array, box: Box = LIBRARY_BOX): Buffer | null {
  const img = decode(image, { maxMemoryUsageInMB: 256, maxResolutionInMP: 40 });
  return img ? greyThumb(img, box) : null;
}

/** Is this folder a PocketBook that Calibre has seen? */
export function isReader(root: string): boolean {
  return existsSync(join(root, LIBRARY)) && existsSync(join(root, 'metadata.calibre'));
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

/** A path under one of the reader's picture folders, or an error when the listing names one that would leave it. */
function inside(root: string, folder: string, path: string): string {
  const base = resolve(root, folder);
  const file = resolve(base, path);
  if (!file.startsWith(base + sep)) throw new Error(`The reader's list names a file outside its storage: ${path}`);
  return file;
}

/** Where the reader keeps the library's picture of a book file. */
export function thumbFile(root: string, lpath: string): string {
  return inside(root, LIBRARY, `${lpath}.png`);
}

/** The positions on the home screen that show this book: `cache.dat` lines `rb.3.path=/mnt/ext1/<lpath>`. */
export function homePositions(cacheDat: string, lpath: string): string[] {
  const out: string[] = [];
  for (const line of cacheDat.split('\n')) {
    const m = /^(rb|t)\.(\d{1,4})\.path=(.*)$/.exec(line.trimEnd());
    if (m && m[3] === `${MOUNT}${lpath}`) out.push(`${m[1]}/${m[2]}.png`);
  }
  return out;
}

export interface Picture {
  /** The file on the reader. */
  file: string;
  box: Box;
  where: 'library' | 'home';
}

/**
 * Every picture the reader keeps of a book file. The library's always — the
 * reader makes one for every book. The home screen's only where the reader
 * has made them: it draws them for books that have stood there, and a picture
 * it never asked for would be one nobody reads.
 */
export function picturesOf(root: string, lpath: string): Picture[] {
  const out: Picture[] = [{ file: thumbFile(root, lpath), box: LIBRARY_BOX, where: 'library' }];
  const sizedDir = dirname(inside(root, `${HOME}/1`, lpath));
  const sized: Picture[] = [];
  if (existsSync(sizedDir)) {
    const name = basename(lpath);
    for (const entry of readdirSync(sizedDir)) {
      if (!entry.startsWith(`${name}_`)) continue;
      const m = /^_(\d{2,4})x(\d{2,4})\.png$/.exec(entry.slice(name.length));
      if (m) sized.push({ file: join(sizedDir, entry), box: { width: Number(m[1]), height: Number(m[2]) }, where: 'home' });
    }
  }
  out.push(...sized);
  // A position shows one of the sizes; which one, its own measure says — the reader names positions by number only.
  const index = join(root, HOME, 'cache.dat');
  if (sized.length && existsSync(index)) {
    const measure = (file: string) => imageSizeFast(readFileSync(file));
    const measured = sized.map((p) => ({ p, size: measure(p.file) }));
    for (const position of homePositions(readFileSync(index, 'utf8'), lpath)) {
      const file = inside(root, HOME, position);
      if (!existsSync(file)) continue;
      const size = measure(file);
      const same = measured.find((s) => s.size && size && s.size.width === size.width && s.size.height === size.height);
      if (same) out.push({ file, box: same.p.box, where: 'home' });
    }
  }
  return out;
}

export interface ReaderEntry {
  at: string;
  action: 'put' | 'back';
  bookId: number;
  /** The book file on the reader the picture belongs to. */
  lpath: string;
  /** The picture, relative to the reader's root. Absent in the first entry ever written (the library's picture of *Roadside Picnic*). */
  file?: string;
  /** The cover the picture was made from, as the app's journal names it. */
  coverId?: string;
  /** Where the picture that was there is kept; absent when the reader had none. */
  backup?: string;
}

export type PutResult = { ok: true; lpaths: string[]; pictures: string[] } | { ok: false; error: string };

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

  private fileOf(entry: ReaderEntry): string {
    return entry.file ?? relative(this.root, thumbFile(this.root, entry.lpath));
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

  /** The cover of a Calibre book as the reader's pictures of each file it has for it. Nothing but those pictures is touched. */
  put(bookId: number, cover: Uint8Array, coverId?: string): PutResult {
    let lpaths: string[];
    try {
      lpaths = (readBooksOnReader(this.root).get(bookId) ?? []).filter((lpath) => existsSync(join(this.root, lpath)));
    } catch {
      return { ok: false, error: 'The reader’s list of books (metadata.calibre) could not be read.' };
    }
    if (!lpaths.length) return { ok: false, error: 'This book is not on the reader — Calibre has not sent it there.' };
    const img = decode(cover, { maxMemoryUsageInMB: 256, maxResolutionInMP: 40 });
    if (!img) return { ok: false, error: 'The cover in Calibre does not decode.' };
    const written: string[] = [];
    try {
      let n = 0;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      for (const lpath of lpaths) {
        for (const picture of picturesOf(this.root, lpath)) {
          let backup: string | undefined;
          if (existsSync(picture.file)) {
            backup = join(this.keep, 'pictures', String(bookId), `${stamp}-${n++}.png`);
            mkdirSync(dirname(backup), { recursive: true });
            copyFileSync(picture.file, backup);
            if (!readFileSync(backup).equals(readFileSync(picture.file))) return { ok: false, error: 'The copy of one of the reader’s old pictures does not match it. That picture was not changed.' };
          }
          this.write(picture.file, greyThumb(img, picture.box));
          const file = relative(this.root, picture.file);
          this.note({ at: new Date().toISOString(), action: 'put', bookId, lpath, file, ...(coverId ? { coverId } : {}), ...(backup ? { backup } : {}) });
          written.push(file);
        }
      }
    } catch (err) {
      return { ok: false, error: `Writing to the reader failed: ${(err as Error).message}` };
    }
    return { ok: true, lpaths, pictures: written };
  }

  /** The pictures the reader had before the first `put` for this book, back in place. */
  back(bookId: number): PutResult {
    const first = new Map<string, ReaderEntry>();
    for (const e of this.journal()) {
      if (e.bookId !== bookId) continue;
      const file = this.fileOf(e);
      if (e.action === 'back') first.delete(file);
      else if (!first.has(file)) first.set(file, e);
    }
    const todo = [...first.entries()].filter(([, e]) => e.backup && existsSync(e.backup));
    if (!todo.length) return { ok: false, error: 'Nothing is kept for this book that could be put back.' };
    try {
      for (const [file, e] of todo) {
        // The path comes out of the tool's own record; it is checked all the same.
        const target = inside(this.root, 'system', relative('system', file));
        this.write(target, readFileSync(e.backup as string));
        this.note({ at: new Date().toISOString(), action: 'back', bookId, lpath: e.lpath, file });
      }
    } catch (err) {
      return { ok: false, error: `Writing to the reader failed: ${(err as Error).message}` };
    }
    return { ok: true, lpaths: [...new Set(todo.map(([, e]) => e.lpath))], pictures: todo.map(([file]) => file) };
  }

  /**
   * Per book number: is it on the reader, and which cover this tool last put
   * there as its pictures. That says what was written, not what the reader
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

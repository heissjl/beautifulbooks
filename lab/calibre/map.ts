/**
 * Which Calibre book is which work — written by the import, read on the way
 * back (lab/calibre-import, ROADMAP 5.17).
 *
 * The import (`lab/calibre-import`) builds a collection out of the library
 * and knows, for every tile, the book it came from. It leaves that here, one
 * file per collection, so that this tool can match a tile to its book by the
 * work alone — also when the book is called "Per Anhalter durch die Galaxis"
 * and the work "The Hitchhiker's Guide to the Galaxy".
 *
 * The files live beside the backups, outside the repository: they are a list
 * of Julian's books. A map speaks of books by their number, so it holds for
 * one library only (`libraryKey`); a rehearsal copy has the same numbers and
 * is named explicitly (`serve.ts --map <file>`).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isWallId } from './site';

export interface BookWork {
  bookId: number;
  workId: string;
}

export interface WorkMap {
  /** The collection's id on the site. */
  wall: string;
  /** `libraryKey` of the library the book numbers belong to. */
  library: string;
  createdAt: string;
  books: BookWork[];
}

export const mapFile = (backupRoot: string, wallId: string): string => join(backupRoot, 'maps', `${wallId}.json`);

/** A map as read from disk, or an error that says what is wrong with it. Pure. */
export function parseMap(raw: unknown): WorkMap {
  const m = raw as Partial<WorkMap> | null;
  if (!m || typeof m !== 'object') throw new Error('The map is not an object.');
  if (!isWallId(m.wall)) throw new Error('The map names no collection.');
  if (typeof m.library !== 'string' || !m.library) throw new Error('The map names no library.');
  if (!Array.isArray(m.books)) throw new Error('The map has no books.');
  const books = m.books.map((b: Partial<BookWork> | null) => {
    if (!b || !Number.isInteger(b.bookId) || (b.bookId as number) < 1 || typeof b.workId !== 'string' || !/^OL\d{1,12}W$/.test(b.workId)) throw new Error('The map holds a line that is not a book and a work.');
    return { bookId: b.bookId as number, workId: b.workId };
  });
  return { wall: m.wall, library: m.library, createdAt: typeof m.createdAt === 'string' ? m.createdAt : '', books };
}

/** Work → the books the import made its tile from. */
export function booksByWork(map: Pick<WorkMap, 'books'>): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const { bookId, workId } of map.books) out.set(workId, [...(out.get(workId) ?? []), bookId]);
  return out;
}

export function writeMap(backupRoot: string, map: WorkMap): string {
  const file = mapFile(backupRoot, map.wall);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(parseMap(map), null, 1)}\n`);
  renameSync(tmp, file);
  return file;
}

/**
 * The map for this collection and this library, or the reason there is none.
 * A map made for another library is not used: its book numbers mean other books.
 */
export function loadMap(file: string, wallId: string, library: string | null): { map: WorkMap } | { none: string } {
  if (!existsSync(file)) return { none: 'no map for this collection' };
  let map: WorkMap;
  try {
    map = parseMap(JSON.parse(readFileSync(file, 'utf8')));
  } catch (err) {
    return { none: `the map does not read: ${(err as Error).message}` };
  }
  if (map.wall !== wallId) return { none: `the map is for another collection (${map.wall})` };
  if (library !== null && map.library !== library) return { none: `the map was made for another library (${map.library})` };
  return { map };
}

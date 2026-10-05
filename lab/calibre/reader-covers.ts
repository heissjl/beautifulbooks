/**
 * The covers changed here, as pictures on the connected PocketBook (lab/calibre, ROADMAP 5.16c).
 *
 *   npx tsx lab/calibre/reader-covers.ts                 # what is where: looks, changes nothing
 *   npx tsx lab/calibre/reader-covers.ts --put <book>    # the cover Calibre has for this book, as its picture on the reader
 *   npx tsx lab/calibre/reader-covers.ts --back <book>   # the picture the reader had before
 *
 * `<book>` is Calibre's book number. Only the reader's own picture of the
 * book is written (`reader.ts`): no book file, no database. The picture that
 * was there is kept beside the library's backups, under `reader/`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { imageSizeFast } from './image';
import { coverFile, findLibrary, readLibrary } from './library';
import { findReader, ReaderCovers, readBooksOnReader, thumbFile } from './reader';
import { CoverWriter, defaultBackupRoot, findCalibredb, undoStacks } from './safety';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

const root = findReader();
if (!root) {
  console.error('No PocketBook found under /Volumes (a volume with system/cover_chache and metadata.calibre). Connect it, or set POCKETBOOK_READER.');
  process.exit(1);
}
const library = findLibrary(flag('library'));
const writer = new CoverWriter({ library, calibredb: findCalibredb(), backupRoot: defaultBackupRoot() });
const books = readLibrary(library);
const reader = new ReaderCovers(root, join(writer.root, 'reader'));
const px = (file: string): string => {
  const size = existsSync(file) ? imageSizeFast(readFileSync(file)) : null;
  return size ? `${size.width} × ${size.height}` : 'none';
};

const put = flag('put');
const back = flag('back');
if (put || back) {
  const book = books.find((b) => b.id === Number(put ?? back));
  if (!book) {
    console.error(`Calibre has no book #${put ?? back}.`);
    process.exit(1);
  }
  const top = undoStacks(writer.journal()).get(book.id)?.at(-1);
  const result = put ? reader.put(book.id, readFileSync(coverFile(library, book)), top?.coverId ?? 'calibre') : reader.back(book.id);
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  for (const lpath of result.lpaths) console.log(`#${book.id} „${book.title}": ${put ? 'picture written' : 'old picture back'} — ${thumbFile(root, lpath)} (${px(thumbFile(root, lpath))})`);
  console.log(`kept:   ${join(writer.root, 'reader')}`);
} else {
  const stacks = undoStacks(writer.journal());
  const onReader = readBooksOnReader(root);
  const status = reader.status([...stacks.keys()]);
  console.log(`reader:  ${root} — ${onReader.size} of Calibre's books on it`);
  console.log(`changed: ${stacks.size} covers here\n`);
  for (const [id, stack] of stacks) {
    const book = books.find((b) => b.id === id);
    const lpaths = onReader.get(id) ?? [];
    const where = lpaths.length ? lpaths.map((l) => `${l} [picture ${px(thumbFile(root, l))}]`).join('; ') : 'not on the reader';
    console.log(`#${id} ${(book?.title ?? stack[0].title).slice(0, 34).padEnd(34)} ${status.get(id)?.put ? 'put  ' : '     '} ${where}`);
  }
}

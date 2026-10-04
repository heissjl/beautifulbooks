/**
 * A rehearsal copy of the Calibre library: every book and its cover, no e-book files (lab/calibre, ROADMAP 5.16).
 *
 *   npx tsx lab/calibre/rehearsal.ts
 *
 * Copies `metadata.db` and each book's `cover.jpg` into a new folder beside
 * the backups and prints the command that runs the tool against it. The first
 * `--write` belongs there: the real titles and covers, and nothing to lose.
 * The copy opens in Calibre like any library (its books have no files to read).
 *
 * The real library is only read. Each run makes a new folder and deletes
 * nothing; a rehearsal copy may be thrown away by hand at any time.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { bookDir, coverFile, findLibrary, readLibrary } from './library';
import { defaultBackupRoot } from './safety';

const args = process.argv.slice(2);
const at = args.indexOf('--library');
const library = findLibrary(at >= 0 ? args[at + 1] : undefined);
const books = readLibrary(library);
const target = join(defaultBackupRoot(), 'rehearsal', new Date().toISOString().replace(/[:.]/g, '-'), basename(library));

mkdirSync(target, { recursive: true });
copyFileSync(join(library, 'metadata.db'), join(target, 'metadata.db'));
let covers = 0;
let absent = 0;
for (const book of books) {
  const dir = join(target, book.path);
  // The folder must exist even without a cover: Calibre writes the book's metadata.opf there.
  mkdirSync(dir, { recursive: true });
  const cover = coverFile(library, book);
  if (existsSync(cover)) {
    copyFileSync(cover, join(dir, 'cover.jpg'));
    covers++;
  } else if (book.hasCover) {
    absent++;
    console.log(`  no cover file on this Mac for „${book.title}" (${bookDir(library, book)}) — probably only in iCloud`);
  }
}

console.log(`Rehearsal copy: ${books.length} books, ${covers} covers${absent ? `, ${absent} covers not on this Mac` : ''}`);
console.log(target);
console.log('\nRun the tool against it:');
console.log(`  npx tsx lab/calibre/serve.ts <collection> --write --library "${target}"`);

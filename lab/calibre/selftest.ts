/**
 * The write path, proven on a throwaway library before it meets a real one (lab/calibre, ROADMAP 5.16).
 *
 *   npx tsx lab/calibre/selftest.ts
 *
 * Makes an empty Calibre library in a temporary folder, adds two books with
 * `calibredb`, and walks the whole path of `safety.ts`: a first cover, a
 * second one over it, a broken image that must be refused, two undos back to
 * the start. Julian's library is not opened, read or named anywhere in this
 * script. Calibre must be closed — `calibredb` refuses otherwise, for every
 * library.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { imageFacts } from './image';
import { coverFile, readLibrary } from './library';
import { CoverWriter, findCalibredb, undoStacks } from './safety';

function solid(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) png.data.set([r, g, b, 255], i * 4);
  return PNG.sync.write(png);
}

let failed = 0;
function expect(what: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}

const calibredb = findCalibredb();
if (!calibredb) {
  console.error('calibredb was not found. Set CALIBREDB to its path.');
  process.exit(1);
}
const root = mkdtempSync(join(tmpdir(), 'calibre-selftest-'));
const library = join(root, 'library');
const backupRoot = join(root, 'backup');
const db = (...args: string[]) => spawnSync(calibredb, [...args, '--with-library', library], { encoding: 'utf8', timeout: 120_000 });

const text = join(root, 'book.txt');
writeFileSync(text, 'A book that must still be here, byte for byte, when the covers have changed.\n');
const added = db('add', text, '--title', 'Self Test', '--authors', 'Nobody');
const other = db('add', '--empty', '--title', 'Bystander', '--authors', 'Somebody');
if (added.status !== 0 || other.status !== 0) {
  console.error(`calibredb could not make the throwaway library: ${(added.stderr || other.stderr).trim()}`);
  console.error('Is Calibre open? Quit it and run the self-test again.');
  process.exit(1);
}

const writer = new CoverWriter({ library, calibredb, backupRoot });
const start = readLibrary(library);
const book = start.find((b) => b.title === 'Self Test');
const bystander = start.find((b) => b.title === 'Bystander');
if (!book || !bystander) {
  console.error('The throwaway library does not hold the two books that were added.');
  process.exit(1);
}
const formatName = readdirSync(join(library, book.path)).find((f) => f.endsWith('.txt'));
const format = join(library, book.path, formatName ?? 'missing.txt');
const formatBefore = formatName ? readFileSync(format).toString('hex') : null;
expect('throwaway library holds two books', start.length === 2);
expect('no cover to begin with', !book.hasCover && !existsSync(coverFile(library, book)));
expect('nothing stands in the way of a write', writer.problems().length === 0, writer.problems().join(' '));

const first = writer.apply(book.id, solid(300, 450, [180, 60, 40]), 'ol:1');
expect('first cover written', first.ok, first.ok ? '' : first.error);
const afterFirst = imageFacts(readFileSync(coverFile(library, book)));
expect('first cover is 300 × 450 on disk', afterFirst?.width === 300 && afterFirst.height === 450, afterFirst ? `${afterFirst.width} × ${afterFirst.height}` : 'no file');
expect('a snapshot of metadata.db was taken', existsSync(join(writer.root, 'snapshots')));

const second = writer.apply(book.id, solid(400, 600, [40, 90, 160]), 'ol:2');
expect('second cover written over the first', second.ok, second.ok ? '' : second.error);
const afterSecond = imageFacts(readFileSync(coverFile(library, book)));
expect('second cover is 400 × 600 on disk', afterSecond?.width === 400 && afterSecond.height === 600);
expect('the first cover was backed up before it was replaced', second.ok && !!second.entry.backup && existsSync(second.entry.backup));

const broken = writer.apply(book.id, Buffer.from('<html>503 Service Unavailable</html>'), 'ol:3');
expect('an error page is refused as a cover', !broken.ok && !broken.halted);
const tiny = writer.apply(book.id, solid(40, 60, [0, 0, 0]), 'ol:4');
expect('a thumbnail is refused as a cover', !tiny.ok);
const stillSecond = imageFacts(readFileSync(coverFile(library, book)));
expect('the refused images changed nothing', stillSecond?.width === 400);
expect('a book that does not exist is refused', !writer.apply(9999, solid(300, 450, [1, 2, 3]), 'ol:5').ok);

const undone = writer.undo(book.id);
expect('undo puts the first cover back', undone.ok, undone.ok ? '' : undone.error);
const afterUndo = imageFacts(readFileSync(coverFile(library, book)));
expect('the cover on disk is 300 × 450 again', afterUndo?.width === 300 && afterUndo.height === 450);
const again = writer.undo(book.id);
expect('a second undo says there was no cover before', !again.ok && /no cover before/.test(again.error));
expect('the journal knows one write is left to this book', undoStacks(writer.journal()).get(book.id)?.length === 1);

const end = readLibrary(library);
const endBystander = end.find((b) => b.id === bystander.id);
expect('still two books', end.length === 2);
expect('the other book was not touched', !!endBystander && !endBystander.hasCover && endBystander.title === 'Bystander');
if (formatBefore !== null) expect('the e-book file is byte for byte the same', readFileSync(format).toString('hex') === formatBefore);
else expect('the e-book file was found to compare', false, format);
// With --csv Calibre prints one line per problem and nothing when the library is sound.
const check = db('check_library', '--csv');
const findings = check.stdout.split('\n').filter((line) => line.trim() && !/^Vacuuming/.test(line));
expect('Calibre’s own check_library finds nothing wrong', check.status === 0 && findings.length === 0, findings.slice(0, 3).join(' | '));

console.log(failed ? `\n${failed} checks FAILED — do not use --write on a real library. Left for inspection: ${root}` : `\nAll checks passed. (Throwaway library: ${root})`);
process.exit(failed ? 1 : 0);

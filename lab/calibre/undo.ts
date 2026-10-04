/**
 * Takes cover changes back, without the page and without the collection (lab/calibre, ROADMAP 5.16).
 *
 *   npx tsx lab/calibre/undo.ts              # what could be undone — changes nothing
 *   npx tsx lab/calibre/undo.ts <book id>    # the latest change to one book
 *   npx tsx lab/calibre/undo.ts --all        # every change, back to the covers before the tool
 *
 * `--library <folder>` for another library than Calibre's own. Works from
 * the journal and the backups in `safety.ts`; the same checks run as for any
 * write, so Calibre must be closed.
 */
import { findLibrary } from './library';
import { CoverWriter, defaultBackupRoot, findCalibredb, undoStacks } from './safety';

const args = process.argv.slice(2);
const at = args.indexOf('--library');
const library = findLibrary(at >= 0 ? args[at + 1] : undefined);
const rest = args.filter((a, i) => a !== '--library' && args[i - 1] !== '--library');
const writer = new CoverWriter({ library, calibredb: findCalibredb(), backupRoot: defaultBackupRoot() });
const stacks = () => undoStacks(writer.journal());

console.log(`library: ${library}`);
console.log(`journal: ${writer.journalFile}`);

if (rest.length === 0) {
  if (stacks().size === 0) console.log('Nothing to undo.');
  for (const [id, stack] of stacks()) {
    const last = stack[stack.length - 1];
    console.log(`  #${id} „${last.title}": ${stack.length} change${stack.length > 1 ? 's' : ''}, the latest ${last.at} (${last.coverId})${stack[0].backup ? '' : ' — had no cover before the first'}`);
  }
  process.exit(0);
}

const ids = rest[0] === '--all' ? [...stacks().keys()] : [Number(rest[0])];
if (ids.some((id) => !Number.isInteger(id))) {
  console.error('Give a book id (a number) or --all.');
  process.exit(1);
}
let failed = false;
for (const id of ids) {
  if (!stacks().has(id)) {
    console.log(`  #${id}: nothing to undo`);
    continue;
  }
  // --all walks a book back to its first backup; a single id takes back one change.
  do {
    const last = stacks().get(id)?.at(-1);
    if (!last?.backup) {
      console.log(`  #${id} „${last?.title ?? ''}": had no cover before — left as it is`);
      break;
    }
    const result = writer.undo(id);
    console.log(result.ok ? `  #${id} „${result.entry.title}": put back` : `  #${id}: ${result.error}`);
    if (!result.ok) {
      failed = true;
      break;
    }
  } while (rest[0] === '--all' && stacks().has(id));
  if (failed) break;
}
process.exit(failed ? 1 : 0);

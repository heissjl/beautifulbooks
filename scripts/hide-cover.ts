/**
 * Take a cover off the site on request (ROADMAP 2.18k, 2.18o).
 *
 *   npx tsx scripts/hide-cover.ts ol:12345 "publisher asked, mail of 2026-10-05"
 *
 * Adds the id to data/hidden-covers.json (once) and prints what is left to
 * do: commit and deploy, then empty the image optimizer's cache for this
 * cover. The optimizer keeps a cover across deploys (that is why it is there),
 * so without the purge the picture stays up to thirty days on the site even
 * though /img already refuses it. The commands are printed, not run: they act
 * on production and are Julian's to start.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHiddenCovers, type HiddenCover } from '../lib/hiddencovers';
import { COVER_ORIGIN, coverPathSegment } from '../lib/coverurl';

const [id, ...noteWords] = process.argv.slice(2);
const file = join(__dirname, '..', 'data', 'hidden-covers.json');

if (!id || parseHiddenCovers({ covers: [{ id }] }).size === 0) {
  console.error('Usage: npx tsx scripts/hide-cover.ts <ol:123 | gb:abc | local:name> [note]');
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, 'utf8')) as { covers: HiddenCover[] };
if (data.covers.some(c => c.id === id)) {
  console.log(`${id} is already on the list.`);
} else {
  const entry: HiddenCover = { id, hidden: new Date().toISOString().slice(0, 10) };
  if (noteWords.length > 0) entry.note = noteWords.join(' ');
  data.covers.push(entry);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Added ${id} to data/hidden-covers.json.`);
}

console.log('\nThen: commit, push to main (a deploy), and empty the optimizer cache:\n');
if (id.startsWith('local:')) {
  console.log('  (a collection\'s own file does not go through the optimizer; the deploy is enough)');
} else {
  for (const size of ['S', 'M', 'L'] as const) {
    for (const retry of ['', '?retry=1']) {
      console.log(`  vercel cache invalidate --project beautifulbooks --srcimg "${COVER_ORIGIN}/img/${size}/${coverPathSegment(id)}${retry}" --yes`);
    }
  }
}

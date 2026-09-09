/**
 * What folding does to a decade page (ROADMAP 5.4a, 2026-09-09).
 *
 *   npx tsx scripts/measure-decade-fold.ts OL498463W OL64365W
 *
 * Prints covers before and after, and how many of them the index knows —
 * the third number is the one that decides whether the first two mean
 * anything.
 */
import { indexSignatures } from '../lib/coverindex';
import { groupByDecade, worthAPage } from '../lib/decades';
import { getWorkDetail } from '../lib/work';
import { foldDuplicateCovers } from '../lib/works';

async function main() {
  const ids = process.argv.slice(2);
  for (const id of ids) {
    const detail = await getWorkDetail(id, { maxEntries: 600, dedupeCovers: false, googleBooks: false });
    if (!detail) { console.log(`${id}: no work`); continue; }
    const sigs = indexSignatures(detail.covers.map(c => c.id));
    const folded = foldDuplicateCovers(detail.covers, sigs, detail.editions);
    const before = groupByDecade(detail.covers, detail.editions);
    const after = groupByDecade(folded, detail.editions);
    console.log(
      `${id} ${detail.work.title}\n` +
      `  covers ${before.coverCount} -> ${after.coverCount} (-${before.coverCount - after.coverCount})` +
      `  signatures known ${sigs.size}/${detail.covers.length}` +
      `  decades ${before.groups.length} -> ${after.groups.length}` +
      `  page ${worthAPage(before) ? 'yes' : 'no'} -> ${worthAPage(after) ? 'yes' : 'no'}`,
    );
  }
}

main();

/**
 * What the cross-publisher tier changes on a wall (ROADMAP 6.36).
 *
 *   npx tsx scripts/measure-fold-effect.ts OL103123W OL66554W
 *
 * Folds each work twice — once as the wall did before, once with the fourth
 * tier — and prints both counts. Signatures come from the built index, which
 * carries the colour the tier needs (E18), so the numbers are the same ones a
 * reader sees on a curated work and no image is fetched.
 */
import indexFile from '../data/cover-index.json';
import { indexSignatures } from '../lib/coverindex';
import { getWorkDetail } from '../lib/work';
import { foldDuplicateCovers } from '../lib/works';

async function main() {
  const ids = process.argv.slice(2);
  const works = ids.length > 0
    ? ids.map(id => ({ id, title: id }))
    : (indexFile.works as Array<[string, string, string]>).slice(0, 12).map(([id, title]) => ({ id, title }));

  let before = 0;
  let after = 0;
  for (const work of works) {
    const detail = await getWorkDetail(work.id, { maxEntries: 400, dedupeCovers: false, googleBooks: false });
    if (!detail) { console.log(`${work.id}: no work`); continue; }
    const sigs = indexSignatures(detail.covers.map(c => c.id));
    // `sameDesign: 0` is the wall before the tier: no distance can pass it.
    const old = foldDuplicateCovers(detail.covers, sigs, detail.editions, { sameDesign: 0 });
    const now = foldDuplicateCovers(detail.covers, sigs, detail.editions);
    before += old.length;
    after += now.length;
    const title = detail.work.title.slice(0, 34);
    console.log(
      `${work.id} ${title.padEnd(35)} covers ${String(detail.covers.length).padStart(4)}` +
      ` · folded ${String(old.length).padStart(4)} -> ${String(now.length).padStart(4)}` +
      ` (-${old.length - now.length})  signatures ${sigs.size}/${detail.covers.length}`,
    );
  }
  console.log(`\ntotal ${before} -> ${after} tiles (-${before - after}, ${((before - after) / before * 100).toFixed(1)} %)`);
}

main();

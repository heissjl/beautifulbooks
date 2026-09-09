/**
 * Promotes a work into what the site points at (ROADMAP 5.1, 5.4a).
 *
 *   npx tsx scripts/promote.ts OL1168083W OL66554W
 *
 * Julian, 2026-09-09: a book that turns out to clear the threshold should be
 * able to join the list, and grow the sitemap in a later commit. The loop is
 * then: read the popular paths out of Vercel Web Analytics, throw the work
 * ids in here, commit what changed.
 *
 * **Nothing here runs in a request.** The site writes nothing (E6, E18); this
 * is a script whose output is committed, like the fixtures and the cover
 * index. That is also why promotion is three steps and not one:
 *
 *   1. the work joins `data/index-works.json`, which is the publish list;
 *   2. `build-cover-index.ts` computes its cover signatures — without them
 *      its decade page folds nothing and shows the duplicates of 2026-09-09;
 *   3. `find-decade-pages.ts` measures whether it carries a decade page.
 *
 * Steps 2 and 3 are the existing scripts, run as they are. Both are
 * resumable and skip what is already done, so promoting a work that is
 * already indexed costs only the measurement.
 *
 * Costs, measured 2026-09-09: 6.4 KB in the cover index per work (890 KB at
 * 139 works, so ~3 MB at five hundred), 156 bytes in the decade list, one
 * Open Library request to learn a new work's title, and **no Google request**
 * anywhere (E10).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PUBLISHED_WORKS } from '../lib/published';
import { getWorkPage } from '../lib/work';

const WORKS_FILE = path.join(process.cwd(), 'data', 'index-works.json');
const DECADES_FILE = path.join(process.cwd(), 'data', 'decade-pages.json');
const WORK_ID = /^OL\d+W$/;

interface IndexWorkRow {
  id: string;
  title: string;
  author: string;
  editionCount: number;
  source: string;
}

function decadePageIds(): Set<string> {
  try {
    const file = JSON.parse(readFileSync(DECADES_FILE, 'utf8')) as { pages: Array<{ id: string }> };
    return new Set(file.pages.map(p => p.id));
  } catch {
    return new Set();
  }
}

/** Runs one of the sibling scripts and lets its output through. */
function run(script: string): boolean {
  console.log(`\n--- ${script} ---`);
  const r = spawnSync('npx', ['tsx', `scripts/${script}`], { stdio: 'inherit' });
  return r.status === 0;
}

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error('Usage: npx tsx scripts/promote.ts OL123W [OL456W ...]');
    process.exitCode = 1;
    return;
  }

  const malformed = ids.filter(id => !WORK_ID.test(id));
  if (malformed.length > 0) {
    // A bad id would reach the sitemap as an address that cannot exist.
    console.error(`Not work ids: ${malformed.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const known = new Set(PUBLISHED_WORKS.map(w => w.id));
  const fresh = ids.filter(id => !known.has(id));
  const already = ids.filter(id => known.has(id));
  for (const id of already) console.log(`  = ${id} is already on the list`);

  if (fresh.length > 0) {
    const file = JSON.parse(readFileSync(WORKS_FILE, 'utf8')) as { pickedAt: string; works: IndexWorkRow[] };
    for (const id of fresh) {
      // One request, and only to learn what to call it in the list.
      const page = await getWorkPage(id, { offset: 0, googleBooks: false });
      if (!page) {
        console.log(`  ? ${id}: the catalogue does not know this work — skipped`);
        continue;
      }
      file.works.push({
        id,
        title: page.work.title,
        author: page.work.authors[0] ?? '',
        editionCount: page.work.editionCount ?? 0,
        source: 'promoted',
      });
      console.log(`  + ${id} ${page.work.title}`);
    }
    file.pickedAt = new Date().toISOString().slice(0, 10);
    writeFileSync(WORKS_FILE, `${JSON.stringify(file, null, 1)}\n`);
  }

  const before = decadePageIds();
  if (!run('build-cover-index.ts')) { console.error('\nThe index build failed; nothing measured.'); process.exitCode = 1; return; }
  if (!run('find-decade-pages.ts')) { console.error('\nThe measurement failed.'); process.exitCode = 1; return; }
  const after = decadePageIds();

  console.log('\n=== promoted ===');
  for (const id of ids) {
    const carries = after.has(id);
    const isNew = carries && !before.has(id);
    console.log(`  ${id}: work page in the sitemap, decade page ${carries ? (isNew ? 'added' : 'already there') : 'no — below the threshold'}`);
  }
  console.log(`\ndecade pages: ${before.size} -> ${after.size}. Commit data/index-works.json, data/cover-index.json and data/decade-pages.json.`);
}

main();

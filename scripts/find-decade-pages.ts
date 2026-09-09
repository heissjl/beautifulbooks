/**
 * Stufe 0 der Fabrik (PLAN-5 §4): which curated works carry a decade page
 * (ROADMAP 5.4a).
 *
 *   npx tsx scripts/find-decade-pages.ts
 *
 * Deterministic, no model, **no Google request** (E10): it loads each work's
 * editions from Open Library and applies the threshold from `lib/decades.ts`.
 * Writes `data/decade-pages.json`, which decides two things — whether the
 * work page shows a link, and whether the address is in the sitemap. A page
 * that would be thin is never offered rather than offered and disappointing
 * (R6).
 *
 * The scan is capped per work: the threshold is 20 covers across 4 decades,
 * and six pages of records decide that long before the cap of 1,500 does.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { CURATED_LIST } from '../lib/curated';
import { groupByDecade, worthAPage } from '../lib/decades';
import { getWorkDetail } from '../lib/work';
import { indexSignatures } from '../lib/coverindex';
import { foldDuplicateCovers } from '../lib/works';

const OUT_FILE = path.join(process.cwd(), 'data', 'decade-pages.json');
const MAX_ENTRIES = 600;

export interface DecadePage {
  id: string;
  title: string;
  coverCount: number;
  decades: number;
  from: number;
  to: number;
}

async function main() {
  const out: DecadePage[] = [];
  let thin = 0;
  let silent = 0;

  for (const [i, work] of CURATED_LIST.entries()) {
    let detail;
    try {
      detail = await getWorkDetail(work.id, { maxEntries: MAX_ENTRIES, dedupeCovers: false, googleBooks: false });
    } catch (err) {
      silent += 1;
      console.log(`  ? ${work.title}: ${(err as Error).message}`);
      continue;
    }
    if (!detail) { silent += 1; continue; }

    /*
      The same fold as the page, or the two disagree about the threshold and
      the sitemap points at a 404 — the bug of 2026-09-09, one step upstream.
    */
    const covers = foldDuplicateCovers(detail.covers, indexSignatures(detail.covers.map(c => c.id)), detail.editions);
    const d = groupByDecade(covers, detail.editions);
    if (!worthAPage(d) || d.from === undefined || d.to === undefined) {
      thin += 1;
      console.log(`  - ${work.title}: ${d.coverCount} covers over ${d.groups.length} decades`);
      continue;
    }
    out.push({
      id: work.id,
      title: work.title,
      coverCount: d.coverCount,
      decades: d.groups.length,
      from: d.from,
      to: d.to,
    });
    console.log(`  + ${work.title}: ${d.coverCount} covers, ${d.groups.length} decades (${d.from}s–${d.to}s)  [${i + 1}/${CURATED_LIST.length}]`);
  }

  writeFileSync(OUT_FILE, `${JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), pages: out }, null, 2)}\n`);
  console.log(`\ndecade pages: ${out.length} of ${CURATED_LIST.length} qualify, ${thin} too thin, ${silent} the catalogue did not answer`);
}

void main();

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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PUBLISHED_WORKS } from '../lib/published';
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
  let carried = 0;

  /*
    The previous list, so that a catalogue that does not answer cannot delete
    a page (CLAUDE.md: a failure must never be reported as a finding).
    Measured 2026-09-09: one run in five timed out on a single work — *White
    Noise*, which qualifies with 22 covers over 4 decades — and the work would
    have silently left the sitemap for a reason that has nothing to do with
    its data. A silent work keeps what it had; only a work that answered can
    lose its page.
  */
  const previous = new Map<string, DecadePage>(
    existsSync(OUT_FILE)
      ? (JSON.parse(readFileSync(OUT_FILE, 'utf8')) as { pages: DecadePage[] }).pages.map(p => [p.id, p])
      : [],
  );

  for (const [i, work] of PUBLISHED_WORKS.entries()) {
    let detail;
    try {
      detail = await getWorkDetail(work.id, { maxEntries: MAX_ENTRIES, dedupeCovers: false, googleBooks: false });
    } catch (err) {
      silent += 1;
      const kept = previous.get(work.id);
      if (kept) { out.push(kept); carried += 1; }
      console.log(`  ? ${work.title}: ${(err as Error).message}${kept ? ' — keeping the previous entry' : ''}`);
      continue;
    }
    if (!detail) {
      silent += 1;
      const kept = previous.get(work.id);
      if (kept) { out.push(kept); carried += 1; }
      continue;
    }

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
    console.log(`  + ${work.title}: ${d.coverCount} covers, ${d.groups.length} decades (${d.from}s–${d.to}s)  [${i + 1}/${PUBLISHED_WORKS.length}]`);
  }

  writeFileSync(OUT_FILE, `${JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), pages: out }, null, 2)}\n`);
  console.log(
    `\ndecade pages: ${out.length} of ${PUBLISHED_WORKS.length} qualify, ${thin} too thin, ` +
    `${silent} the catalogue did not answer (${carried} of those kept their previous entry)`,
  );
}

void main();

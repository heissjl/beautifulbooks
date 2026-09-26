/**
 * Writes a draft collection from a list of per-work cover candidates
 * (Julian, 2026-09-26: the SF Masterworks relaunch „with international
 * covers. try all russian covers first").
 *
 *   npx tsx lab/collections/from-candidates.ts lab/collections/lists/sf-relaunch-international.json \
 *     sf-masterworks-relaunch-international "SF Masterworks, the relaunch — international covers" openlibrary
 *
 * The list comes from `lab/international-covers/international.ts` (or
 * `russian.ts`, whose rows carry no language: pass `openlibrary:rus`). Only works with
 * a found cover go on the wall, in list order (`candidates.ts`). The data
 * file (`data/collections.json`, or `COLLECTIONS_FILE`) is read fresh right
 * before the write, and only the one slug is added or replaced — the
 * curation tool or another script may be editing the others.
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionRecord } from '../../lib/collections';
import { draftFromCandidates, upsertCollection, type CandidateRow } from './candidates';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT_FILE = process.env.COLLECTIONS_FILE ?? join(ROOT, 'data', 'collections.json');

function main() {
  const [listFile, slug, title, from = 'openlibrary'] = process.argv.slice(2);
  if (!listFile || !slug || !title) throw new Error('usage: from-candidates.ts <list.json> <slug> "<title>" [from]');
  const rows = JSON.parse(readFileSync(listFile, 'utf8')) as CandidateRow[];
  const failed = rows.filter(r => r.status === 'failed');

  const file = JSON.parse(readFileSync(OUT_FILE, 'utf8')) as { curatedAt?: string; collections: CollectionRecord[] };
  const existing = file.collections.find(c => c.slug === slug);
  const record = draftFromCandidates(rows, { slug, title, from, addedAt: new Date().toISOString().slice(0, 10) }, existing);
  const collections = upsertCollection(file.collections, record);
  const tmp = `${OUT_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ ...file, curatedAt: new Date().toISOString().slice(0, 10), collections }, null, 2)}\n`);
  renameSync(tmp, OUT_FILE);

  console.log(`${slug}: ${record.works.length} of ${rows.length} on the wall (draft)`);
  if (failed.length) console.log(`not asked successfully, re-run the lookup first (${failed.length}): ${failed.map(r => r.title).join(', ')}`);
}

main();

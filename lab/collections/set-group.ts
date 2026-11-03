/**
 * Sets the hub group of collections in `data/collections.json` (ROADMAP 6.107
 * Teil A, PLAN-6.107 § 5 A 3): where a collection stands on `/collections` —
 * a publisher's series, one designer's covers, a prize or a reading list, a
 * publisher's list.
 *
 *   npx tsx lab/collections/set-group.ts <group> <slug> [<slug> …]
 *   npx tsx lab/collections/set-group.ts --missing          # lists records without a group
 *
 * The group is data, not code: the file is written only by this folder
 * (CLAUDE.md), and no slug is read for its meaning anywhere in `lib/`. The
 * running app (`serve.ts`) has the same field in its "Seite" section; this is
 * the way to set many at once. `COLLECTIONS_FILE=<path>` redirects the write,
 * as for the other tools here.
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_GROUPS, isCollectionGroup, type CollectionRecord } from '../../lib/collections';

const ROOT = join(import.meta.dirname, '..', '..');
const FILE = process.env.COLLECTIONS_FILE ?? join(ROOT, 'data', 'collections.json');

function main() {
  const [first, ...slugs] = process.argv.slice(2);
  const data = JSON.parse(readFileSync(FILE, 'utf8')) as { curatedAt?: string; collections: CollectionRecord[] };
  if (first === '--missing') {
    for (const c of data.collections) if (!isCollectionGroup(c.group)) console.log(`${c.slug} (${c.kind})`);
    return;
  }
  if (!isCollectionGroup(first) || slugs.length === 0) {
    throw new Error(`usage: set-group.ts <${HUB_GROUPS.join('|')}> <slug> [<slug> …]`);
  }
  const known = new Set(data.collections.map(c => c.slug));
  const unknown = slugs.filter(s => !known.has(s));
  if (unknown.length) throw new Error(`no such collection: ${unknown.join(', ')}`);
  data.collections = data.collections.map(c => (slugs.includes(c.slug) ? withGroup(c, first) : c));
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, FILE);
  console.log(`${slugs.length} × ${first} -> ${FILE}`);
}

/** `group` right after `kind`, so the file reads as the type does. */
function withGroup(c: CollectionRecord, group: CollectionRecord['group']): CollectionRecord {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (k === 'group') continue;
    out[k] = v;
    if (k === 'kind') out.group = group;
  }
  if (!('group' in out)) out.group = group;
  return out as unknown as CollectionRecord;
}

main();

/**
 * Writes the collections **as the running site shows them** into a file: the
 * records of `data/collections.json` with the drafts published on /curate, the
 * publish switches and the order laid over them — the same three layers
 * `liveRecords` applies (5.10g, 5.10h).
 *
 *   set -a; source .env.local; set +a; npx tsx scripts/live-collections.ts <out.json>
 *
 * Why it exists: Julian publishes and edits collections online, without a
 * deploy, so for several collections the file is **not** what the site shows.
 * Measured 2026-10-06 against the three collections the cover game was about
 * to take: one Nebula cover and four of the Deutscher Buchpreis had been
 * swapped online and one Ravensburger cover taken out, and
 * `data/collections.json` knew none of it. A tool that must see those edits
 * points `COLLECTIONS_FILE` at the file this writes;
 * `scripts/add-collection-covers-to-pool.ts` is the one that needs it.
 *
 * **It asks production once** (`GET /api/curate/publish`, the admin password
 * as a bearer token, like the Cockpit) because the store lives there and the
 * main folder's `.env.local` holds no `STORAGE_*`. Never in a loop (2.4).
 * It writes nothing anywhere but the file named on the command line, and that
 * file belongs in a scratch folder: it is the reading of one moment, and a
 * second, ageing copy of the collections has no place in the repository.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyContent,
  applyOrder,
  applyOverrides,
  collectionRecords,
  type ContentOverrides,
  type PublishOverrides,
} from '../lib/collections';

const LIVE = process.env.SUGGEST_REMOTE ?? 'https://buyitscovers.com';

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error('needs a path to write to: npx tsx scripts/live-collections.ts <out.json>');
  if (resolve(out).endsWith('/data/collections.json')) throw new Error('refusing to write the collections file itself: this is a snapshot, not the source.');
  const password = process.env.SUGGEST_ADMIN_PASSWORD;
  if (!password) throw new Error('SUGGEST_ADMIN_PASSWORD is not set: source the main folder\'s .env.local for this command.');

  const res = await fetch(`${LIVE}/api/curate/publish`, {
    headers: { authorization: `Bearer ${password}`, 'user-agent': 'beautifulbooks/live-collections' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${LIVE} answered ${res.status} — the snapshot would be the file, not the live state.`);
  const { switches, content, order } = (await res.json()) as { switches: PublishOverrides; content: ContentOverrides; order: string[] };

  const records = applyOrder(applyOverrides(applyContent(collectionRecords(), content), switches), order);
  writeFileSync(out, `${JSON.stringify({ collections: records }, null, 1)}\n`);
  const published = records.filter(r => r.published).length;
  const changed = Object.keys(content).length;
  console.log(`${records.length} collections, ${published} published (${changed} with content from an online draft), ${records.reduce((n, r) => n + r.works.length, 0)} works -> ${out}`);
}

main();

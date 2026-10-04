/**
 * Brings a collection's online draft in /curate up to the file (Julian,
 * 2026-09-26: „when you edit a collection like this, i want the newest
 * version to show up in the online drafts, so i can go on from there").
 *
 *   set -a; source ../../../.env.local; set +a   # admin password, never printed
 *   npx tsx lab/collections/push-draft.ts <slug> [--publish]
 *
 * Finds the newest online draft with that address (or creates one from the
 * file), then sends the draft's own steps — title and intro, removals, covers
 * and additions, the order — so the draft equals the file. `--publish` then
 * publishes the draft, as the admin button on /curate does.
 *
 * Before it writes, it reports what the online draft has that the file lacks:
 * a change Julian made online must be taken into the file first, not
 * overwritten (5.10b). Without `--force` it stops when there is any.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionRecord } from '../../lib/collections';
import { DRAFT_LIMITS } from '../../lib/curate/drafts';
import { draftDelta, type DraftLike } from './draftdelta';

const ROOT = join(import.meta.dirname, '..', '..');
const REMOTE = (process.env.SUGGEST_REMOTE ?? 'https://buyitscovers.com').replace(/\/$/, '');
const TOKEN = process.env.SUGGEST_ADMIN_PASSWORD;

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${REMOTE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'user-agent': 'beautifulbooks-lab' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`${res.status} from ${path}: ${data.error ?? ''}`);
  return data;
}

async function main() {
  const [slug, ...flags] = process.argv.slice(2);
  if (!slug) throw new Error('usage: push-draft.ts <slug> [--publish] [--force]');
  if (!TOKEN) throw new Error('SUGGEST_ADMIN_PASSWORD is not set (source the main folder .env.local)');
  const file = (JSON.parse(readFileSync(join(ROOT, 'data', 'collections.json'), 'utf8')) as { collections: CollectionRecord[] }).collections;
  const record = file.find(c => c.slug === slug);
  if (!record) throw new Error(`${slug} is not in data/collections.json`);

  const { drafts } = await call<{ drafts: Array<DraftLike & { id: string; slug: string; updatedAt: string; deleted?: boolean }> }>('/api/curate/drafts');
  let draft = drafts.filter(d => d.slug === slug && !d.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!draft) {
    try {
      draft = (await call<{ draft: typeof drafts[number] }>('/api/curate/drafts', { from: slug })).draft;
      console.log(`${slug}: new online draft ${draft.id} from the deployed file`);
    } catch {
      /*
        A collection that is only in the local file (not deployed yet) cannot
        be copied by the site: start an empty draft of the same kind and give it
        its boundary — publishers or authors — before the works follow below.
      */
      draft = (await call<{ draft: typeof drafts[number] }>('/api/curate/drafts', { title: record.title, kind: record.kind })).draft;
      for (const name of (record.publishers ?? []).slice(0, DRAFT_LIMITS.publishers)) draft = (await call<{ draft: typeof draft }>(`/api/curate/drafts/${draft.id}`, { op: 'addPublisher', name })).draft;
      for (const a of record.authors ?? []) draft = (await call<{ draft: typeof draft }>(`/api/curate/drafts/${draft.id}`, { op: 'addAuthor', name: a.name, key: a.keys[0] ?? '' })).draft;
      console.log(`${slug}: new empty online draft ${draft.id} (not yet in the deployed file)`);
      // The site derives an empty draft's address from its title; a title that slugs differently cannot be found again by this tool.
      if (draft.slug !== slug) console.warn(`${slug}: the online draft got the address "${draft.slug}" from its title — publish only after the file is deployed, or rename so both match`);
    }
  }

  // The boundary first: publishers or authors the file has and the draft lacks (a run cut short by a 429 can leave them out).
  const d = draft as typeof draft & { publishers?: string[]; authors?: Array<{ name: string }> };
  // A draft holds at most DRAFT_LIMITS.publishers spellings; the rest stay in the file only.
  for (const name of (record.publishers ?? []).filter(n => !(d.publishers ?? []).includes(n)).slice(0, Math.max(0, DRAFT_LIMITS.publishers - (d.publishers ?? []).length))) draft = (await call<{ draft: typeof draft }>(`/api/curate/drafts/${draft.id}`, { op: 'addPublisher', name })).draft;
  for (const a of (record.authors ?? []).filter(a => !(d.authors ?? []).some(x => x.name === a.name))) draft = (await call<{ draft: typeof draft }>(`/api/curate/drafts/${draft.id}`, { op: 'addAuthor', name: a.name, key: a.keys[0] ?? '' })).draft;

  const delta = draftDelta(draft, record);
  if (delta.onlineOnly.length > 0) {
    console.log(`${slug}: the online draft ${draft.id} has what the file lacks:\n  ${delta.onlineOnly.join('\n  ')}`);
    if (!flags.includes('--force')) throw new Error('Take those into the file first, or pass --force to overwrite them.');
  }
  // One request for all steps (`op: batch`, since 2026-09-26), so a long collection no longer meets the rate limit.
  if (delta.ops.length > 0) draft = (await call<{ draft: typeof draft }>(`/api/curate/drafts/${draft.id}`, { op: 'batch', ops: delta.ops })).draft;
  // Marks the draft as Claude's, level with the file now; /curate shows it, and any later hand edit.
  await call(`/api/curate/drafts/${draft.id}`, { op: 'pushed' });
  console.log(`${slug}: ${delta.ops.length} step(s) sent to draft ${draft.id} — ${delta.summary}`);
  if (flags.includes('--publish')) {
    await call(`/api/curate/drafts/${draft.id}`, { op: 'publish' });
    console.log(`${slug}: draft ${draft.id} published`);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

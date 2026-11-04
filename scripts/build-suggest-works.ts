/**
 * The list behind the suggestions while typing (ROADMAP 6.69): the published
 * works (`data/index-works.json`, 500 on 2026-10-19) with title, author and one
 * cover, small enough to ship to the browser — `data/cover-index.json` itself
 * is server only (CLAUDE.md). The cover is Julian's pick for a curated work,
 * otherwise the work's first cover in the index.
 *
 *   npx tsx scripts/build-suggest-works.ts
 *
 * Writes `data/suggest-works.json` as rows `[id, title, author, coverId]`.
 * Never edited by hand (a hook refuses it, 6.39); rebuild after the index or
 * the curated picks change.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PUBLISHED_WORKS } from '../lib/published';
import { CURATED_LIST } from '../lib/curated';

const root = process.cwd();
const index = JSON.parse(readFileSync(path.join(root, 'data', 'cover-index.json'), 'utf8')) as {
  works: Array<[string, string, string]>;
  covers: Array<[number, string, ...unknown[]]>;
};

const firstCover = new Map<string, string>();
for (const [workIndex, coverId] of index.covers) {
  const work = index.works[workIndex];
  if (work && !firstCover.has(work[0])) firstCover.set(work[0], coverId);
}
// The curated list carries Open Library's number; the index and the image route speak `ol:<n>`.
const picked = new Map(CURATED_LIST.map(w => [w.id, `ol:${w.coverId}`]));

const rows: Array<[string, string, string, string]> = [];
let without = 0;
for (const w of PUBLISHED_WORKS) {
  const cover = picked.get(w.id) ?? firstCover.get(w.id);
  if (!cover) { without += 1; continue; }
  rows.push([w.id, w.title, w.author, cover]);
}

const out = path.join(root, 'data', 'suggest-works.json');
writeFileSync(out, JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), works: rows }) + '\n');
const bytes = readFileSync(out).length;
console.log(`suggest-works: ${rows.length} works (${without} without a cover left out), ${Math.round(bytes / 1024)} KB → ${path.relative(root, out)}`);

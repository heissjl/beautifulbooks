/**
 * Writes data/hero-rings.json: a ring of seven covers for every curated work
 * the cover index can fill (ROADMAP 1.9; the rules are in lib/heroring.ts).
 *
 * Run it after the index or the curated list changes, and commit the result.
 * A test fails when the committed file no longer matches what the rules give
 * for the committed index and list, so a stale file is caught before the
 * home page shows a ring that breaks them. The file carries no timestamp for
 * the same reason: it must compare equal.
 *
 * Usage: npx tsx scripts/build-hero-rings.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CURATED_LIST } from '../lib/curated';
import { ringsFor, RING_MIN_BITS, RING_MIN_COLOUR, RING_SIZE, type CoverIndexFile } from '../lib/heroring';

const data = path.join(process.cwd(), 'data');
const index = JSON.parse(readFileSync(path.join(data, 'cover-index.json'), 'utf8')) as CoverIndexFile;
const rings = ringsFor(index, CURATED_LIST);

const file = { rules: { size: RING_SIZE, minBits: RING_MIN_BITS, minColour: RING_MIN_COLOUR }, rings };
writeFileSync(path.join(data, 'hero-rings.json'), JSON.stringify(file, null, 1) + '\n');
console.log(`${rings.length} of ${CURATED_LIST.length} curated works have a ring of ${RING_SIZE}`);

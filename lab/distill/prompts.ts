/**
 * CLIP's text vectors for the "not a cover" prompts (lab/clip, set v2), written
 * for train.py: the student speaks CLIP's space, so the same prompts classify
 * its vectors without a head of their own.
 *
 *   npx tsx lab/distill/prompts.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { embedTexts } from '../clip/clip';
import { PROMPT_SETS } from '../clip/notcover';

async function main() {
  const set = PROMPT_SETS.v2;
  const cover = await embedTexts(set.cover);
  const other = await embedTexts(set.other);
  const file = join(__dirname, 'out', 'prompts.json');
  writeFileSync(file, JSON.stringify({ cover: cover.map((v) => [...v]), other: other.map((v) => [...v]) }));
  console.log(`written: ${file}`);
}

main();

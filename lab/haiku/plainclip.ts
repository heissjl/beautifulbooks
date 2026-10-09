/**
 * ROADMAP 6.101a: rank the index's covers by how much they look like a plain title page or a bare board, with
 * CLIP zero-shot over the vectors lab/clip already computed (no image is fetched here). A ranking for a human to
 * look at, never a deletion rule (lab/clip, question A; CLAUDE.md "never delete a cover for looking blank").
 * Writes lab/haiku/out/plainclip.json (score per cover) and plainclip.html (a sheet per score band).
 *
 *   npx tsx lab/haiku/plainclip.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverUrlFor } from '../../lib/coverindex';
import { embedTexts, MODEL, OUT } from '../clip/clip';
import { fromBase64, notCoverProbability } from '../clip/score';
import { pick } from './plain';

export const PLAIN = [
  'the title page inside an old book, printed text on cream paper',
  'a plain typographic book cover with only the title and author in small print',
  'a plain cloth-bound hardcover board of one colour',
  'a scanned page of printed text',
];
export const DESIGNED = [
  'an illustrated book cover',
  'a book cover with a photograph',
  'a book cover with bold graphic design',
  'a painting on a book jacket',
  'a book cover with large bold title lettering',
];

async function main(): Promise<void> {
  const { works, covers } = JSON.parse(readFileSync('data/cover-index.json', 'utf8')) as {
    works: Array<[string, string, string]>; covers: Array<[number, string, string, number, number, number, string]>;
  };
  const file = join(OUT, `vectors-${MODEL.replace(/\W+/g, '_')}.json`);
  if (!existsSync(file)) throw new Error(`no CLIP vectors at ${file}`);
  const cache = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string | null>;
  const plain = await embedTexts(PLAIN);
  const designed = await embedTexts(DESIGNED);

  const scored = covers
    .filter((c) => typeof cache[c[1]] === 'string')
    .map((c) => ({ c, p: notCoverProbability(fromBase64(cache[c[1]]!), designed, plain) }));
  writeFileSync('lab/haiku/out/plainclip.json', JSON.stringify(Object.fromEntries(scored.map((s) => [s.c[1], Math.round(s.p * 1000) / 1000]))));

  const bands: Array<[number, number]> = [[0.9, 1.01], [0.8, 0.9], [0.7, 0.8], [0.6, 0.7], [0.5, 0.6], [0.4, 0.5], [0, 0.4]];
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
  const sections = bands.map(([lo, hi]) => {
    const inBand = scored.filter((s) => s.p >= lo && s.p < hi);
    const tiles = pick(inBand, 40).map(({ c, p }) =>
      `<figure><img loading="lazy" src="${coverUrlFor(c[1], 'M')}" alt=""><figcaption>${esc(works[c[0]][1])} <b>${p.toFixed(2)}</b> c${c[3]}</figcaption></figure>`).join('');
    return `<h2>plain ${lo}–${Math.min(hi, 1)} — ${inBand.length} covers</h2><div class="grid">${tiles}</div>`;
  }).join('\n');
  writeFileSync('lab/haiku/out/plainclip.html', `<!doctype html><meta charset="utf-8"><title>plain by CLIP</title>
<style>body{font:13px system-ui;margin:16px;background:#faf8f4;color:#222}.grid{display:flex;flex-wrap:wrap;gap:8px}
figure{margin:0;width:100px}img{width:100px;height:150px;object-fit:cover;background:#ddd}figcaption{font-size:10px}</style>
<h1>"Plain" by CLIP zero-shot (ROADMAP 6.101a)</h1><p>${scored.length} of ${covers.length} index covers have a CLIP vector. 40 random per band; c = dHash contrast.</p>${sections}`);
  console.log(scored.length, 'scored;', bands.map(([lo, hi]) => `${lo}: ${scored.filter((s) => s.p >= lo && s.p < hi).length}`).join(', '));
}

main();

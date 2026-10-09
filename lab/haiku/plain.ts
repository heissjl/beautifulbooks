/**
 * ROADMAP 6.101a: which covers in the index are plain title pages? A contact sheet per contrast band, 60 random
 * covers each (fixed seed), so the line is drawn by looking (rule from 6.10), not by a number alone.
 * Nothing is removed here. Writes lab/haiku/out/plain.html.
 *
 *   npx tsx lab/haiku/plain.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { coverUrlFor } from '../../lib/coverindex';

export const BANDS: Array<[label: string, lo: number, hi: number]> = [
  ['contrast ≤ 8', 0, 8], ['9–12', 9, 12], ['13–15', 13, 15], ['16–20', 16, 20], ['21–30', 21, 30],
];

/** Deterministic shuffle (mulberry32), so a second look sees the same covers. */
export function pick<T>(items: readonly T[], n: number, seed = 6101): T[] {
  let a = seed;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy.slice(0, n);
}

if (process.argv[1]?.endsWith('plain.ts')) {
  const { works, covers } = JSON.parse(readFileSync('data/cover-index.json', 'utf8')) as {
    works: Array<[string, string, string]>; covers: Array<[number, string, string, number, number, number, string]>;
  };
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const sections = BANDS.map(([label, lo, hi]) => {
    const inBand = covers.filter((c) => c[3] >= lo && c[3] <= hi);
    const tiles = pick(inBand, 60).map((c) =>
      `<figure><img loading="lazy" src="${coverUrlFor(c[1], 'M')}" alt=""><figcaption>${esc(works[c[0]][1])} <b>${c[3]}</b></figcaption></figure>`).join('');
    return `<h2>${label} — ${inBand.length} covers (${(100 * inBand.length / covers.length).toFixed(1)} %)</h2><div class="grid">${tiles}</div>`;
  }).join('\n');
  writeFileSync('lab/haiku/out/plain.html', `<!doctype html><meta charset="utf-8"><title>plain covers</title>
<style>body{font:13px system-ui;margin:16px;background:#faf8f4;color:#222}.grid{display:flex;flex-wrap:wrap;gap:8px}
figure{margin:0;width:100px}img{width:100px;height:150px;object-fit:cover;background:#ddd}figcaption{font-size:10px}</style>
<h1>Plain covers in the index, by contrast (ROADMAP 6.101a)</h1>
<p>${covers.length} covers. 60 random per band. Where does "plain title page" end and "a design" begin?</p>${sections}`);
  console.log('written lab/haiku/out/plain.html');
}

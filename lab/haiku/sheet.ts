/**
 * ROADMAP 6.101, step 3: the contact sheet. Per cover: its haikus, the five nearest covers by haiku embedding
 * (within the 200 of the sample) and the five from "looks like this" (6.10, over the whole index).
 * Writes lab/haiku/out/sheet.html; open it in a browser — images load from covers.openlibrary.org.
 *
 *   npx tsx lab/haiku/sheet.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { cosine, nearest } from './rank';

interface Cover { coverId: string; title: string; author: string; url: string; text: string | null; similar: Array<{ title: string; url: string }> }
const sample = JSON.parse(readFileSync('lab/haiku/out/sample.json', 'utf8')) as { model: string; usd: number; covers: Cover[] };
const { model: embedModel, vectors } = JSON.parse(readFileSync('lab/haiku/out/vectors.json', 'utf8')) as { model: string; vectors: (number[] | null)[] };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const tile = (url: string, title: string, note = '') =>
  `<figure><img loading="lazy" src="${url}" alt=""><figcaption>${esc(title)}${note ? ` <b>${note}</b>` : ''}</figcaption></figure>`;

const usable = sample.covers.map((c, i) => ({ c, v: vectors[i] })).filter((x): x is { c: Cover; v: number[] } => x.v !== null);
const vs = usable.map((x) => x.v);
const withSimilar = usable.filter((x) => x.c.similar.length > 0).length;

const pairs: Array<{ i: number; j: number; score: number }> = [];
for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) pairs.push({ i, j, score: cosine(vs[i], vs[j]) });
pairs.sort((a, b) => b.score - a.score);
const top = pairs.slice(0, 20).map((p) => `<div class="pair">${tile(usable[p.i].c.url, usable[p.i].c.title)}${tile(usable[p.j].c.url, usable[p.j].c.title, p.score.toFixed(2))}</div>`).join('');

const rows = usable.map(({ c }, i) => {
  const text = nearest(vs, i, 5).map((n) => tile(usable[n.index].c.url, usable[n.index].c.title, n.score.toFixed(2))).join('');
  const look = c.similar.map((s) => tile(s.url, s.title)).join('') || '<p class="none">no neighbour</p>';
  return `<section id="c${i}"><div class="q">${tile(c.url, `${c.title} — ${c.author}`)}<pre>${esc(c.text ?? '')}</pre></div>
<div><h3>haiku embedding</h3><div class="row">${text}</div><h3>looks like this (6.10)</h3><div class="row">${look}</div></div></section>`;
}).join('\n');

writeFileSync('lab/haiku/out/sheet.html', `<!doctype html><meta charset="utf-8"><title>haiku contact sheet</title>
<style>body{font:13px system-ui;margin:16px;background:#faf8f4;color:#222}section{display:grid;grid-template-columns:260px 1fr;gap:16px;border-top:1px solid #ccc;padding:12px 0}
.row{display:flex;gap:8px}figure{margin:0;width:110px}img{width:110px;height:165px;object-fit:cover;background:#ddd}figcaption{font-size:11px}
.q img{width:150px;height:225px}pre{white-space:pre-wrap;font:12px Georgia;margin:6px 0}h3{margin:4px 0;font-size:12px;color:#666}.none{color:#999}.pairs{display:flex;flex-wrap:wrap;gap:20px}.pair{display:flex;gap:4px}</style>
<h1>Haiku contact sheet (ROADMAP 6.101)</h1>
<p>${usable.length} covers, one per work, described by ${sample.model} (USD ${sample.usd.toFixed(3)} for this run), embedded with ${embedModel}.
Haiku neighbours come from the ${usable.length} of the sample only; 6.10 searches all covers in the index — ${withSimilar} of ${usable.length} have any 6.10 neighbour.</p>
<h2>The 20 closest pairs by haiku</h2><div class="pairs">${top}</div>\n${rows}`);
console.log('written', usable.length, 'rows;', withSimilar, 'with a 6.10 neighbour');

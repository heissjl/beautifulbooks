/**
 * Report on the Discogs dump measurement (ROADMAP 5.16), from the files
 * `dump-measure.ts` wrote to `out/` — no network.
 *
 *   npx tsx lab/vinyl/dump-report.ts
 *
 * Prints per album: vinyl releases, with a format text, with a colour of the
 * record (`vinylColour`), picture disc / shaped / etched, with a barcode, and
 * the commonest colours; then 60 texts the reader called a colour and 40 it
 * did not, drawn from the random sample, to be checked by eye.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { specialVinyl, vinylColour, type DumpRelease } from './dump';

const OUT = join(import.meta.dirname, 'out');
const MASTERS = new Map([
  [38722, 'Rumours'], [10362, 'The Dark Side of the Moon'], [5460, 'Kind of Blue'], [2994, 'Autobahn'],
  [13814, 'Nevermind'], [21491, 'OK Computer'], [556257, 'Random Access Memories'], [1777815, 'folklore'],
]);
const albums = JSON.parse(readFileSync(join(OUT, 'dump-albums.json'), 'utf8')) as DumpRelease[];
const sample = JSON.parse(readFileSync(join(OUT, 'dump-sample.json'), 'utf8')) as Array<{ id: number; year: string; text: string; colour: string | null }>;

console.log('| Album | Vinyl | mit Formattext | Farbe der Platte | seit 2015: Vinyl / Farbe | Picture Disc, Shape, Etched | mit Barcode | häufigste Farben |');
console.log('|---|---:|---:|---:|---:|---:|---:|---|');
for (const [master, title] of MASTERS) {
  const vinyl = albums.filter(r => r.masterId === master && r.formats.some(f => f.name === 'Vinyl'));
  const colourOf = (r: DumpRelease) => r.formats.filter(f => f.name === 'Vinyl').map(f => vinylColour(f.text)).find(Boolean) ?? null;
  const coloured = vinyl.filter(colourOf);
  const recent = vinyl.filter(r => r.released.slice(0, 4) >= '2015');
  const words = new Map<string, number>();
  for (const r of coloured) {
    const w = colourOf(r)!.toLowerCase().match(/[a-z]+(?: bottle)?/g)?.find(x => !/^(and|with|in|vinyl|lp|edition|limited|colou?red)$/.test(x)) ?? '?';
    words.set(w, (words.get(w) ?? 0) + 1);
  }
  const top = [...words].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w, n]) => `${w} ${n}`).join(', ') || '—';
  console.log(`| ${title} | ${vinyl.length} | ${vinyl.filter(r => r.formats.some(f => f.name === 'Vinyl' && f.text)).length} | ${coloured.length} | ${recent.length} / ${recent.filter(colourOf).length} | ${vinyl.filter(r => r.formats.some(f => specialVinyl(f).length)).length} | ${vinyl.filter(r => r.barcodes.length).length} | ${top} |`);
}

// Reservoir order is already random; take the first of each kind.
console.log('\nAls Farbe gelesen (60):');
for (const s of sample.filter(s => s.colour).slice(0, 60)) console.log(`  ${s.year || '----'}  ${JSON.stringify(s.text)}  →  ${s.colour}`);
console.log('\nText, aber keine Farbe gelesen (40):');
for (const s of sample.filter(s => !s.colour).slice(0, 40)) console.log(`  ${s.year || '----'}  ${JSON.stringify(s.text)}`);

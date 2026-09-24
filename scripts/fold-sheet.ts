/**
 * A page of cover pairs to look at (ROADMAP 6.10's rule, used for 6.36).
 *
 *   npx tsx scripts/measure-publisher-fold.ts 30 > /tmp/pairs.json
 *   npx tsx scripts/fold-sheet.ts /tmp/pairs.json /tmp/pairs.html
 *
 * Thresholds in this repository are set by looking, not by arithmetic: the
 * numbers overlap, so a page that shows both images beside their distance and
 * their colour distance is the measuring instrument. Nothing is written into
 * the repository — the file goes wherever the second argument points.
 */
import { writeFileSync, readFileSync } from 'node:fs';

interface Side {
  id: string;
  url: string;
  publishers: string[];
  years: number[];
  languages: string[];
}

interface Pair {
  workId: string;
  title: string;
  distance: number;
  colour: number | null;
  a: Side;
  b: Side;
}

const escape = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
const who = (s: Side) => escape([s.publishers.join(', ') || 'no publisher', s.years.join('/') || 'no year', s.languages.join('/') || 'no language'].join(' · '));

function main() {
  const [input, output = '/tmp/pairs.html', base = ''] = process.argv.slice(2);
  // Through the site's own image route when a running server is given: it
  // proxies and caches, where covers.openlibrary.org answers a redirect that
  // a sheet of sixty images runs into all at once.
  const src = (s: Side) => (base ? `${base}/img/M/${s.id.replace(':', '-')}` : s.url);
  const data = JSON.parse(readFileSync(input, 'utf8')) as { pairs: Pair[] };
  const rows = data.pairs.map((p, i) => `
    <figure class="pair" id="p${i}">
      <figcaption>
        <b>${i + 1}. ${escape(p.title)}</b> · distance <b>${p.distance}</b> · colour
        <b>${p.colour === null ? 'unknown' : p.colour.toFixed(3)}</b>
      </figcaption>
      <div class="two">
        <div><img src="${escape(src(p.a))}" alt=""><p>${who(p.a)}</p></div>
        <div><img src="${escape(src(p.b))}" alt=""><p>${who(p.b)}</p></div>
      </div>
    </figure>`).join('\n');

  writeFileSync(output, `<!doctype html><meta charset="utf-8"><title>Cover pairs across publishers</title>
<style>
 body { font: 12px/1.3 system-ui, sans-serif; background: #f6f4ef; color: #221f1c; margin: 16px; }
 h1 { font-size: 15px; margin: 0 0 12px; }
 main { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 20px; }
 .pair { margin: 0; padding-bottom: 8px; border-bottom: 1px solid #ddd8cf; }
 .two { display: flex; gap: 8px; }
 .two > div { width: 140px; }
 img { width: 140px; height: 210px; object-fit: contain; background: #fff; border: 1px solid #e3ded4; }
 figcaption { margin-bottom: 5px; }
 p { color: #6b645c; margin: 4px 0 0; font-size: 11px; }
</style>
<h1>${data.pairs.length} pairs across publishers</h1>
<main>${rows}</main>
`);
  process.stdout.write(`${data.pairs.length} pairs written to ${output}\n`);
}

main();

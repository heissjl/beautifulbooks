/** Which curated covers the publisher's image confirms (5.5b): the clip may only "order" one of those. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './cdp';

const BASE = process.env.BASE ?? 'http://localhost:3107';
const want = process.argv.slice(2);
const works = (JSON.parse(readFileSync(join(__dirname, '../../../data/curated.json'), 'utf8')) as { works: { id: string; title: string; coverId: string }[] }).works
  .filter(w => want.includes(w.title));
async function main(): Promise<void> {
const page = await launch();
await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
for (const w of works) {
  await page.send('Page.navigate', { url: `${BASE}/book/${w.id}?cover=${encodeURIComponent(w.coverId)}` });
  /*
    `verified` shows no sentence, and neither do `unknown` and the states
    where Google was not asked, so the page alone cannot tell them apart. The
    answer that decides is the ISBN lookup itself: a publisher image on record
    (covers not empty, source googlebooks), no sentence about a different
    cover, and a new-books shop leading the row (6.100).
  */
  await new Promise(r => setTimeout(r, 20000));
  const text = await page.evaluate<string>('document.body.innerText');
  const printing = (text.match(/\n([^\n]+, \d{4} \([^)]+\))\n/) || ['', '?'])[1];
  const isbn = (text.match(/ISBN (97[89][-0-9]{10,})/) || ['', ''])[1].replace(/-/g, '');
  const lead = (text.split('DE\n')[1] ?? '').split('\n')[0];
  const sentence = (text.match(/(The publisher.s[^.]*\.|No current publisher image[^.]*\.)/) || [''])[0];
  const answer = isbn ? ((await (await fetch(`${BASE}/api/isbn/${isbn}?signatures=1`)).json()) as { covers: unknown[]; source?: string }) : null;
  const confirmed = !!answer && answer.covers.length > 0 && answer.source === 'googlebooks' && !sentence && lead.startsWith('Bookshop');
  const verdict = `${printing} | ISBN ${isbn || '-'} | publisher images ${answer?.covers.length ?? '-'} | first: ${lead} | ${sentence}${confirmed ? ' | CONFIRMED' : ''}`;
  console.log(`${w.title} | ${w.id} | ${w.coverId} | ${verdict}`);
}
await page.close();
}

void main();

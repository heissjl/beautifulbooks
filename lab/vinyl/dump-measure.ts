/**
 * What does the Discogs dump say about pressings and the colour of the record?
 * (ROADMAP 5.16; Julian, 2026-09-29: „lade den discogs dump herunter und mach
 * die messung".)
 *
 *   caffeinate -i npx tsx lab/vinyl/dump-measure.ts [url-or-file]
 *
 * Streams `discogs_20260901_releases.xml.gz` (10.5 GB, CC0) straight from
 * data.discogs.com through gunzip and never stores it: the machine had 15 GB
 * free on the day. Per release it reads only the formats and the master id;
 * the releases of the eight measured albums are parsed whole. Writes to
 * `out/` (git-ignored):
 *   dump-albums.json   every release of the eight masters, parsed
 *   dump-summary.json  counts over all releases with a vinyl format
 *   dump-sample.json   2,000 vinyl format texts drawn at random (reservoir), to check the colour reader by eye
 */
import { mkdirSync, writeFileSync, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';
import { parseDumpRelease, specialVinyl, vinylColour, type DumpFormat, type DumpRelease } from './dump';

const SOURCE = process.argv[2] ?? 'https://data.discogs.com/?download=data%2F2026%2Fdiscogs_20260901_releases.xml.gz';
const OUT = join(import.meta.dirname, 'out');
const MASTERS = new Map([
  [38722, 'Rumours'], [10362, 'The Dark Side of the Moon'], [5460, 'Kind of Blue'], [2994, 'Autobahn'],
  [13814, 'Nevermind'], [21491, 'OK Computer'], [556257, 'Random Access Memories'], [1777815, 'folklore'],
]);
const SAMPLE_SIZE = 2000;

const summary = {
  source: SOURCE, started: new Date().toISOString(), finished: '',
  releases: 0, vinyl: 0, vinylWithText: 0, vinylWithColour: 0, vinylSpecial: 0,
  images: { absent: 0, empty: 0, some: 0 },
  byDecade: {} as Record<string, { vinyl: number; colour: number }>,
  specialKinds: {} as Record<string, number>,
};
const albums: DumpRelease[] = [];
const sample: Array<{ id: number; year: string; text: string; colour: string | null }> = [];
let seenForSample = 0;

function formatsOnly(xml: string): DumpFormat[] {
  const block = xml.match(/<formats>([\s\S]*?)<\/formats>/)?.[1];
  return block ? parseDumpRelease(`<release id="1"><formats>${block}</formats></release>`)!.formats : [];
}

function handle(xml: string) {
  summary.releases++;
  const master = Number(xml.match(/<master_id[^>]*>(\d+)<\/master_id>/)?.[1] ?? 0);
  if (MASTERS.has(master)) { const r = parseDumpRelease(xml); if (r) albums.push(r); }
  if (!xml.includes('name="Vinyl"')) return;
  const vinyl = formatsOnly(xml).filter(f => f.name === 'Vinyl');
  if (!vinyl.length) return;
  summary.vinyl++;
  const year = xml.match(/<released>(\d{4})/)?.[1] ?? '';
  const decade = year ? `${year.slice(0, 3)}0s` : 'unknown';
  const d = (summary.byDecade[decade] ??= { vinyl: 0, colour: 0 });
  d.vinyl++;
  const texts = vinyl.map(f => f.text).filter(Boolean);
  if (texts.length) summary.vinylWithText++;
  const colour = texts.map(vinylColour).find(Boolean) ?? null;
  if (colour) { summary.vinylWithColour++; d.colour++; }
  const special = vinyl.flatMap(specialVinyl);
  if (special.length) summary.vinylSpecial++;
  for (const s of special) summary.specialKinds[s] = (summary.specialKinds[s] ?? 0) + 1;
  if (!/<images/.test(xml)) summary.images.absent++;
  else if (/<images\s*\/>|<images><\/images>/.test(xml)) summary.images.empty++;
  else summary.images.some++;
  if (texts.length) {
    seenForSample++;
    const entry = { id: Number(xml.match(/<release id="(\d+)"/)?.[1]), year, text: texts.join(' | '), colour };
    if (sample.length < SAMPLE_SIZE) sample.push(entry);
    else { const j = Math.floor(Math.random() * seenForSample); if (j < SAMPLE_SIZE) sample[j] = entry; }
  }
}

/**
 * Progress goes to `*.partial.json`; the result files are replaced only after a
 * complete pass. On 2026-09-29 data.discogs.com closed the connection at 7.1 GB,
 * and an earlier version of this script had overwritten the full results with
 * the partial ones.
 */
function save(final: boolean) {
  mkdirSync(OUT, { recursive: true });
  const suffix = final ? '' : '.partial';
  writeFileSync(join(OUT, `dump-summary${suffix}.json`), JSON.stringify(summary, null, 1));
  writeFileSync(join(OUT, `dump-albums${suffix}.json`), JSON.stringify(albums));
  writeFileSync(join(OUT, `dump-sample${suffix}.json`), JSON.stringify(sample, null, 1));
}

async function main() {
  let input: Readable;
  if (/^https?:/.test(SOURCE)) {
    const res = await fetch(SOURCE, { headers: { 'User-Agent': 'beautifulbooks-lab/0.1 ( https://beautifulcovers.vercel.app )' } });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    console.log(`download: ${res.headers.get('content-length') ?? '?'} bytes`);
    input = Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>);
  } else {
    input = createReadStream(SOURCE);
  }
  let rest = '';
  let bytes = 0;
  let nextReport = 0;
  input.on('data', (c: Buffer) => { bytes += c.length; });
  const text = input.pipe(createGunzip());
  text.setEncoding('utf8');
  for await (const chunk of text as AsyncIterable<string>) {
    rest += chunk;
    let end: number;
    while ((end = rest.indexOf('</release>')) !== -1) {
      const start = rest.indexOf('<release ');
      handle(rest.slice(start, end + '</release>'.length));
      rest = rest.slice(end + '</release>'.length);
    }
    if (summary.releases >= nextReport) {
      nextReport = summary.releases + 1_000_000;
      console.log(`${new Date().toISOString().slice(11, 19)}  ${summary.releases.toLocaleString('en')} releases, ${summary.vinyl.toLocaleString('en')} vinyl, ${albums.length} of the eight albums, ${(bytes / 1e6).toFixed(0)} MB read`);
      save(false);
    }
  }
  summary.finished = new Date().toISOString();
  save(true);
  console.log(`done: ${summary.releases.toLocaleString('en')} releases, ${summary.vinyl.toLocaleString('en')} vinyl, ${albums.length} releases of the eight albums`);
}

main().catch(e => { console.error(e); save(false); process.exit(1); });

/**
 * Would a cover wall for vinyl albums have enough pictures? (ROADMAP 5.16;
 * Julian, 2026-09-29: „exakt das gleiche aber für vinyl alben. zu bedenken:
 * vorder und rückseite und vielleicht farbe oder print auf vinylplatte selbst".)
 *
 *   npx tsx lab/vinyl/measure.ts
 *
 * For a handful of albums: find the release group (the Work) on MusicBrainz,
 * page through all its releases (the Editions) with their media, and count
 *  - releases, vinyl releases, vinyl releases with any artwork, with a front,
 *    with a back (from the `cover-art-archive` summary MusicBrainz ships);
 *  - for up to CAA_CAP vinyl releases with artwork, the Cover Art Archive
 *    image types — above all `Medium`, a picture of the record itself;
 *  - vinyl releases whose free text names a colour or a picture disc.
 *
 * MusicBrainz allows one request a second and answers 503 when busy; each
 * answer lands in `cache.json` (git-ignored) so a rerun asks only what is
 * missing. A failure is reported as a failure, never as "no image" (N12).
 * No Google Books (lab rule 6).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { countImageTypes, isVinyl, vinylColourNote, type CaaImage, type MbRelease } from './parse';

const CACHE_FILE = join(import.meta.dirname, 'cache.json');
const UA = 'beautifulbooks-lab/0.1 ( https://beautifulcovers.vercel.app )';
const MB = 'https://musicbrainz.org/ws/2';
const CAA_CAP = 40;

const ALBUMS: Array<[artist: string, title: string]> = [
  ['Fleetwood Mac', 'Rumours'],
  ['Pink Floyd', 'The Dark Side of the Moon'],
  ['Miles Davis', 'Kind of Blue'],
  ['Kraftwerk', 'Autobahn'],
  ['Nirvana', 'Nevermind'],
  ['Radiohead', 'OK Computer'],
  ['Daft Punk', 'Random Access Memories'],
  ['Taylor Swift', 'folklore'],
];

const cache: Record<string, unknown> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getJson<T>(url: string, pauseMs: number): Promise<T | { failed: string }> {
  if (url in cache) return cache[url] as T;
  let last = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(attempt === 0 ? pauseMs : 3000 * attempt);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) { cache[url] = { notFound: true }; return cache[url] as T; }
      if (!res.ok) { last = `HTTP ${res.status}`; continue; }
      const body = (await res.json()) as T;
      cache[url] = body;
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      return body;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  return { failed: last };
}
const failed = (x: unknown): x is { failed: string } => typeof x === 'object' && x !== null && 'failed' in x;

interface Row {
  album: string; releaseGroup: string; releases: number; vinyl: number; vinylArtwork: number;
  vinylFront: number; vinylBack: number; colourNotes: Record<string, number>;
  caaAsked: number; caaFailed: number; withMedium: number; imageTypes: Record<string, number>; errors: string[];
}

async function measure(artist: string, title: string): Promise<Row> {
  const row: Row = {
    album: `${artist} — ${title}`, releaseGroup: '', releases: 0, vinyl: 0, vinylArtwork: 0, vinylFront: 0, vinylBack: 0,
    colourNotes: {}, caaAsked: 0, caaFailed: 0, withMedium: 0, imageTypes: {}, errors: [],
  };
  const q = encodeURIComponent(`releasegroup:"${title}" AND artist:"${artist}" AND primarytype:album`);
  const search = await getJson<{ 'release-groups': Array<{ id: string; score: number; title: string }> }>(`${MB}/release-group/?query=${q}&fmt=json&limit=5`, 1100);
  if (failed(search)) { row.errors.push(`search: ${search.failed}`); return row; }
  const rg = search['release-groups'].find(g => g.title.toLowerCase() === title.toLowerCase()) ?? search['release-groups'][0];
  if (!rg) { row.errors.push('no release group'); return row; }
  row.releaseGroup = rg.id;

  const releases: MbRelease[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await getJson<{ releases: MbRelease[]; 'release-count': number }>(
      `${MB}/release?release-group=${rg.id}&inc=media&fmt=json&limit=100&offset=${offset}`, 1100);
    if (failed(page)) { row.errors.push(`releases @${offset}: ${page.failed}`); break; }
    releases.push(...page.releases);
    if (offset + 100 >= page['release-count']) break;
  }
  row.releases = releases.length;
  const vinyl = releases.filter(isVinyl);
  row.vinyl = vinyl.length;
  for (const r of vinyl) {
    const caa = r['cover-art-archive'];
    if (caa?.artwork) row.vinylArtwork++;
    if (caa?.front) row.vinylFront++;
    if (caa?.back) row.vinylBack++;
    const colour = vinylColourNote(r);
    if (colour) row.colourNotes[colour] = (row.colourNotes[colour] ?? 0) + 1;
  }

  // Oldest first, so the cap favours original pressings over the latest reissues.
  const withArt = vinyl.filter(r => r['cover-art-archive']?.artwork).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  for (const r of withArt.slice(0, CAA_CAP)) {
    row.caaAsked++;
    const art = await getJson<{ images: CaaImage[] }>(`https://coverartarchive.org/release/${r.id}`, 300);
    if (failed(art)) { row.caaFailed++; continue; }
    const types = countImageTypes(art.images ?? []);
    if (types.Medium) row.withMedium++;
    for (const [t, n] of Object.entries(types)) row.imageTypes[t] = (row.imageTypes[t] ?? 0) + n;
  }
  return row;
}

async function main() {
  const rows: Row[] = [];
  for (const [artist, title] of ALBUMS) {
    const row = await measure(artist, title);
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  const sum = (k: 'releases' | 'vinyl' | 'vinylArtwork' | 'vinylFront' | 'vinylBack' | 'caaAsked' | 'caaFailed' | 'withMedium') =>
    rows.reduce((s, r) => s + r[k], 0);
  console.log('\n| Album | Releases | Vinyl | mit Bild | Front | Back | CAA gefragt | mit Platte (Medium) | Farbe im Text |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) {
    const colours = Object.entries(r.colourNotes).map(([c, n]) => `${c} ${n}`).join(', ') || '—';
    console.log(`| ${r.album} | ${r.releases} | ${r.vinyl} | ${r.vinylArtwork} | ${r.vinylFront} | ${r.vinylBack} | ${r.caaAsked}${r.caaFailed ? ` (${r.caaFailed} fehlgeschlagen)` : ''} | ${r.withMedium} | ${colours} |`);
  }
  console.log(`| **Summe** | ${sum('releases')} | ${sum('vinyl')} | ${sum('vinylArtwork')} | ${sum('vinylFront')} | ${sum('vinylBack')} | ${sum('caaAsked')} | ${sum('withMedium')} | |`);
  const types: Record<string, number> = {};
  for (const r of rows) for (const [t, n] of Object.entries(r.imageTypes)) types[t] = (types[t] ?? 0) + n;
  console.log('\nBildtypen über alle gefragten Vinyl-Releases:', JSON.stringify(types));
}

main().catch(e => { console.error(e); process.exit(1); });

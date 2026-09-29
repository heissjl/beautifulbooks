/**
 * Join the Discogs dump to MusicBrainz (ROADMAP 5.16): which vinyl pressings
 * with a photo in the Cover Art Archive get the colour of their record from
 * Discogs, through the Discogs link MusicBrainz keeps per release?
 *
 *   npx tsx lab/vinyl/dump-link.ts        (after mockup.ts and dump-measure.ts)
 *
 * Asks MusicBrainz once per vinyl release for its URL relations (one request
 * a second, answers in cache.json) and reads `out/dump-albums.json`. Prints a
 * table per album and writes `out/dump-link.json`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vinylColour, type DumpRelease } from './dump';

const DIR = import.meta.dirname;
const CACHE_FILE = join(DIR, 'cache.json');
const UA = 'beautifulbooks-lab/0.1 ( https://beautifulcovers.vercel.app )';
const cache: Record<string, unknown> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function urlRels(mbid: string): Promise<string[] | null> {
  const url = `https://musicbrainz.org/ws/2/release/${mbid}?inc=url-rels&fmt=json`;
  if (url in cache) return (cache[url] as { relations?: Array<{ type: string; url: { resource: string } }> }).relations?.filter(r => r.type === 'discogs').map(r => r.url.resource) ?? [];
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(attempt === 0 ? 1100 : 3000 * attempt);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) continue;
      cache[url] = await res.json();
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      return urlRels(mbid);
    } catch { /* retried */ }
  }
  return null;
}

interface Pressing { id: string; year: string; front: string | null; colour: string | null }
interface Row { album: string; pressings: number; withFront: number; linked: number; failed: number; inDump: number; colour: number; frontColour: number }

async function main() {
  const html = readFileSync(join(DIR, 'out', 'mockup.html'), 'utf8');
  const albums = JSON.parse(html.match(/const DATA = (\[[\s\S]*?\]);\n/)![1]) as Array<{ title: string; pressings: Pressing[] }>;
  const dump = existsSync(join(DIR, 'out', 'dump-albums.json'))
    ? new Map((JSON.parse(readFileSync(join(DIR, 'out', 'dump-albums.json'), 'utf8')) as DumpRelease[]).map(r => [r.id, r]))
    : new Map<number, DumpRelease>();
  const rows: Row[] = [];
  const links: Record<string, { discogs: number[]; colour: string | null }> = {};
  for (const album of albums) {
    let linked = 0, failed = 0, inDump = 0, colour = 0, frontColour = 0;
    for (const p of album.pressings) {
      const rels = await urlRels(p.id);
      if (rels === null) { failed++; continue; }
      const ids = rels.map(u => Number(u.match(/release\/(\d+)/)?.[1])).filter(Boolean);
      if (!ids.length) continue;
      linked++;
      const found = ids.map(i => dump.get(i)).filter((r): r is DumpRelease => !!r);
      if (found.length) inDump++;
      const c = found.flatMap(r => r.formats.filter(f => f.name === 'Vinyl').map(f => vinylColour(f.text))).find(Boolean) ?? null;
      if (c) { colour++; if (p.front) frontColour++; }
      links[p.id] = { discogs: ids, colour: c };
    }
    rows.push({ album: album.title, pressings: album.pressings.length, withFront: album.pressings.filter(p => p.front).length, linked, failed, inDump, colour, frontColour });
  }
  console.log('| Album | Vinyl-Pressungen (MB) | mit Vorderseite | mit Discogs-Link | im Dump gefunden | Farbe laut Discogs | davon mit Vorderseite |');
  console.log('|---|---:|---:|---:|---:|---:|---:|');
  for (const r of rows) console.log(`| ${r.album} | ${r.pressings} | ${r.withFront} | ${r.linked}${r.failed ? ` (${r.failed} fehlgeschlagen)` : ''} | ${r.inDump} | ${r.colour} | ${r.frontColour} |`);
  const sum = (k: Exclude<keyof Row, 'album'>) => rows.reduce((s, r) => s + r[k], 0);
  console.log(`| **Summe** | ${sum('pressings')} | ${sum('withFront')} | ${sum('linked')} | ${sum('inDump')} | ${sum('colour')} | ${sum('frontColour')} |`);
  writeFileSync(join(DIR, 'out', 'dump-link.json'), JSON.stringify(links, null, 1));
}

main().catch(e => { console.error(e); process.exit(1); });

/**
 * How much more does Discogs know than MusicBrainz about the same albums, and
 * how often does it name the colour of the record? (ROADMAP 5.16.)
 *
 *   npx tsx lab/vinyl/discogs.ts      (after measure.ts, which finds the release groups)
 *
 * The Discogs master of each album comes from the release group's URL
 * relations on MusicBrainz, never from a guess. `/masters/<id>/versions` is
 * public without a token (25 requests a minute); it lists every version with
 * a format line of descriptions only ("LP, Album, Reissue", "Picture Disc")
 * and a 150 px thumb. The colour of the record is free text on the release
 * itself (`formats[].text`, "Red Translucent"), so for up to SAMPLE vinyl
 * versions per album, spread evenly over the years, `/releases/<id>` is
 * asked too. Answers share `cache.json` with measure.ts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vinylColourNote } from './parse';

const CACHE_FILE = join(import.meta.dirname, 'cache.json');
const UA = 'beautifulbooks-lab/0.1 ( https://beautifulcovers.vercel.app )';
const cache: Record<string, unknown> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getJson<T>(url: string, pauseMs: number): Promise<T | null> {
  if (url in cache) return cache[url] as T;
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(attempt === 0 ? pauseMs : 10_000 * attempt);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) continue;
      const body = (await res.json()) as T;
      cache[url] = body;
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      return body;
    } catch { /* retried */ }
  }
  return null;
}

const SAMPLE = 20;

interface Version { id: number; format?: string; major_formats?: string[]; released?: string; thumb?: string }
interface Release { formats?: Array<{ name: string; text?: string; descriptions?: string[] }> }

async function main() {
  const groups = Object.entries(cache)
    .filter(([k]) => k.includes('/ws/2/release-group/?query='))
    .map(([k, v]) => {
      const rg = (v as { 'release-groups': Array<{ id: string; title: string; 'artist-credit': Array<{ name: string }> }> })['release-groups'];
      const title = decodeURIComponent(k).match(/releasegroup:"([^"]+)"/)?.[1] ?? '';
      const hit = rg.find(g => g.title.toLowerCase() === title.toLowerCase()) ?? rg[0];
      return hit;
    });

  console.log('| Album | Versionen bei Discogs | davon Vinyl | mit Vorschaubild | Picture Disc | Stichprobe | Farbe im Freitext | Beispiele |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---|');
  for (const g of groups) {
    const rels = await getJson<{ relations: Array<{ type: string; url: { resource: string } }> }>(
      `https://musicbrainz.org/ws/2/release-group/${g.id}?inc=url-rels&fmt=json`, 1100);
    const master = rels?.relations.find(r => r.type === 'discogs')?.url.resource.match(/master\/(\d+)/)?.[1];
    const name = `${g['artist-credit'][0].name} — ${g.title}`;
    if (!master) { console.log(`| ${name} | kein Discogs-Master verknüpft | | | |`); continue; }
    const versions: Version[] = [];
    let total = 0;
    for (let page = 1; ; page++) {
      const res = await getJson<{ versions: Version[]; pagination: { pages: number; items: number } }>(
        `https://api.discogs.com/masters/${master}/versions?per_page=100&page=${page}`, 2600);
      if (!res) { console.log(`| ${name} | Seite ${page} fehlgeschlagen | | | |`); break; }
      versions.push(...res.versions);
      total = res.pagination.items;
      if (page >= res.pagination.pages) break;
    }
    const vinyl = versions.filter(v => (v.major_formats ?? []).includes('Vinyl') || /vinyl/i.test(v.format ?? ''));
    const pictureDiscs = vinyl.filter(v => /picture disc/i.test(v.format ?? '')).length;
    const thumbs = vinyl.filter(v => v.thumb).length;
    const byYear = [...vinyl].sort((a, b) => (a.released ?? '9999').localeCompare(b.released ?? '9999'));
    const step = Math.max(1, byYear.length / SAMPLE);
    const sample = Array.from({ length: Math.min(SAMPLE, byYear.length) }, (_, i) => byYear[Math.floor(i * step)]);
    let asked = 0;
    const texts: string[] = [];
    for (const v of sample) {
      const rel = await getJson<Release>(`https://api.discogs.com/releases/${v.id}`, 2600);
      if (!rel) continue;
      asked++;
      const text = (rel.formats ?? []).filter(f => f.name === 'Vinyl').map(f => f.text ?? '').filter(Boolean).join('; ');
      if (text && vinylColourNote({ id: '', title: '', disambiguation: text })) texts.push(text);
    }
    const examples = [...new Set(texts)].slice(0, 3).map(t => `„${t}“`).join(', ') || '—';
    console.log(`| ${name} | ${total} | ${vinyl.length} | ${thumbs} | ${pictureDiscs} | ${asked} | ${texts.length} | ${examples} |`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

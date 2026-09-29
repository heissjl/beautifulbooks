/**
 * Where would the story of each sleeve come from? (ROADMAP 5.16; Julian,
 * 2026-09-29: „aber woher bekommen wir die geschichte zu jeder hülle".)
 *
 *   npx tsx lab/vinyl/story.ts      (after mockup.ts, dump-measure.ts, dump-link.ts)
 *
 * Folds each album's fronts as the mock-up does (single linkage, dHash ≤ 20)
 * and gathers, per sleeve:
 *  - the timeline our own data gives: first and last year, countries, labels,
 *    number of pressings;
 *  - sleeve credits from MusicBrainz (artist relationships on the release and
 *    the release group — design, illustration, photography, art direction);
 *  - sleeve credits and notes from the Discogs dump, through the Discogs link
 *    MusicBrainz keeps per release (`out/dump-link.json`).
 * MusicBrainz is asked once per release, a second apart, answers in
 * cache.json. Prints a coverage table and writes `out/story.json`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SLEEVE_ROLE_RE, type DumpRelease } from './dump';

const DIR = import.meta.dirname;
const CACHE_FILE = join(DIR, 'cache.json');
const UA = 'beautifulbooks-lab/0.1 ( https://beautifulcovers.vercel.app )';
const cache: Record<string, unknown> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const FOLD = 20;

interface Rel { type: string; artist?: { name: string } }
async function artistRels(kind: 'release' | 'release-group', mbid: string): Promise<Rel[] | null> {
  const url = `https://musicbrainz.org/ws/2/${kind}/${mbid}?inc=artist-rels&fmt=json`;
  if (!(url in cache)) {
    for (let attempt = 0; attempt < 5 && !(url in cache); attempt++) {
      await sleep(attempt === 0 ? 1100 : 3000 * attempt);
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
        if (!res.ok) continue;
        cache[url] = await res.json();
        writeFileSync(CACHE_FILE, JSON.stringify(cache));
      } catch { /* retried */ }
    }
  }
  if (!(url in cache)) return null;
  return ((cache[url] as { relations?: Rel[] }).relations ?? []);
}
const SLEEVE_REL_RE = /design|illustrat|art direction|artwork|photograph|graphic/i;

interface Pressing { id: string; year: string; date: string; country: string; label: string; front: string | null; hash: string | null }
interface Album { id: string; title: string; artist: string; pressings: Pressing[] }
interface Sleeve {
  pressings: number; first: string; last: string; countries: string[]; labels: string[];
  mbCredits: string[]; discogsCredits: string[]; notes: string[];
}

const hamming = (a: string, b: string) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } }
  return d;
};
/** The mock-up's fold (lab/vinyl/mockup.html), kept in step by hand: single linkage at ≤ 20. */
function fold(ps: Pressing[]): Pressing[][] {
  const groups: Pressing[][] = [];
  for (const p of ps.filter(p => p.front)) {
    const hits = groups.filter(g => g.some(m => m.hash && p.hash && hamming(m.hash, p.hash) <= FOLD));
    if (!hits.length) { groups.push([p]); continue; }
    hits[0].push(p);
    for (const g of hits.slice(1)) { hits[0].push(...g); groups.splice(groups.indexOf(g), 1); }
  }
  for (const g of groups) g.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  return groups.sort((a, b) => (a[0].date || '9999').localeCompare(b[0].date || '9999'));
}

async function main() {
  const html = readFileSync(join(DIR, 'out', 'mockup.html'), 'utf8');
  const albums = JSON.parse(html.match(/const DATA = (\[[\s\S]*?\]);\n/)![1]) as Album[];
  const dump = new Map((JSON.parse(readFileSync(join(DIR, 'out', 'dump-albums.json'), 'utf8')) as DumpRelease[]).map(r => [r.id, r]));
  const links = JSON.parse(readFileSync(join(DIR, 'out', 'dump-link.json'), 'utf8')) as Record<string, { discogs: number[] }>;

  const out = [];
  console.log('| Album | Hüllen | mit Credit (MB, Release) | mit Credit (Discogs) | mit Anmerkung, die Hülle nennt | Credit am Album (MB) |');
  console.log('|---|---:|---:|---:|---:|---|');
  for (const album of albums) {
    const groupRels = (await artistRels('release-group', album.id)) ?? [];
    const albumCredits = groupRels.filter(r => SLEEVE_REL_RE.test(r.type)).map(r => `${r.type}: ${r.artist?.name}`);
    const sleeves: Sleeve[] = [];
    for (const g of fold(album.pressings)) {
      const mb = new Set<string>(), discogs = new Set<string>(), notes = new Set<string>();
      for (const p of g) {
        for (const r of (await artistRels('release', p.id)) ?? []) if (SLEEVE_REL_RE.test(r.type)) mb.add(`${r.type}: ${r.artist?.name}`);
        for (const id of links[p.id]?.discogs ?? []) {
          const d = dump.get(id);
          if (!d) continue;
          for (const c of d.credits) if (SLEEVE_ROLE_RE.test(c.role)) discogs.add(`${c.role}: ${c.name}`);
          for (const line of d.notes.split(/\n+/)) if (/\b(cover|sleeve|jacket|artwork|photo)/i.test(line) && line.length < 300) notes.add(line.trim());
        }
      }
      const years = g.map(p => p.year).filter(Boolean).sort();
      sleeves.push({
        pressings: g.length, first: years[0] ?? '', last: years.at(-1) ?? '',
        countries: [...new Set(g.map(p => p.country).filter(Boolean))], labels: [...new Set(g.map(p => p.label).filter(Boolean))],
        mbCredits: [...mb], discogsCredits: [...discogs], notes: [...notes].slice(0, 5),
      });
    }
    out.push({ album: album.title, albumCredits, sleeves });
    const n = (f: (s: Sleeve) => boolean) => sleeves.filter(f).length;
    console.log(`| ${album.title} | ${sleeves.length} | ${n(s => s.mbCredits.length > 0)} | ${n(s => s.discogsCredits.length > 0)} | ${n(s => s.notes.length > 0)} | ${albumCredits.join('; ') || '—'} |`);
  }
  writeFileSync(join(DIR, 'out', 'story.json'), JSON.stringify(out, null, 1));
}

main().catch(e => { console.error(e); process.exit(1); });

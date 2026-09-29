/**
 * Data for the vinyl mock-up (ROADMAP 5.16; Julian, 2026-09-29: „kannst du
 * ein mock up erstellen wie die seite aussehen könnte für vinyl. gleiches
 * konzept wie für bücher aber entsprechend abgeändert?").
 *
 *   npx tsx lab/vinyl/mockup.ts        (after measure.ts)
 *
 * For each measured album: every vinyl release with its labels and catalogue
 * numbers (one more MusicBrainz browse with `inc=labels`), the Cover Art
 * Archive images of every release that has artwork (not capped as in the
 * measurement), and a dHash of each front thumbnail — the site's own hash
 * (`lib/dhash.ts`) — so the wall folds reprints of one sleeve the way the
 * book wall folds covers. Writes `out/mockup.html` from `mockup.html` with
 * the data inlined; images stay hot-linked. Everything lands in `cache.json`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeToGray, dhash } from '../../lib/imagehash';
import { isVinyl, vinylColourNote, type MbRelease } from './parse';

const DIR = import.meta.dirname;
const CACHE_FILE = join(DIR, 'cache.json');
const UA = 'beautifulbooks-lab/0.1 ( https://beautifulcovers.vercel.app )';
const MB = 'https://musicbrainz.org/ws/2';
const cache: Record<string, unknown> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const save = () => writeFileSync(CACHE_FILE, JSON.stringify(cache));

async function getJson<T>(url: string, pauseMs: number): Promise<T | null> {
  if (url in cache) return cache[url] as T;
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(attempt === 0 ? pauseMs : 3000 * attempt);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) return null;
      if (!res.ok) continue;
      cache[url] = await res.json();
      save();
      return cache[url] as T;
    } catch { /* retried */ }
  }
  return null;
}

async function hashOf(url: string): Promise<string | null> {
  const key = `dhash:${url}`;
  if (key in cache) return cache[key] as string | null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) { await sleep(2000); continue; }
      const gray = decodeToGray(new Uint8Array(await res.arrayBuffer()));
      cache[key] = gray ? dhash(gray) : null;
      save();
      return cache[key] as string | null;
    } catch { await sleep(2000); }
  }
  return null;
}

interface Image { types: string[]; comment?: string; thumbnails: Record<string, string>; image: string }
interface LabelInfo { 'catalog-number'?: string | null; label?: { name: string } | null }
type FullRelease = MbRelease & { barcode?: string | null; 'label-info'?: LabelInfo[]; status?: string };

const thumb = (img: Image | undefined, size: '250' | '500') =>
  img ? (img.thumbnails[size] ?? img.thumbnails.large ?? img.thumbnails.small ?? img.image).replace(/^http:/, 'https:') : null;

const full = (img: Image | undefined) => img ? img.image.replace(/^http:/, 'https:') : null;

async function main() {
  const albums = [];
  for (const [key, value] of Object.entries(cache)) {
    if (!key.includes('/ws/2/release-group/?query=')) continue;
    const groups = (value as { 'release-groups': Array<{ id: string; title: string; 'first-release-date'?: string; 'artist-credit': Array<{ name: string }> }> })['release-groups'];
    const wanted = decodeURIComponent(key).match(/releasegroup:"([^"]+)"/)?.[1]?.toLowerCase();
    const rg = groups.find(g => g.title.toLowerCase() === wanted) ?? groups[0];

    const releases: FullRelease[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await getJson<{ releases: FullRelease[]; 'release-count': number }>(
        `${MB}/release?release-group=${rg.id}&inc=media+labels&fmt=json&limit=100&offset=${offset}`, 1100);
      if (!page) break;
      releases.push(...page.releases);
      if (offset + 100 >= page['release-count']) break;
    }
    const pressings = [];
    for (const r of releases.filter(isVinyl)) {
      const caa = r['cover-art-archive'];
      const art = caa?.artwork ? await getJson<{ images: Image[] }>(`https://coverartarchive.org/release/${r.id}`, 300) : null;
      const images = art?.images ?? [];
      const front = images.find(i => i.types.includes('Front'));
      const back = images.find(i => i.types.includes('Back'));
      const labels = images.filter(i => i.types.includes('Medium') && !/\bCD\b/i.test(i.comment ?? ''));
      const frontThumb = thumb(front, '250');
      const labelInfo = r['label-info'] ?? [];
      pressings.push({
        id: r.id,
        year: r.date?.slice(0, 4) ?? '',
        date: r.date ?? '',
        country: r.country ?? '',
        label: labelInfo.find(l => l.label?.name)?.label?.name ?? '',
        catno: [...new Set(labelInfo.map(l => l['catalog-number']).filter(Boolean))].join(', '),
        barcode: r.barcode ?? '',
        format: (r.media ?? []).map(m => m.format).filter(Boolean).join(' + '),
        colour: vinylColourNote(r),
        note: r.disambiguation ?? '',
        // The 500 px thumbnail is listed even where the original is smaller and
        // the file does not exist; the page falls back to the original then.
        front: frontThumb, frontLarge: thumb(front, '500'), frontFull: full(front),
        back: thumb(back, '250'), backLarge: thumb(back, '500'), backFull: full(back),
        labels: labels.slice(0, 2).map(l => ({ small: thumb(l, '250'), large: thumb(l, '500'), full: full(l) })),
        hash: frontThumb ? await hashOf(frontThumb) : null,
      });
    }
    pressings.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    albums.push({ id: rg.id, title: rg.title, artist: rg['artist-credit'][0].name, first: rg['first-release-date']?.slice(0, 4) ?? '', releases: releases.length, pressings });
    console.log(`${rg.title}: ${pressings.length} vinyl pressings, ${pressings.filter(p => p.front).length} with a front`);
  }
  const template = readFileSync(join(DIR, 'mockup.html'), 'utf8');
  mkdirSync(join(DIR, 'out'), { recursive: true });
  writeFileSync(join(DIR, 'out', 'mockup.html'), template.replace('/*DATA*/null', JSON.stringify(albums).replace(/</g, '\\u003c')));
  console.log('→ lab/vinyl/out/mockup.html');
}

main().catch(e => { console.error(e); process.exit(1); });

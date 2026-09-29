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
 * measurement), and a dHash and contrast of each front thumbnail — the
 * site's own functions (`lib/imagehash.ts`) — so the wall folds reprints of
 * one sleeve the way the book wall folds covers. Writes `out/mockup.html` from `mockup.html` with
 * the data inlined; images stay hot-linked. Everything lands in `cache.json`.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { colour, contrast, decode, dhash, toGray } from '../../lib/imagehash';
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

interface Signature { hash: string | null; contrast: number | null; saturation?: number; hues?: string }
const THUMBS = join(DIR, 'out', 'thumbs');
const thumbFile = (url: string) => join(THUMBS, createHash('sha1').update(url).digest('hex') + '.jpg');

/** The thumbnail's bytes, from `out/thumbs/` (git-ignored) or the archive; null on failure. */
async function thumbBytes(url: string): Promise<Uint8Array | null> {
  const file = thumbFile(url);
  if (existsSync(file)) return new Uint8Array(readFileSync(file));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) { await sleep(2000); continue; }
      const bytes = new Uint8Array(await res.arrayBuffer());
      mkdirSync(THUMBS, { recursive: true });
      writeFileSync(file, bytes);
      return bytes;
    } catch { await sleep(2000); }
  }
  return null;
}

/**
 * dHash, luminance contrast and colour of one image, with the site's own
 * functions (`lib/imagehash.ts`). A failed download is not cached, so the
 * next run asks again; a sleeve without a hash can never fold.
 */
async function signatureOf(url: string): Promise<Signature> {
  const key = `sig2:${url}`;
  if (key in cache) return cache[key] as Signature;
  const bytes = await thumbBytes(url);
  if (!bytes) return { hash: null, contrast: null };
  const rgba = decode(bytes);
  const sig: Signature = rgba
    ? { hash: dhash(toGray(rgba)), contrast: Math.round(contrast(toGray(rgba))), ...colour(rgba) }
    : { hash: null, contrast: null };
  cache[key] = sig;
  save();
  return sig;
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
        // The wall shows the local copy that the signature was made from: archive.org
        // is slow and drops requests, and the fronts are what a visitor sees first.
        front: frontThumb && existsSync(thumbFile(frontThumb)) ? `thumbs/${basename(thumbFile(frontThumb))}` : frontThumb,
        frontLarge: thumb(front, '500'), frontFull: full(front),
        back: thumb(back, '250'), backLarge: thumb(back, '500'), backFull: full(back),
        labels: labels.slice(0, 2).map(l => ({ small: thumb(l, '250'), large: thumb(l, '500'), full: full(l) })),
        ...(frontThumb ? await signatureOf(frontThumb) : { hash: null, contrast: null }),
      });
    }
    pressings.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    albums.push({ id: rg.id, title: rg.title, artist: rg['artist-credit'][0].name, first: rg['first-release-date']?.slice(0, 4) ?? '', releases: releases.length, pressings });
    console.log(`${rg.title}: ${pressings.length} vinyl pressings, ${pressings.filter(p => p.front).length} with a front`);
  }
  // Stories from live-story.ts (last round per album), with the measured time it took, if there are any.
  const livePath = join(DIR, 'out', 'live-story.json');
  const storyPath = join(DIR, 'out', 'story.json');
  if (existsSync(livePath) && existsSync(storyPath)) {
    const runs = JSON.parse(readFileSync(livePath, 'utf8')) as Array<{ album: string; round: number; url: string | null; article: string | null; wikiMs: number; totalMs: number; story: { album: { text: string; sources: string[] }; sleeves: Array<{ id: string; text: string; sources: string[] }> } | null }>;
    const stacks = JSON.parse(readFileSync(storyPath, 'utf8')) as Array<{ album: string; sleeves: Array<{ ids: string[] }> }>;
    for (const album of albums) {
      const run = runs.filter(r => r.album === album.title && r.story).at(-1);
      const stack = stacks.find(s => s.album === album.title);
      if (!run?.story || !stack) continue;
      const captions: Record<string, { text: string; sources: string[] }> = {};
      run.story.sleeves.forEach(c => {
        const ids = stack.sleeves[Number(c.id.slice(1)) - 1]?.ids ?? [];
        for (const id of ids) captions[id] = { text: c.text, sources: c.sources };
      });
      Object.assign(album, { story: { ...run.story.album, article: run.article, url: run.url, wikiMs: run.wikiMs, totalMs: run.totalMs, captions } });
    }
  }
  // The same without a model (wiki-only.ts): Wikipedia excerpt and set captions, with the measured lookup time.
  const wikiOnlyPath = join(DIR, 'out', 'wiki-only.json');
  if (existsSync(wikiOnlyPath)) {
    const runs = JSON.parse(readFileSync(wikiOnlyPath, 'utf8')) as Array<{ album: string; article: string | null; url: string | null; excerpt: string; fromWikidataMs: number | null; sleeves: Array<{ ids: string[]; line: string; note: string | null }> }>;
    for (const album of albums) {
      const run = runs.filter(r => r.album === album.title).at(-1);
      if (!run) continue;
      const captions: Record<string, { line: string; note: string | null }> = {};
      for (const s of run.sleeves) for (const id of s.ids) captions[id] = { line: s.line, note: s.note };
      Object.assign(album, { wiki: { article: run.article, url: run.url, excerpt: run.excerpt, ms: run.fromWikidataMs ?? 0, captions } });
    }
  }
  const template = readFileSync(join(DIR, 'mockup.html'), 'utf8');
  mkdirSync(join(DIR, 'out'), { recursive: true });
  writeFileSync(join(DIR, 'out', 'mockup.html'), template.replace('/*DATA*/null', JSON.stringify(albums).replace(/</g, '\\u003c')));
  console.log('→ lab/vinyl/out/mockup.html');
}

main().catch(e => { console.error(e); process.exit(1); });

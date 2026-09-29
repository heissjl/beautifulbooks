/**
 * A wall of record labels (ROADMAP 5.16; Julian, 2026-09-29: „zeig mir eine
 * wand der etiketten"). Reads only `cache.json` from measure.ts — no network —
 * and writes `out/labels.html` (git-ignored): per album, one tile per vinyl
 * pressing, the first `Medium` image of it, oldest pressing first. The images
 * are hot-linked 250 px thumbnails from the Cover Art Archive.
 *
 *   npx tsx lab/vinyl/measure.ts   (once, fills the cache)
 *   npx tsx lab/vinyl/labels.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isVinyl, type MbRelease } from './parse';

interface CaaImageFull { types: string[]; comment?: string; thumbnails: Record<string, string> }

const cache = JSON.parse(readFileSync(join(import.meta.dirname, 'cache.json'), 'utf8')) as Record<string, unknown>;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const albums: Array<{ title: string; tiles: Array<{ src: string; caption: string }> }> = [];
for (const [key, value] of Object.entries(cache)) {
  if (!key.includes('/ws/2/release-group/?query=')) continue;
  const groups = (value as { 'release-groups': Array<{ id: string; title: string; 'artist-credit': Array<{ name: string }> }> })['release-groups'];
  const wanted = decodeURIComponent(key).match(/releasegroup:"([^"]+)"/)?.[1]?.toLowerCase();
  const rg = groups.find(g => g.title.toLowerCase() === wanted) ?? groups[0];
  const releases = Object.entries(cache)
    .filter(([k]) => k.includes(`/ws/2/release?release-group=${rg.id}&`))
    .flatMap(([, v]) => (v as { releases: MbRelease[] }).releases)
    .filter(isVinyl)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const tiles = [];
  for (const r of releases) {
    const art = cache[`https://coverartarchive.org/release/${r.id}`] as { images?: CaaImageFull[] } | undefined;
    const label = art?.images?.find(i => i.types.includes('Medium') && !/\bCD\b/i.test(i.comment ?? ''));
    if (!label) continue;
    const src = (label.thumbnails['250'] ?? label.thumbnails.small).replace(/^http:/, 'https:');
    tiles.push({ src, caption: [r.date?.slice(0, 4), r.country].filter(Boolean).join(' · ') });
  }
  if (tiles.length) albums.push({ title: `${rg['artist-credit'][0].name} — ${rg.title}`, tiles });
}

const total = albums.reduce((s, a) => s + a.tiles.length, 0);
const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wand der Etiketten</title>
<style>
  body { margin: 0; padding: 24px 16px 48px; background: #141210; color: #e8e2d6; font: 15px/1.4 system-ui, sans-serif; }
  h1 { font-weight: 500; font-size: 28px; margin: 0 0 4px; }
  p.lede { color: #a39a8a; margin: 0 0 28px; max-width: 60ch; }
  h2 { font-weight: 500; font-size: 17px; margin: 32px 0 12px; }
  h2 span { color: #a39a8a; font-weight: 400; }
  .wall { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 14px; }
  figure { margin: 0; text-align: center; }
  img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 50%; background: #000; display: block;
        box-shadow: 0 0 0 5px #050505, 0 2px 10px rgba(0,0,0,.6); }
  figcaption { font-size: 12px; color: #a39a8a; margin-top: 9px; font-variant-numeric: tabular-nums; }
</style></head><body>
<h1>Wand der Etiketten</h1>
<p class="lede">${total} Vinyl-Pressungen von acht Alben, je Pressung das erste Bild vom Typ „Medium“ aus dem Cover Art Archive, älteste zuerst. Stichprobe aus der Messung vom 2026-09-29 (ROADMAP 5.16), nicht alle Pressungen.</p>
${albums.map(a => `<h2>${esc(a.title)} <span>${a.tiles.length}</span></h2>
<div class="wall">${a.tiles.map(t => `<figure><img loading="lazy" src="${esc(t.src)}" alt=""><figcaption>${esc(t.caption || '—')}</figcaption></figure>`).join('')}</div>`).join('\n')}
</body></html>
`;
mkdirSync(join(import.meta.dirname, 'out'), { recursive: true });
writeFileSync(join(import.meta.dirname, 'out', 'labels.html'), html);
console.log(`${total} labels from ${albums.length} albums → lab/vinyl/out/labels.html`);

/**
 * How a book page feels, curated against not curated (ROADMAP 6.26): time to
 * the first cover tile, time until the wall has settled, tiles still without
 * a picture after ten seconds — cold (first visit after `next start`) and
 * warm (second visit), at 390 × 844 and 1280 × 800, in a headless Chrome.
 *
 *   npx tsx lab/curated-ux/measure.ts http://localhost:3102 [--works 6] [--json]
 *
 * Works: the first N curated works among the eighteen prerendered ones
 * (`WALL_WORKS`), N curated beyond them (ISR on first hit), and N popular
 * works that are not curated (`data/popular-works.json`). Every page asks the
 * server, which asks Open Library once per editions page and keeps the
 * answer — so the warm visit measures the site, the cold one the catalogue
 * too. Sequential, one page at a time, a pause between works (umgang §1).
 *
 * What is read, every 250 ms until settled or 20 s: the number of tiles
 * (`button[data-cover-id]`), how many carry a loaded image, and the first
 * moment a tile had one. Settled means: tile count unchanged for 2 s and
 * every tile's image loaded, or no `/api/works` request in flight for 2 s.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, type Page } from '../video/screen/cdp';
import { CURATED_LIST, WALL_WORKS } from '../../lib/curated';

interface Sample { tiles: number; loaded: number; firstTileMs: number | null; pending: number }
export interface Reading {
  group: 'prerendered' | 'curated' | 'popular';
  id: string;
  title: string;
  width: number;
  visit: 'cold' | 'warm';
  /** ms from navigation to the first tile with a loaded picture; null when none came. */
  firstTileMs: number | null;
  /** ms until the wall settled (see header); 20000 when it did not. */
  settledMs: number;
  tiles: number;
  /** Tiles without a loaded picture at 10 s. */
  emptyAt10s: number;
  emptyAtEnd: number;
}

const PROBE = `(() => {
  const tiles = [...document.querySelectorAll('button[data-cover-id]')];
  const loaded = tiles.filter(t => { const i = t.querySelector('img'); return i && i.complete && i.naturalWidth > 0; }).length;
  // performance.now() counts from this navigation's start.
  if (loaded > 0 && !window.__firstTile) window.__firstTile = performance.now();
  const pending = performance.getEntriesByType('resource').filter(e => e.name.includes('/api/works/') && !e.responseEnd).length;
  return { tiles: tiles.length, loaded, firstTileMs: window.__firstTile ? Math.round(window.__firstTile) : null, pending };
})()`;

const SIZES: Record<number, number> = { 390: 844, 1280: 800 };
const CAP_MS = 20_000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

let visits = 0;

async function visit(page: Page, url: string, width: number): Promise<Omit<Reading, 'group' | 'id' | 'title' | 'width' | 'visit'>> {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: SIZES[width] ?? 800, deviceScaleFactor: width < 768 ? 2 : 1, mobile: width < 768 });
  // Each visit is its own reader for the per-instance rate limiter (`clientKey` reads x-forwarded-for):
  // the measurement is of the page, not of the bucket a single address empties after twenty page-0 loads.
  visits += 1;
  await page.send('Network.setExtraHTTPHeaders', { headers: { 'x-forwarded-for': `10.26.${Math.floor(visits / 250)}.${visits % 250}` } });
  const started = Date.now();
  await page.send('Page.navigate', { url });
  let last: Sample = { tiles: 0, loaded: 0, firstTileMs: null, pending: 0 };
  let stableSince = Date.now();
  let emptyAt10s = -1;
  let settledMs = CAP_MS;
  while (Date.now() - started < CAP_MS) {
    await new Promise(r => setTimeout(r, 250));
    let s: Sample;
    try {
      s = await page.evaluate<Sample>(PROBE);
    } catch {
      continue; // still navigating
    }
    const elapsed = Date.now() - started;
    if (s.tiles !== last.tiles) stableSince = Date.now();
    if (emptyAt10s < 0 && elapsed >= 10_000) emptyAt10s = s.tiles - s.loaded;
    last = s;
    const quiet = Date.now() - stableSince >= 2000;
    if (s.tiles > 0 && quiet && (s.loaded === s.tiles || s.pending === 0)) { settledMs = elapsed; break; }
  }
  if (emptyAt10s < 0) emptyAt10s = last.tiles - last.loaded;
  const firstTileMs = await page.evaluate<number | null>('window.__firstTile ? Math.round(window.__firstTile) : null');
  return { firstTileMs, settledMs, tiles: last.tiles, emptyAt10s, emptyAtEnd: last.tiles - last.loaded };
}

export async function measure(base: string, n: number): Promise<Reading[]> {
  const prerendered = new Set(WALL_WORKS.map(w => w.id));
  const pre = CURATED_LIST.filter(w => prerendered.has(w.id)).slice(0, n);
  const cur = CURATED_LIST.filter(w => !prerendered.has(w.id)).slice(0, n);
  const curatedIds = new Set(CURATED_LIST.map(w => w.id));
  const popularFile = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'popular-works.json'), 'utf8')) as { works: Array<{ id: string; title: string }> };
  const popular = popularFile.works.filter(w => !curatedIds.has(w.id)).slice(0, n);
  const plan = [
    ...pre.map(w => ({ group: 'prerendered' as const, id: w.id, title: w.title })),
    ...cur.map(w => ({ group: 'curated' as const, id: w.id, title: w.title })),
    ...popular.map(w => ({ group: 'popular' as const, id: w.id, title: w.title })),
  ];
  const page = await launch(9342);
  await page.send('Network.enable');
  const out: Reading[] = [];
  try {
    for (const w of plan) {
      for (const width of [390, 1280]) {
        for (const kind of ['cold', 'warm'] as const) {
          // The second width's "cold" visit is only cold for the browser: the server already holds the pages.
          const r = await visit(page, `${base}/book/${w.id}`, width);
          out.push({ ...w, width, visit: kind, ...r });
          console.error(`${w.group.padEnd(11)} ${w.id.padEnd(12)} ${String(width).padStart(4)} ${kind} first ${String(r.firstTileMs ?? '-').padStart(6)} settled ${String(r.settledMs).padStart(6)} tiles ${String(r.tiles).padStart(3)} empty@10s ${r.emptyAt10s}`);
          await page.send('Page.navigate', { url: 'about:blank' });
          await new Promise(res => setTimeout(res, 800));
        }
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  } finally {
    await page.close();
  }
  return out;
}

function table(readings: Reading[]): string {
  const rows: string[] = ['| Gruppe | Breite | Besuch | n | erste Kachel (Median ms) | Wand steht (Median ms) | Kacheln | leer nach 10 s (Summe) |', '|---|---|---|---|---|---|---|---|'];
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  for (const group of ['prerendered', 'curated', 'popular'] as const) for (const width of [390, 1280]) for (const visitKind of ['cold', 'warm'] as const) {
    const rs = readings.filter(r => r.group === group && r.width === width && r.visit === visitKind);
    if (!rs.length) continue;
    rows.push(`| ${group} | ${width} | ${visitKind} | ${rs.length} | ${median(rs.map(r => r.firstTileMs ?? CAP_MS))} | ${median(rs.map(r => r.settledMs))} | ${median(rs.map(r => r.tiles))} | ${rs.reduce((a, r) => a + r.emptyAt10s, 0)} |`);
  }
  return rows.join('\n');
}

async function main() {
  const base = process.argv[2];
  if (!base || base.startsWith('--')) throw new Error('usage: npx tsx lab/curated-ux/measure.ts http://localhost:3102 [--works 6] [--json]');
  if (/buyitscovers\.com/.test(base)) throw new Error('Measure against a local next start, never production (CLAUDE.md).');
  const readings = await measure(base, Number(arg('--works') ?? 6));
  console.log(process.argv.includes('--json') ? JSON.stringify(readings, null, 1) : table(readings));
}

if (process.argv[1] && /measure\.ts$/.test(process.argv[1])) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

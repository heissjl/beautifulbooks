/**
 * The wall on a phone, measured before anything is built (ROADMAP 6.73).
 *
 *   npx tsx lab/wall-phone/measure.ts http://localhost:3102 [--net fast4g|none] [--json]
 *
 * A headless Chrome at 390 × 844 (mobile, DPR 2), optionally throttled to
 * DevTools' "Fast 4G" (165 ms latency, 9 Mbit/s down, 1.5 up — the preset's
 * own numbers with Chrome's 2.75 latency factor). Per page and visit, without
 * scrolling, for 15 s:
 *
 * - **first screen full**: ms until every image in the first 844 px has loaded
 *   (tiles on a book page, mosaics on a result list);
 * - **empty in view** at 5 s and 10 s;
 * - **image requests before the first scroll**, against the images on screen
 *   and on the page — whether `loading="lazy"` holds back the rest;
 * - **the waterfall of the first 20 image requests**: start, time to first
 *   byte, end, bytes, and whether the server's `/img` route or a foreign host
 *   answered — so the wait can be put where it is: our route cold, the cover
 *   host, or the browser.
 *
 * Visits: "cold" is the first request of that page since `next start` (the
 * server fetches from Open Library and archive.org), "warm" the second, with
 * the browser cache cleared in between so only the server is warm. One page at
 * a time, a pause between pages (umgang §1). Never against production.
 */
import { launch, type Page } from '../video/screen/cdp';

const PAGES = [
  { label: 'Gatsby (prerendered, 139 tiles)', path: '/book/OL468431W' },
  { label: 'Neuromancer (curated, ISR)', path: '/book/OL27258W' },
  { label: 'OL82563W (popular, not curated)', path: '/book/OL82563W' },
  { label: 'search: the great gatsby', path: '/?q=the+great+gatsby' },
];
const WIDTH = 390;
const HEIGHT = 844;
const WINDOW_MS = 15_000;
const FAST_4G = { offline: false, latency: 60 * 2.75, downloadThroughput: (9_000_000 / 8) * 0.9, uploadThroughput: (1_500_000 / 8) * 0.9 };

interface ImageRequest { id: string; url: string; start: number; ttfb?: number; end?: number; bytes?: number; status?: number; failed?: boolean; queueMs?: number; serverMs?: number; protocol?: string }
export interface Reading {
  label: string;
  path: string;
  visit: 'cold' | 'warm';
  net: string;
  firstScreenMs: number | null;
  inView: number;
  emptyInViewAt5s: number;
  emptyInViewAt10s: number;
  imagesOnPage: number;
  imageRequests: number;
  waterfall: Array<{ path: string; host: 'img' | 'foreign'; startMs: number; ttfbMs: number | null; queueMs: number | null; serverMs: number | null; endMs: number | null; kb: number | null; status: number | null; protocol: string | null }>;
}

const PROBE = `(() => {
  const h = ${HEIGHT};
  const imgs = [...document.querySelectorAll('main img, button[data-cover-id] img')];
  const unique = [...new Set(imgs)];
  const visible = i => { const r = i.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.top < h && r.bottom > 0; };
  const inView = unique.filter(visible);
  const loaded = inView.filter(i => i.complete && i.naturalWidth > 0).length;
  return { inView: inView.length, loaded, onPage: unique.length };
})()`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

let visits = 0;

async function visit(page: Page, base: string, p: typeof PAGES[number], kind: 'cold' | 'warm', net: string): Promise<Reading> {
  await page.send('Network.clearBrowserCache');
  visits += 1;
  // Each visit its own reader for the per-instance rate limiter (as in lab/curated-ux).
  await page.send('Network.setExtraHTTPHeaders', { headers: { 'x-forwarded-for': `10.73.${Math.floor(visits / 250)}.${visits % 250}` } });
  const requests = new Map<string, ImageRequest>();
  let t0 = 0;
  const offs = [
    page.on('Network.requestWillBeSent', e => {
      const req = e.request as { url: string };
      if (e.type !== 'Image') return;
      requests.set(e.requestId as string, { id: e.requestId as string, url: req.url, start: e.timestamp as number });
    }),
    page.on('Network.responseReceived', e => {
      const r = requests.get(e.requestId as string);
      if (!r) return;
      const res = e.response as { status: number; protocol?: string; timing?: { requestTime: number; sendEnd: number; receiveHeadersEnd: number } };
      r.ttfb = e.timestamp as number;
      r.status = res.status;
      r.protocol = res.protocol;
      // Queue: from asking to the request leaving the browser; server: from sent to headers back.
      if (res.timing) {
        r.queueMs = Math.max(0, Math.round((res.timing.requestTime - r.start) * 1000 + res.timing.sendEnd));
        r.serverMs = Math.round(res.timing.receiveHeadersEnd - res.timing.sendEnd);
      }
    }),
    page.on('Network.loadingFinished', e => {
      const r = requests.get(e.requestId as string);
      if (r) { r.end = e.timestamp as number; r.bytes = e.encodedDataLength as number; }
    }),
    page.on('Network.loadingFailed', e => {
      const r = requests.get(e.requestId as string);
      if (r) { r.failed = true; r.end = e.timestamp as number; }
    }),
  ];
  const navStarted = Date.now();
  const firstEvent = page.once('Network.requestWillBeSent');
  await page.send('Page.navigate', { url: base + p.path });
  t0 = ((await firstEvent).timestamp as number) ?? 0;
  let firstScreenMs: number | null = null;
  let at5 = -1;
  let at10 = -1;
  let last = { inView: 0, loaded: 0, onPage: 0 };
  while (Date.now() - navStarted < WINDOW_MS) {
    await new Promise(r => setTimeout(r, 200));
    try {
      last = await page.evaluate<typeof last>(PROBE);
    } catch {
      continue;
    }
    const elapsed = Date.now() - navStarted;
    if (firstScreenMs === null && last.inView > 0 && last.loaded === last.inView) firstScreenMs = elapsed;
    if (at5 < 0 && elapsed >= 5_000) at5 = last.inView - last.loaded;
    if (at10 < 0 && elapsed >= 10_000) at10 = last.inView - last.loaded;
  }
  for (const off of offs) off();
  const ordered = [...requests.values()].sort((a, b) => a.start - b.start);
  const ms = (t: number | undefined) => (t === undefined ? null : Math.round((t - t0) * 1000));
  return {
    label: p.label,
    path: p.path,
    visit: kind,
    net,
    firstScreenMs,
    inView: last.inView,
    emptyInViewAt5s: Math.max(0, at5),
    emptyInViewAt10s: Math.max(0, at10),
    imagesOnPage: last.onPage,
    imageRequests: requests.size,
    waterfall: ordered.slice(0, 20).map(r => {
      const u = new URL(r.url);
      return {
        path: u.pathname,
        host: u.origin === new URL(base).origin && u.pathname.startsWith('/img/') ? 'img' as const : 'foreign' as const,
        startMs: ms(r.start) ?? 0,
        ttfbMs: r.ttfb === undefined ? null : Math.round((r.ttfb - r.start) * 1000),
        queueMs: r.queueMs ?? null,
        serverMs: r.serverMs ?? null,
        protocol: r.protocol ?? null,
        endMs: ms(r.end),
        kb: r.bytes === undefined ? null : Math.round(r.bytes / 1024),
        status: r.failed ? 0 : r.status ?? null,
      };
    }),
  };
}

export async function measure(base: string, net: string): Promise<Reading[]> {
  if (/buyitscovers\.com/.test(base)) throw new Error('never against production (CLAUDE.md)');
  const page = await launch(9373);
  await page.send('Network.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true });
  if (net === 'fast4g') await page.send('Network.emulateNetworkConditions', FAST_4G);
  const out: Reading[] = [];
  try {
    for (const p of PAGES) {
      for (const kind of ['cold', 'warm'] as const) {
        const r = await visit(page, base, p, kind, net);
        out.push(r);
        console.error(`${p.label.padEnd(34)} ${kind} full ${String(r.firstScreenMs ?? '-').padStart(6)} inView ${r.inView} empty@5 ${r.emptyInViewAt5s} @10 ${r.emptyInViewAt10s} requests ${r.imageRequests}/${r.imagesOnPage}`);
        await page.send('Page.navigate', { url: 'about:blank' });
        await new Promise(res => setTimeout(res, 1000));
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  } finally {
    await page.close();
  }
  return out;
}

function report(readings: Reading[]): string {
  const median = (xs: number[]) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : '-'; };
  const lines = ['| Seite | Besuch | Netz | erster Bildschirm voll (ms) | erste Bildanfrage (ms) | Median Warteschlange / Server der ersten 20 (ms) | Bilder im Bild | leer nach 5 s | nach 10 s | Bildanfragen vor dem Scrollen / Bilder auf der Seite |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of readings) {
    const w = r.waterfall;
    lines.push(`| ${r.label} | ${r.visit} | ${r.net} | ${r.firstScreenMs ?? '> 15000'} | ${w[0]?.startMs ?? '-'} | ${median(w.map(x => x.queueMs ?? NaN))} / ${median(w.map(x => x.serverMs ?? NaN))} | ${r.inView} | ${r.emptyInViewAt5s} | ${r.emptyInViewAt10s} | ${r.imageRequests} / ${r.imagesOnPage} |`);
  }
  for (const r of readings) {
    lines.push('', `**${r.label}, ${r.visit}, ${r.net}** — Wasserfall der ersten ${r.waterfall.length} Bildanfragen (ms ab der ersten Anfrage der Seite):`, '', '| # | Weg | Start | bis erstes Byte | davon Warteschlange | davon Server | Ende | KB | Status | Protokoll |', '|---|---|---|---|---|---|---|---|---|---|');
    r.waterfall.forEach((w, i) => lines.push(`| ${i + 1} | ${w.host === 'img' ? w.path : `fremd ${w.path}`} | ${w.startMs} | ${w.ttfbMs ?? '-'} | ${w.queueMs ?? '-'} | ${w.serverMs ?? '-'} | ${w.endMs ?? '-'} | ${w.kb ?? '-'} | ${w.status ?? '-'} | ${w.protocol ?? '-'} |`));
  }
  return lines.join('\n');
}

async function main() {
  const base = process.argv[2];
  if (!base || base.startsWith('--')) throw new Error('usage: measure.ts <base url> [--net fast4g|none] [--json]');
  const net = arg('--net') ?? 'fast4g';
  const readings = await measure(base.replace(/\/$/, ''), net);
  console.log(process.argv.includes('--json') ? JSON.stringify(readings, null, 1) : report(readings));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

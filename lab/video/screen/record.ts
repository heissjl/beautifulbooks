/**
 * Records the Goodreads clip's raw footage (ROADMAP 5.5b, plan docs/plans/PLAN-5.5b-goodreads-clip.md).
 *
 *   npx tsx lab/video/screen/record.ts [--warm]
 *
 * Against `next dev` with `WALLS=on` (BASE, default http://localhost:3107),
 * never production. A phone of 360 × 640 CSS px at three device pixels, so
 * every frame is 1080 × 1920. The page is driven the way a reader would use
 * it — the same drop handler, the same buttons — and filmed with full-size
 * screenshots. Nothing is drawn into the page: the finger, the
 * flying file and the words are laid over the frames by `compose.py`, which
 * reads the taps and phase marks this script writes.
 *
 * `--warm` walks the flow once without filming, so the catalogue answers and
 * the images come from the caches when it counts. Waiting is cut afterwards,
 * not faked: a phase mark says where the page was still loading.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, type Page } from './cdp';

const BASE = process.env.BASE ?? 'http://localhost:3107';
const OUT = join(__dirname, 'out');
const RAW = join(OUT, 'raw');
const WARM = process.argv.includes('--warm');
const BOOK = 'OL1858668W'; // Wide Sargasso Sea, from the curated list
const COVER = 'ol:10191445'; // Penguin 1997: the publisher's current image for its ISBN is this cover (checked 2026-10-09)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const now = () => Date.now() / 1000;

interface Mark { name: string; t: number }
interface Tap { t: number; x: number; y: number }

const marks: Mark[] = [];
const taps: Tap[] = [];
const mark = (name: string) => marks.push({ name, t: now() });

/** Waits until the expression is true, up to `ms`. */
async function until(page: Page, expression: string, ms = 60_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.evaluate<boolean>(`!!(${expression})`)) return;
    await sleep(200);
  }
  throw new Error(`timed out: ${expression}`);
}

/** Every <img> in the viewport has loaded. */
const imagesIn = `[...document.images].filter(i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; }).every(i => i.complete && i.naturalWidth > 0)`;

/** Taps the element: logs its centre for the finger, then clicks it — unless `click` is false. */
async function tap(page: Page, selector: string, hold = 350, click = true): Promise<void> {
  const box = await page.evaluate<{ x: number; y: number } | null>(`(() => {
    const el = ${selector};
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`nothing to tap: ${selector}`);
  taps.push({ t: now(), ...box });
  await sleep(hold);
  if (click) await page.evaluate(`(${selector}).click()`);
}

const byText = (tag: string, test: string) => `[...document.querySelectorAll('${tag}')].find(e => ${test})`;

async function main(): Promise<void> {
  const page = await launch();
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 3, mobile: true });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  // The dev server's own badge is not the site.
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head.append(s); });`,
  });

  /*
    Filmed by a loop of full-size screenshots, not the protocol's screencast:
    a screencast frame comes in CSS pixels (360 × 640) whatever the device
    scale. A JPEG shot at 1080 × 1920 takes about 62 ms here (measured
    2026-10-09), so the loop gives some 16 frames a second; compose.py holds
    each until the next.
  */
  let frames: { file: string; t: number }[] = [];
  let filming = false;
  let loop: Promise<void> = Promise.resolve();
  const film = async () => {
    while (filming) {
      const t = now();
      const r = (await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true })) as { data: string };
      const file = `${String(frames.length).padStart(5, '0')}.jpg`;
      writeFileSync(join(RAW, file), Buffer.from(r.data, 'base64'));
      frames.push({ file, t });
    }
  };
  if (!WARM) {
    rmSync(RAW, { recursive: true, force: true });
    mkdirSync(RAW, { recursive: true });
  }

  // 1. /create, scrolled to the library card, switched to Goodreads.
  await page.send('Page.navigate', { url: `${BASE}/create` });
  await until(page, byText('button', `e.innerText.trim() === 'Goodreads'`));
  await page.evaluate(`${byText('h2,h3', `e.innerText.includes('From your library')`)}.scrollIntoView({ block: 'start' })`);
  await page.evaluate('window.scrollBy(0, -24)');
  // Clicked until it takes: a click before hydration does nothing.
  const dropZone = byText('label', `e.innerText.includes('goodreads_library_export.csv')`);
  for (let i = 0; i < 40 && !(await page.evaluate<boolean>(`!!${dropZone}`)); i++) {
    await page.evaluate(`${byText('button', `e.innerText.trim() === 'Goodreads'`)}.click()`);
    await sleep(500);
  }
  await until(page, dropZone);
  await sleep(600);
  if (!WARM) {
    filming = true;
    loop = film();
  }
  await sleep(400);

  // 2. The file is dropped (compose.py draws it flying in before this mark, onto the drop zone's centre).
  const zone = await page.evaluate<{ x: number; y: number }>(`(() => { const r = ${dropZone}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  mark('drop');
  const csv = readFileSync(join(__dirname, 'goodreads_library_export.csv'), 'utf8');
  await page.evaluate(`(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([${JSON.stringify(csv)}], 'goodreads_library_export.csv', { type: 'text/csv' }));
    ${byText('label', `e.innerText.includes('goodreads_library_export.csv')`)}.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  })()`);
  await until(page, byText('button', `e.innerText.startsWith('Want to read')`));
  await sleep(500);
  await tap(page, byText('button', `e.innerText.startsWith('Want to read')`));
  mark('shelf');
  await until(page, `document.body.innerText.includes('found with a cover') && !document.body.innerText.includes('Looking them up')`, 120_000);
  mark('found');
  await page.evaluate(`${byText('button', `e.innerText.startsWith('Make a collection')`)}.scrollIntoView({ block: 'center', behavior: 'smooth' })`);
  await sleep(900);
  await tap(page, byText('button', `e.innerText.startsWith('Make a collection')`));

  // 3. The new collection, out of the editor.
  await until(page, `location.pathname.endsWith('/edit')`, 60_000);
  mark('editor');
  await until(page, byText('button,a', `e.innerText.trim() === 'Keep it'`));
  await page.evaluate(`${byText('button,a', `e.innerText.trim() === 'Keep it'`)}.click()`);
  await until(page, `!${byText('button,a', `e.innerText.trim() === 'Keep it'`)}`, 20_000);
  await page.evaluate(`${byText('button,a', `e.innerText.trim() === 'Stop editing'`)}.click()`);
  await until(page, `/^\\/c\\/[^/]+$/.test(location.pathname) && document.querySelector('a[href*="/book/${BOOK}"]')`, 60_000);
  await until(page, imagesIn, 30_000);
  mark('wall');
  await sleep(1800);

  // 4. Into the book: its wall of covers, scrolled slowly.
  await tap(page, `document.querySelector('a[href*="/book/${BOOK}"]')`);
  await until(page, `location.pathname === '/book/${BOOK}'`, 30_000);
  mark('book-loading');
  await until(page, `document.querySelector('[data-cover-id="${COVER}"]')`, 60_000);
  await until(page, imagesIn, 30_000);
  mark('book');
  await sleep(900);
  for (let i = 0; i < 18; i++) {
    await page.evaluate('window.scrollBy(0, 22)');
    await sleep(45);
  }
  await page.evaluate(`document.querySelector('[data-cover-id="${COVER}"]').scrollIntoView({ block: 'center', behavior: 'smooth' })`);
  await sleep(900);
  await until(page, imagesIn, 20_000);
  mark('pick');
  await tap(page, `document.querySelector('[data-cover-id="${COVER}"]')`);
  await sleep(1200);

  if (process.env.DEBUG_SHOT) {
    const shot = (await page.send('Page.captureScreenshot', { format: 'png' })) as { data: string };
    writeFileSync(process.env.DEBUG_SHOT, Buffer.from(shot.data, 'base64'));
    console.log(await page.evaluate<string>(`[...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean).join(' | ')`));
  }

  // 5. The sheet with the shops.
  // "Details" is a label inside the bar's one button; a click on it bubbles to the bar.
  await tap(page, byText('span', `e.innerText.trim() === 'Details'`));
  await until(page, byText('a', `e.innerText.includes('Bookshop.org')`), 30_000);
  await sleep(700);
  await page.evaluate(`${byText('a', `e.innerText.includes('Bookshop.org')`)}.scrollIntoView({ block: 'center', behavior: 'smooth' })`);
  await sleep(1000);
  mark('shops');
  await sleep(800);
  // The finger rests on the shop, but nothing is clicked: no shop is opened and no /go/ click is counted.
  await tap(page, byText('a', `e.innerText.includes('Bookshop.org')`), 1200, false);
  mark('end');
  filming = false;
  await loop;
  await sleep(300);

  if (!WARM) {
    const t0 = frames[0]?.t ?? now();
    const rel = <T extends { t: number }>(xs: T[]) => xs.map(x => ({ ...x, t: +(x.t - t0).toFixed(3) }));
    writeFileSync(join(OUT, 'take.json'), JSON.stringify({ frames: rel(frames), marks: rel(marks), taps: rel(taps), zone, scale: 3 }, null, 1));
    console.log(`${frames.length} frames, ${(now() - t0).toFixed(1)} s; marks: ${rel(marks).map(m => `${m.name} ${m.t}`).join(', ')}`);
  }
  frames = [];
  await page.close();
}

void main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

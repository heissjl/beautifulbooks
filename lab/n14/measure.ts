/**
 * The N14 measurement as a command (ROADMAP 6.40; the method is 6.30's,
 * docs/history.md 2026-09-11): a page at 390 × 844 and 1280 × 800 in a
 * headless Chrome, and for each width
 *
 *   - lines of text that are cut (`scrollWidth > clientWidth` or
 *     `scrollHeight > clientHeight` on an element whose overflow is not
 *     `visible`): count, and the first few texts;
 *   - every text field's placeholder measured on a canvas in the field's own
 *     font, against the room the field gives it;
 *   - the document's width against the window's — anything wider scrolls
 *     sideways on a phone;
 *   - images that came back empty.
 *
 *   npx tsx lab/n14/measure.ts <url> [--widths 390,1280] [--wait 8000] [--json]
 *
 * Headless Chrome lays nothing out under 500 px (docs/umgang.md §6), so the
 * phone width is set through `Emulation.setDeviceMetricsOverride`, never
 * through the window. Reads only; asks the page once per width.
 */
import { launch } from '../video/screen/cdp';

interface Clip { tag: string; text: string }
interface Field { placeholder: string; textWidth: number; room: number }
export interface Reading {
  width: number;
  height: number;
  innerWidth: number;
  scrollWidth: number;
  clipped: Clip[];
  fields: Field[];
  images: number;
  brokenImages: number;
}

/** The script that runs in the page; pure DOM, no site knowledge. */
export const PROBE = `(() => {
  const clipped = [];
  for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,li,dt,dd,label,summary')) {
    const cs = getComputedStyle(el);
    if (cs.overflow === 'visible' || cs.display === 'inline') continue;
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
      clipped.push({ tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 60) });
    }
  }
  const canvas = document.createElement('canvas').getContext('2d');
  const fields = [];
  for (const input of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
    const cs = getComputedStyle(input);
    canvas.font = cs.font || (cs.fontSize + ' ' + cs.fontFamily);
    const textWidth = Math.round(canvas.measureText(input.placeholder).width);
    const room = Math.round(input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    fields.push({ placeholder: input.placeholder, textWidth, room });
  }
  const imgs = [...document.images];
  return {
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clipped: clipped.slice(0, 12),
    clippedTotal: clipped.length,
    fields,
    images: imgs.length,
    brokenImages: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
  };
})()`;

const SIZES: Record<number, number> = { 390: 844, 1280: 800 };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function measure(url: string, widths: number[], waitMs: number): Promise<Reading[]> {
  const page = await launch(9341);
  const out: Reading[] = [];
  try {
    for (const width of widths) {
      const height = SIZES[width] ?? 800;
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: width < 768 ? 2 : 1, mobile: width < 768 });
      await page.send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, waitMs));
      const r = await page.evaluate<Omit<Reading, 'width' | 'height'> & { clippedTotal: number }>(PROBE);
      out.push({ width, height, ...r, clipped: r.clipped });
    }
  } finally {
    await page.close();
  }
  return out;
}

function report(readings: Reading[]): string {
  const lines: string[] = [];
  for (const r of readings) {
    lines.push(`## ${r.width} × ${r.height}`);
    lines.push(`- page width: ${r.scrollWidth} of ${r.innerWidth}${r.scrollWidth > r.innerWidth ? '  ← scrolls sideways' : ''}`);
    lines.push(`- cut lines: ${r.clipped.length}${r.clipped.length ? ' — ' + r.clipped.map(c => `${c.tag} „${c.text}“`).join('; ') : ''}`);
    for (const f of r.fields) lines.push(`- placeholder „${f.placeholder}“: ${f.textWidth} px in ${f.room} px${f.textWidth > f.room ? '  ← does not fit' : ''}`);
    lines.push(`- images: ${r.images}, empty: ${r.brokenImages}`);
  }
  return lines.join('\n');
}

async function main() {
  const url = process.argv[2];
  if (!url || url.startsWith('--')) throw new Error('usage: npx tsx lab/n14/measure.ts <url> [--widths 390,1280] [--wait 8000] [--json]');
  if (/buyitscovers\.com/.test(url) && !process.argv.includes('--production-once')) {
    throw new Error('Measure against the dev server, not production (CLAUDE.md); say --production-once if this is the one look after a deploy.');
  }
  const widths = (arg('--widths') ?? '390,1280').split(',').map(Number).filter(n => n > 0);
  const waitMs = Number(arg('--wait') ?? 8000);
  const readings = await measure(url, widths, waitMs);
  console.log(process.argv.includes('--json') ? JSON.stringify(readings, null, 1) : report(readings));
}

if (process.argv[1] && /measure\.ts$/.test(process.argv[1])) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

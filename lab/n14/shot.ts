/**
 * A screenshot of a page at a given size and colour scheme, from the same
 * headless Chrome the N14 measurement uses (ROADMAP 6.110f, 2026-10-27): the
 * desktop app's browser pane scales a 1280 px viewport down to its own width
 * and hands back 800 × 500 pictures, too small to judge a layout by.
 *
 *   npx tsx lab/n14/shot.ts <url> <out.png> [--width 1280] [--height 800] [--scheme light|dark]
 *                           [--wait 8000] [--click <js expression that clicks>] [--after 6000]
 *
 * Against the dev server only; an address at buyitscovers.com is refused.
 * Pixel ratio 2, so the file is twice the viewport in pixels.
 */
import { writeFileSync } from 'node:fs';
import { launch } from '../video/screen/cdp';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const [url, out] = [process.argv[2], process.argv[3]];
  if (!url || !out || url.startsWith('--')) throw new Error('usage: npx tsx lab/n14/shot.ts <url> <out.png> [--width 1280] [--height 800] [--scheme light|dark] [--wait ms] [--click js] [--after ms]');
  if (/buyitscovers\.com/.test(url)) throw new Error('Screenshots are taken against the dev server, not production (CLAUDE.md).');
  const width = Number(arg('--width') ?? 1280);
  const height = Number(arg('--height') ?? 800);
  const scheme = arg('--scheme') ?? 'light';
  const page = await launch(9343);
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: width < 768 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    await page.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, Number(arg('--wait') ?? 8000)));
    const click = arg('--click');
    if (click) {
      await page.evaluate(click);
      await new Promise(r => setTimeout(r, Number(arg('--after') ?? 6000)));
    }
    const shot = (await page.send('Page.captureScreenshot', { format: 'png' })) as { data: string };
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(`${out}: ${width} × ${height} ${scheme}${click ? ', after click' : ''}`);
  } finally {
    await page.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

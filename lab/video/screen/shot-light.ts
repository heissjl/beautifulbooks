/**
 * A screenshot of a page in the light colour scheme, whatever the Mac prefers
 * (headless Chrome inherits the system scheme; `--screenshot` came out dark on
 * 2026-10-31). `npx tsx lab/video/screen/shot-light.ts <url> <out.png> <width> <height> <scale>`;
 * the first run made the hero picture Julian posts with replies (ROADMAP 5.6c).
 */
import { writeFileSync } from 'node:fs';
import { launch } from './cdp';
const [url, out, w, h, scale] = process.argv.slice(2);
async function main() {
const page = await launch(9353, false);
await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await page.send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: Number(scale), mobile: false });
await page.send('Page.navigate', { url });
await page.once('Page.loadEventFired');
await new Promise(r => setTimeout(r, 6000));
const bg = await page.evaluate<string>('getComputedStyle(document.body).backgroundColor');
const r = await page.send('Page.captureScreenshot', { format: 'png' }) as { data: string };
writeFileSync(out, Buffer.from(r.data, 'base64'));
console.log('saved', out, 'body bg', bg);
await page.close();
}
main().catch(e => { console.error(e); process.exit(1); });

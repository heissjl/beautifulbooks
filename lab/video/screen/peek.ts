/** Prints a page's text after it settles (5.5b, a look while building the recorder). */
import { launch } from './cdp';

async function main(): Promise<void> {
  const page = await launch();
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: process.argv[2] });
  await new Promise(r => setTimeout(r, Number(process.argv[3] ?? 15000)));
  console.log(await page.evaluate<string>('document.body.innerText'));
  await page.close();
}

void main();

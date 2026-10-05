// Renders an SVG from this folder to a PNG at an exact size, with the site's
// fonts (loaded from ../fonts and ../og), through headless Chrome.
//
//   node assets/social/render.mjs <file.svg> <out.png> <width> <height>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [src, out, w, h] = process.argv.slice(2);
if (!src || !out || !w || !h) {
  console.error('usage: node render.mjs <file.svg> <out.png> <width> <height>');
  process.exit(1);
}
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9335;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/bic-social-render', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let ws;
  for (let i = 0; i < 40 && !ws; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      ws = tabs.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {}
    if (!ws) await sleep(300);
  }
  const sock = new WebSocket(ws);
  await new Promise((r) => (sock.onopen = r));
  let id = 0;
  const pending = new Map();
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(path.resolve(src)).href });
  await sleep(2500); // fonts
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  sock.close();
} finally {
  proc.kill();
}

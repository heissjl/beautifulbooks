/**
 * What one visit costs, per page type (ROADMAP 2.18b).
 *
 *   npx tsx lab/visitcost/run.ts            # build, then measure
 *   npx tsx lab/visitcost/run.ts --no-build # measure the last build of this script
 *
 * Builds the site into `.next-visitcost` (its data cache emptied first) with a fixed environment (nothing
 * from .env files, a fake Redis, a fake catalogue — intercept.cjs), starts
 * `next start`, and visits each page type twice in a fresh headless Chrome
 * profile: once cold (the server's data cache holds only what the build
 * fetched) and once warm. For each visit it records what the browser asked
 * this server for, what the server asked the catalogue and Redis for, and the
 * bytes. Writes lab/visitcost/results.json and prints a table.
 *
 * What a request to this server would cost on Vercel is a model, not a
 * measurement: a static file and a prerendered page are CDN hits; an answer
 * with `s-maxage` is a CDN hit for the second reader; everything else is a
 * function invocation every time.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const PORT = 3471;
const CDP_PORT = 9471;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const LOG = join(tmpdir(), `visitcost-${process.pid}.jsonl`);
const DIST = '.next-visitcost';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** The page types of PLAN-2.18 §3, each as a reader reaches it. */
const SCENARIOS: Array<{ id: string; path: string; note: string }> = [
  { id: 'home', path: '/', note: 'Startseite' },
  { id: 'search', path: '/?q=the%20great%20gatsby', note: 'Suche mit Trefferliste und Mosaiken' },
  { id: 'book', path: '/book/OL468431W', note: 'Buchseite, kuratiert (Gatsby, drei Ausgabenseiten)' },
  { id: 'book-cover', path: '/book/OL468431W?cover=ol%3A14369845', note: 'Buchseite mit gewähltem Cover (Vermerk; ISBN 9783730600009)' },
  { id: 'decades', path: '/book/OL1168083W/decades', note: 'Jahrzehnte-Seite' },
  { id: 'collections', path: '/collections', note: 'Sammlungen, Übersicht' },
  { id: 'collection', path: '/collections/sf-masterworks', note: 'Eine Sammlung' },
  { id: 'versus', path: '/versus', note: 'Das Spiel' },
  { id: 'about', path: '/about', note: 'About (statisch)' },
];

/** Exactly these variables; .env files are not read (Next loads them from the project only by name, and none exist here). */
function env(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_DIST_DIR: DIST,
    // Quoted: the repository lives under "Mobile Documents".
    NODE_OPTIONS: `--require "${join(__dirname, 'intercept.cjs')}"`,
    VISITCOST_LOG: LOG,
    VISITCOST_REDIS_HOST: 'redis.visitcost.test',
    // The REST pair wins over a direct connection (storeConfig), so every command reaches the fake.
    STORAGE_KV_REST_API_URL: 'https://redis.visitcost.test',
    STORAGE_KV_REST_API_TOKEN: 'visitcost',
    GOOGLE_BOOKS_API_KEY: 'visitcost',
    HOTORNOT: 'on',
    WALLS: 'on',
    NEXT_PUBLIC_SITE_URL: 'https://buyitscovers.com',
    NEXT_PUBLIC_SITE_MODE: 'hobby',
    IMPRINT_NAME: 'Visit Cost', IMPRINT_STREET: 'Street 1', IMPRINT_CITY: '10000 City', IMPRINT_EMAIL: 'visitcost@example.com',
  };
}

function run(cmd: string, args: string[], extra: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...env(), ...extra }, stdio: 'inherit' });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
  });
}

async function waitFor(url: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { if ((await fetch(url)).status < 500) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`${url} did not come up`);
}

// --- a minimal DevTools protocol client over Node's WebSocket ---
type CdpEvent = { method: string; params: Record<string, unknown>; sessionId?: string };
class Cdp {
  private next = 1;
  private pending = new Map<number, (v: { result?: unknown; error?: unknown }) => void>();
  listeners: Array<(e: CdpEvent) => void> = [];
  constructor(private ws: WebSocket) {
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)!(msg);
        this.pending.delete(msg.id);
      } else if (msg.method) for (const l of this.listeners) l(msg);
    });
  }
  static async open(url: string): Promise<Cdp> {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
    return new Cdp(ws);
  }
  send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> {
    const id = this.next++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, msg => (msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result as T)));
    });
  }
  close(): void { this.ws.close(); }
}

interface Req {
  url: string;
  type: string;
  status?: number;
  bytes: number;
  cacheControl?: string;
  nextCache?: string;
  failed?: boolean;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function visit(cdp: Cdp, path: string): Promise<Req[]> {
  const { browserContextId } = await cdp.send<{ browserContextId: string }>('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
  const reqs = new Map<string, Req>();
  let inflight = 0;
  let lastActivity = Date.now();
  const listener = (e: CdpEvent) => {
    if (e.sessionId !== sessionId) return;
    const p = e.params as Record<string, never>;
    if (e.method === 'Network.requestWillBeSent') {
      const r = p.request as { url: string };
      if (!r.url.startsWith('http')) return;
      reqs.set(p.requestId, { url: r.url, type: String(p.type ?? ''), bytes: 0 });
      inflight++; lastActivity = Date.now();
    } else if (e.method === 'Network.responseReceived') {
      const req = reqs.get(p.requestId);
      const res = p.response as { status: number; headers: Record<string, string> };
      if (req) {
        const h = Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k.toLowerCase(), v]));
        req.status = res.status; req.cacheControl = h['cache-control']; req.nextCache = h['x-nextjs-cache'];
      }
    } else if (e.method === 'Network.loadingFinished' || e.method === 'Network.loadingFailed') {
      const req = reqs.get(p.requestId);
      if (req) {
        if (e.method === 'Network.loadingFinished') req.bytes = Number(p.encodedDataLength ?? 0);
        else req.failed = true;
        inflight = Math.max(0, inflight - 1); lastActivity = Date.now();
      }
    }
  };
  cdp.listeners.push(listener);
  await cdp.send('Network.enable', {}, sessionId);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false }, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url: ORIGIN + path }, sessionId);

  const idle = async (quietMs: number, maxMs: number) => {
    const until = Date.now() + maxMs;
    while (Date.now() < until) {
      if (inflight === 0 && Date.now() - lastActivity > quietMs) return;
      await sleep(250);
    }
  };
  await idle(2500, 60_000);
  // Scroll the page down in steps, as a reader would, so lazy images ask too.
  for (let i = 0; i < 40; i++) {
    const { result } = await cdp.send<{ result: { value: boolean } }>('Runtime.evaluate', {
      expression: 'window.scrollBy(0, 700); window.innerHeight + window.scrollY >= document.body.scrollHeight - 2',
      returnByValue: true,
    }, sessionId);
    await sleep(300);
    if (result.value) break;
  }
  await idle(2500, 60_000);
  // Leaving the page sends the one summary (/api/seen, ROADMAP 3.1b).
  await cdp.send('Page.navigate', { url: 'about:blank' }, sessionId);
  await sleep(1500);
  cdp.listeners = cdp.listeners.filter(l => l !== listener);
  await cdp.send('Target.closeTarget', { targetId });
  await cdp.send('Target.disposeBrowserContext', { browserContextId });
  return [...reqs.values()];
}

type Klass = 'static' | 'document' | 'rsc' | 'img' | 'api' | 'other' | 'foreign';
function klass(r: Req): Klass {
  if (!r.url.startsWith(ORIGIN)) return 'foreign';
  const u = new URL(r.url);
  if (u.pathname.startsWith('/img/') || u.pathname.startsWith('/_next/image')) return 'img';
  if (u.pathname.startsWith('/api/')) return 'api';
  if (u.pathname.startsWith('/_next/static/') || /\.(js|css|woff2?|svg|png|ico|jpg|webp|txt|webmanifest|json)$/.test(u.pathname)) return 'static';
  if (u.searchParams.has('_rsc')) return 'rsc';
  if (r.type === 'Document') return 'document';
  return 'other';
}

/** On Vercel: CDN for everyone, CDN for the second reader, or a function every time. */
function vercelModel(r: Req, k: Klass): 'cdn' | 'cdn-after-first' | 'function' {
  if (k === 'static') return 'cdn';
  if (r.nextCache === 'HIT' || r.nextCache === 'STALE') return 'cdn';
  if (/s-maxage=\d+/.test(r.cacheControl ?? '') && !/no-store|private/.test(r.cacheControl ?? '')) return 'cdn-after-first';
  return 'function';
}

function readLog(from: number): Array<{ kind: string; cmd?: string; key?: string; host?: string; path?: string; bytes?: number }> {
  if (!existsSync(LOG)) return [];
  return readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(e => e.t >= from);
}

async function main() {
  const build = !process.argv.includes('--no-build');
  rmSync(LOG, { force: true });
  if (build) {
    // Cold means cold: nothing the catalogue answered last time may be in the cache.
    rmSync(join(ROOT, DIST, 'cache', 'fetch-cache'), { recursive: true, force: true });
    await run('npx', ['next', 'build']);
  }
  const buildCalls = readLog(0);
  rmSync(LOG, { force: true });

  // Production's behaviour at run time — the analytics write only there. Not in the build:
  // there it would turn on the image optimizer (2.18o), which `next start` cannot stand in for.
  const server: ChildProcess = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], { cwd: ROOT, env: { ...env(), VERCEL_ENV: 'production' }, stdio: 'ignore' });
  const profile = mkdtempSync(join(tmpdir(), 'visitcost-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  try {
    await waitFor(`${ORIGIN}/about`, 120_000);
    await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`, 30_000);
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json() as { webSocketDebuggerUrl: string };
    const cdp = await Cdp.open(webSocketDebuggerUrl);
    // The warm-up asked /about once; nothing else has been asked yet.
    const results = [];
    for (const pass of ['cold', 'warm'] as const) {
      for (const s of SCENARIOS) {
        const from = Date.now();
        const reqs = await visit(cdp, s.path);
        await sleep(500);
        const calls = readLog(from);
        const byKlass: Record<string, { n: number; bytes: number }> = {};
        const model = { cdn: 0, 'cdn-after-first': 0, function: 0 };
        for (const r of reqs) {
          const k = klass(r);
          byKlass[k] ??= { n: 0, bytes: 0 };
          byKlass[k].n++; byKlass[k].bytes += r.bytes;
          if (k !== 'foreign') model[vercelModel(r, k)]++;
        }
        // The CPU meter flushes at most every 30 s per instance (2.18l); its HINCRBYs land in
        // whichever visit is running then, so they are counted apart, not charged to the page.
        const isCpuFlush = (c: { key?: string }) => /:cpu$/.test(c.key ?? '');
        const redis: Record<string, number> = {};
        const redisKeys: Record<string, number> = {};
        for (const c of calls.filter(c => c.kind === 'redis' && !isCpuFlush(c))) {
          redis[c.cmd!] = (redis[c.cmd!] ?? 0) + 1;
          redisKeys[`${c.cmd} ${c.key}`] = (redisKeys[`${c.cmd} ${c.key}`] ?? 0) + 1;
        }
        const cpuFlush = calls.filter(c => c.kind === 'redis' && isCpuFlush(c)).length;
        const ol: Record<string, number> = {};
        for (const c of calls.filter(c => c.kind === 'openlibrary' || c.kind === 'google')) {
          const k = `${c.kind} ${(c.path ?? '').replace(/OL\d+[WMA]/g, '<id>')}`;
          ol[k] = (ol[k] ?? 0) + 1;
        }
        const functions = reqs.filter(r => klass(r) !== 'foreign' && vercelModel(r, klass(r)) !== 'cdn')
          .map(r => `${vercelModel(r, klass(r))} ${klass(r)} ${new URL(r.url).pathname.replace(/OL\d+W/g, '<work>').replace(/(ol|gb)-[\w.-]+/g, '<cover>')}${new URL(r.url).search.replace(/OL\d+W/g, '<work>').slice(0, 60)}`);
        const functionList: Record<string, number> = {};
        for (const f of functions.filter(f => !f.includes(' img '))) functionList[f] = (functionList[f] ?? 0) + 1;
        const row = {
          pass, id: s.id, path: s.path, note: s.note,
          requests: reqs.length,
          failed: reqs.filter(r => r.failed || (r.status ?? 0) >= 500).map(r => `${r.status ?? 'x'} ${r.url.replace(ORIGIN, '')}`),
          bytes: reqs.reduce((sum, r) => sum + r.bytes, 0),
          byKlass, model,
          openLibrary: calls.filter(c => c.kind === 'openlibrary').length,
          google: calls.filter(c => c.kind === 'google').length,
          images: calls.filter(c => c.kind === 'image').length,
          blocked: calls.filter(c => c.kind === 'blocked').map(c => c.host),
          redis, redisKeys, redisCommands: Object.values(redis).reduce((a, b) => a + b, 0), cpuFlush,
          catalogue: ol, functionList,
        };
        results.push(row);
        console.log(`${pass.padEnd(4)} ${s.id.padEnd(12)} req ${String(row.requests).padStart(3)}  fn ${String(model.function).padStart(3)}  cdn2 ${String(model['cdn-after-first']).padStart(3)}  OL ${String(row.openLibrary).padStart(3)}  G ${row.google}  redis ${String(row.redisCommands).padStart(3)}  ${(row.bytes / 1024).toFixed(0)} KB`);
      }
    }
    cdp.close();
    const out = { measuredAt: new Date().toISOString(), viewport: '1280x800', buildCalls: buildCalls.length, results };
    writeFileSync(join(__dirname, 'results.json'), JSON.stringify(out, null, 2) + '\n');
    console.log(`\nbuild asked the fakes ${buildCalls.length} times; results in lab/visitcost/results.json`);
  } finally {
    server.kill();
    // Chrome writes its profile until it has exited; removing it earlier fails with ENOTEMPTY.
    await new Promise(resolve => { chrome.once('exit', resolve); chrome.kill(); });
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch(err => { console.error(err); process.exit(1); });

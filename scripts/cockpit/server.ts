/**
 * The Cockpit's local server (ROADMAP 6.54, proposal §5 way c; Julian's
 * answer 4, 2026-09-25: tools start per click through a small local server).
 *
 * The guard rails, each enforced here and tested in guard.ts:
 *   - binds **127.0.0.1 only**, and answers only when the Host header names
 *     127.0.0.1 or localhost on its port (a DNS-rebinding page gets nothing);
 *   - every request carries a **random token** made at start: in the page
 *     URL, then as a header; a POST from another origin is refused;
 *   - it starts **only catalogue entries**, by id, with the argv from
 *     tools.ts and no shell of its choosing; never a command line from the
 *     browser; „Beenden" only for processes it started itself;
 *   - a secret value leaves `.env.local` only as the answer to one „zeigen"
 *     click, and only the main folder's file is read;
 *   - production is asked once at start and then only on the button, at
 *     most once a minute (Vercel's bot mitigation, CLAUDE.md);
 *   - screenshots only of pages the site map allows (never /book/…, whose
 *     cold render spends the Google quota) and only from a running dev server.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, watch } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { connect } from 'node:net';
import path from 'node:path';
import type { CockpitData } from './collect';
import { hostAllowed, makeToken, originAllowed, shotFileName, tokenMatches } from './guard';
import { SERVER_SLOT } from './render';
import type { Tool } from './tools';

export interface ServerDeps {
  root: string;
  port: number;
  /** Rebuilds data and page; `remote` asks production again. */
  regenerate(remote: boolean): Promise<{ data: CockpitData; html: string }>;
  readLocalEnv(): Map<string, string> | null;
  chrome: string | null;
}

interface Proc { child: ChildProcess; output: string; exit: number | null; running: boolean }

function probeHost(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = connect({ host, port });
    const done = (up: boolean) => { socket.destroy(); resolve(up); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** Up on IPv4 or IPv6 loopback: `next dev` listens on ::1 only on some machines (measured 2026-09-25). */
export async function probePort(port: number, timeoutMs = 400): Promise<boolean> {
  const [v4, v6] = await Promise.all([probeHost('127.0.0.1', port, timeoutMs), probeHost('::1', port, timeoutMs)]);
  return v4 || v6;
}

export async function probePorts(ports: number[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  await Promise.all([...new Set(ports)].map(async p => { out[p] = await probePort(p); }));
  return out;
}

function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 10_000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

export async function startServer(deps: ServerDeps, first: { data: CockpitData; html: string }): Promise<{ url: string; close(): void }> {
  const token = makeToken();
  let current = first;
  let generation = 1;
  let lastRemote = Date.now();
  const procs = new Map<string, Proc>();
  const shotsDir = path.join(deps.root, 'docs', 'cockpit', 'shots');

  const send = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  const tool = (id: unknown): Tool | undefined => current.data.tools.find(t => t.id === id);

  const regenerate = async (remote: boolean) => {
    current = await deps.regenerate(remote);
    generation++;
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${deps.port}`);
    if (!hostAllowed(req.headers.host, deps.port)) { res.writeHead(421); res.end(); return; }
    if (req.method === 'POST' && !originAllowed(req.headers.origin, deps.port)) return send(res, 403, { error: 'fremder Ursprung' });

    if (url.pathname === '/' && req.method === 'GET') {
      if (!tokenMatches(url.searchParams.get('t'), token)) { res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Das Cockpit braucht den Link mit Token, den `npm run cockpit` ausgibt.'); return; }
      const html = current.html.replace(SERVER_SLOT, `<script>window.COCKPIT_SERVER=${JSON.stringify({ token })};</script>`);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
      res.end(html);
      return;
    }
    if (url.pathname.startsWith('/shots/') && req.method === 'GET') {
      const name = path.basename(url.pathname);
      const file = path.join(shotsDir, name);
      if (!tokenMatches(url.searchParams.get('t'), token) || !/^[\w-]+\.png$/.test(name) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      res.end(readFileSync(file));
      return;
    }
    if (!url.pathname.startsWith('/api/')) { res.writeHead(404); res.end(); return; }
    if (!tokenMatches(req.headers['x-cockpit-token'] as string | undefined, token)) return send(res, 403, { error: 'Token fehlt' });

    if (url.pathname === '/api/status') {
      const ports = await probePorts(current.data.tools.flatMap(t => (t.port ? [t.port] : [])));
      const processes = Object.fromEntries([...procs].map(([id, p]) => [id, { running: p.running, exit: p.exit, output: p.output.slice(-4000) }]));
      return send(res, 200, { generation, ports, processes });
    }
    if (url.pathname === '/api/secret') {
      const name = url.searchParams.get('name') ?? '';
      const value = deps.readLocalEnv()?.get(name);
      return value === undefined ? send(res, 404, { error: `${name} steht nicht in der .env.local des Hauptordners` }) : send(res, 200, { value });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'POST' });
    const input = await body(req);

    if (url.pathname === '/api/run') {
      const t = tool(input.id);
      if (!t?.argv) return send(res, 400, { error: 'Nicht im Katalog oder nicht startbar' });
      if (procs.get(t.id)?.running) return send(res, 409, { error: 'läuft schon' });
      if (t.kind === 'server' && t.port && (await probePorts([t.port]))[t.port]) return send(res, 409, { error: `Port ${t.port} ist schon belegt` });
      const local = deps.readLocalEnv();
      const fromLocal = Object.fromEntries((t.envFromLocal ?? []).map(n => [n, local?.get(n)]).filter((e): e is [string, string] => typeof e[1] === 'string'));
      const child = spawn(t.argv[0], t.argv.slice(1), {
        cwd: deps.root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...(t.env ?? {}), ...fromLocal, FORCE_COLOR: '0' },
      });
      const p: Proc = { child, output: '', exit: null, running: true };
      const append = (chunk: Buffer) => { p.output = (p.output + chunk.toString()).slice(-20_000); };
      child.stdout?.on('data', append);
      child.stderr?.on('data', append);
      child.on('exit', code => { p.running = false; p.exit = code; });
      child.on('error', err => { p.running = false; p.output += `\n${err.message}`; });
      procs.set(t.id, p);
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/api/stop') {
      const p = procs.get(String(input.id));
      if (!p?.running || !p.child.pid) return send(res, 400, { error: 'Nur, was das Cockpit selbst gestartet hat' });
      try { process.kill(-p.child.pid, 'SIGTERM'); } catch { p.child.kill('SIGTERM'); }
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/api/refresh-remote') {
      if (Date.now() - lastRemote < 60_000) return send(res, 429, { error: 'Produktion höchstens einmal je Minute (Bot-Schutz von Vercel)' });
      lastRemote = Date.now();
      await regenerate(true);
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/api/shot') {
      const route = current.data.site.find(r => r.kind === 'page' && r.shot && r.example === input.path);
      const width = Number(input.width) === 500 ? 500 : 1280;
      if (!route) return send(res, 400, { error: 'Diese Seite fotografiert das Cockpit nicht' });
      if (!deps.chrome) return send(res, 503, { error: 'Chrome nicht gefunden' });
      if (!(await probePorts([3000]))[3000]) return send(res, 503, { error: 'Der Dev-Server läuft nicht auf :3000' });
      mkdirSync(shotsDir, { recursive: true });
      const name = shotFileName(route.example ?? '/', width);
      const file = path.join(shotsDir, name);
      const height = width === 500 ? 900 : 800;
      const code = await new Promise<number | null>(resolve => {
        const c = spawn(deps.chrome!, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=8000', `--window-size=${width},${height}`, `--screenshot=${file}`, `http://localhost:3000${route.example}`], { stdio: 'ignore' });
        const timer = setTimeout(() => c.kill('SIGKILL'), 40_000);
        c.on('exit', x => { clearTimeout(timer); resolve(x); });
        c.on('error', () => { clearTimeout(timer); resolve(1); });
      });
      if (code !== 0 || !existsSync(file)) return send(res, 500, { error: 'Chrome hat kein Bild geliefert' });
      return send(res, 200, { url: `/shots/${name}`, file: path.relative(deps.root, file) });
    }
    return send(res, 404, { error: 'unbekannt' });
  });

  // Regenerate when a source changes; never on the Cockpit's own output.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ignored = (full: string) => {
    const rel = path.relative(deps.root, full);
    return rel.startsWith(path.join('docs', 'cockpit')) || rel === path.join('docs', 'worktrees.md') || /\.tmp$|node_modules|\.next|cache\.json$/.test(rel);
  };
  const onChange = (base: string) => (_e: string, file: string | Buffer | null) => {
    if (ignored(path.join(base, String(file ?? '')))) return;
    clearTimeout(timer);
    timer = setTimeout(() => { regenerate(false).catch(err => console.error('Neu erzeugen misslang:', err)); }, 1500);
  };
  const watchers = ['ROADMAP.md', 'docs', 'lab', 'app', 'data', 'scripts', 'package.json', '.env.example']
    .map(p => path.join(deps.root, p)).filter(existsSync)
    .map(p => {
      const base = p.endsWith('.md') || p.endsWith('.json') || p.endsWith('.example') ? path.dirname(p) : p;
      try { return watch(p, { recursive: true }, onChange(base)); } catch { return null; }
    });

  await new Promise<void>(resolve => server.listen(deps.port, '127.0.0.1', resolve));
  const close = () => {
    for (const w of watchers) w?.close();
    for (const p of procs.values()) if (p.running && p.child.pid) { try { process.kill(-p.child.pid, 'SIGTERM'); } catch { /* gone */ } }
    server.close();
  };
  return { url: `http://127.0.0.1:${deps.port}/?t=${token}`, close };
}

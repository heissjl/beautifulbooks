/**
 * The Cockpit (ROADMAP 6.54): one page that leads from an overview into the
 * depth of the project — roadmap as a board by theme and status, the
 * collection layers and where they differ, tools to start, services and
 * settings, features, the site's routes, the lab, the artefacts.
 *
 *   npm run cockpit                    # writes docs/cockpit.html, serves it on 127.0.0.1:4320
 *   npm run cockpit -- --build         # only the file (asks production once)
 *   npm run cockpit -- --build --offline   # the file, with the last read of production (docs/cockpit/production.json)
 *   npm run cockpit -- --fetch         # `git fetch origin` first
 *   npm run kanban                     # alias: --build, prints the board's address
 *
 * **Generated, never hand-edited, and a view — never a second list.** Every
 * number comes from ROADMAP.md, docs/, lab/, app/, package.json, git, the
 * names in the main `.env.local` and `vercel env ls`, and one read of
 * production's collection layers. The output is git-ignored. It replaces
 * docs/kanban.html (Julian, 2026-09-25).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { collect, type CockpitData } from './collect';
import { parseEnv, parseVercelEnvLs, type VercelVar } from './env';
import { git, mainRoot } from './git';
import { readProduction, skippedSnapshot, type ProductionSnapshot } from './production';
import { renderPage } from './render';
import { listenerOn, scriptOf } from './listeners';
import { probePorts, startServer } from './server';
import { LIVE } from './tools';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs', 'cockpit.html');
/** The last read of production, git-ignored: `--offline` shows it with its date instead of asking again. */
const SNAPSHOT = path.join(ROOT, 'docs', 'cockpit', 'production.json');
const args = new Set(process.argv.slice(2));
const PORT = Number(process.env.COCKPIT_PORT ?? 4320);

function readLocalEnv(): Map<string, string> | null {
  const file = path.join(mainRoot(ROOT), '.env.local');
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : null;
}

function vercelEnv(): VercelVar[] | null {
  try {
    const out = execFileSync('vercel', ['env', 'ls'], { cwd: mainRoot(ROOT), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
    const vars = parseVercelEnvLs(out);
    return vars.length ? vars : null;
  } catch {
    return null;
  }
}

function findChrome(): string | null {
  const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  return candidates.find(existsSync) ?? null;
}

let snapshot: ProductionSnapshot;

function lastSnapshot(): ProductionSnapshot | null {
  try {
    const s = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as ProductionSnapshot;
    return { ...s, notes: [`Mit --offline erzeugt: Stand der letzten Abfrage vom ${new Date(s.at).toLocaleString('de-DE')}, nicht neu gefragt.`, ...s.notes] };
  } catch {
    return null;
  }
}
let vercel: VercelVar[] | null = null;

async function build(remote: boolean): Promise<{ data: CockpitData; html: string }> {
  if (remote) {
    if (args.has('--offline')) snapshot = lastSnapshot() ?? skippedSnapshot(LIVE, 'Mit --offline erzeugt: Produktion nicht gefragt.');
    else {
      snapshot = await readProduction(LIVE, readLocalEnv()?.get('SUGGEST_ADMIN_PASSWORD'));
      if (snapshot.drafts) { mkdirSync(path.dirname(SNAPSHOT), { recursive: true }); writeFileSync(SNAPSHOT, JSON.stringify(snapshot)); }
    }
  }
  const localEnv = readLocalEnv();
  // The ports of the catalogue are only known after collecting; probe the usual ones first.
  const ports = await probePorts([3000, 4321, 4322, 4323, 4324]);
  const listeners: Record<string, { cwd: string; script: string | null }> = {};
  for (const [port, up] of Object.entries(ports)) {
    const l = up ? listenerOn(Number(port)) : null;
    if (l) listeners[port] = { cwd: l.cwd, script: scriptOf(l.command) };
  }
  const data = collect({ root: ROOT, snapshot, vercel, localEnvNames: localEnv ? new Set([...localEnv.keys()]) : null, localEnv, ports, listeners });
  const html = renderPage(data);
  writeFileSync(OUT, html, 'utf8');
  return { data, html };
}

function summary(data: CockpitData): string {
  const count = (s: string) => data.items.filter(i => i.status === s).length;
  const act = data.sync.rows.filter(r => r.verdicts.some(v => v.level === 'act'));
  return [
    `geschrieben: ${path.relative(ROOT, OUT)}`,
    data.statuses.map(s => `${s.name}: ${count(s.id)}`).join(' · '),
    `Hinweise: ${data.hints.length} (${data.hints.filter(h => h.level === 'act').length} zu tun)`,
    `Sammlungen: ${data.sync.rows.length}, davon ${act.length} mit offener Synchronisation${act.length ? ' (' + act.map(r => r.slug).join(', ') + ')' : ''}`,
    `Produktion: ${data.sync.remote.publishRoute === 'skipped' ? 'nicht gefragt' : `${data.sync.remote.drafts ?? '?'} Entwürfe, Schalter ${data.sync.remote.publishRoute === 'ok' ? 'gelesen' : 'unbekannt'}`}`,
  ].join('\n');
}

async function main() {
  if (args.has('--fetch')) git(['fetch', 'origin', '--quiet'], ROOT);
  vercel = vercelEnv();
  const first = await build(true);
  console.log(summary(first.data));
  for (const n of first.data.sync.remote.notes) console.log(`  ${n}`);
  if (args.has('--build')) {
    if (args.has('--board')) console.log(`Brett: file://${OUT}#board`);
    return;
  }
  const server = await startServer({ root: ROOT, port: PORT, regenerate: build, readLocalEnv, chrome: findChrome() }, first);
  console.log(`\nCockpit: ${server.url}\n(nur auf diesem Rechner; Strg-C beendet es und alles, was es gestartet hat)`);
  if (!args.has('--no-open') && process.platform === 'darwin') {
    try { execFileSync('open', [server.url]); } catch { /* print is enough */ }
  }
  const stop = () => { server.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});

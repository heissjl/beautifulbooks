/**
 * Who listens on a port, and from which folder (ROADMAP 6.54). Answers the
 * question „läuft?" for two servers that share a port (lab/collections and
 * lab/duel, both :4322), and tells which checkout's data/collections.json the
 * running collection tool writes. macOS/Linux `lsof`; null where it is
 * missing — unknown, never "nobody".
 */
import { execFileSync } from 'node:child_process';

export interface Listener { pid: number; cwd: string; command: string }

function run(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 });
  } catch {
    return null;
  }
}

/** lsof -Fn output → the cwd path. */
export function parseCwd(out: string): string | null {
  return out.split('\n').find(l => l.startsWith('n'))?.slice(1) ?? null;
}

export function listenerOn(port: number): Listener | null {
  const pids = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
  const pid = Number(pids?.split('\n')[0]);
  if (!pid) return null;
  const cwd = parseCwd(run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']) ?? '');
  const command = (run('ps', ['-o', 'command=', '-p', String(pid)]) ?? '').trim();
  return cwd ? { pid, cwd, command } : null;
}

/** The script a node/tsx command line runs: the last argument that looks like a repository path. */
export function scriptOf(command: string): string | null {
  const m = [...command.matchAll(/(?:^|\s)((?:lab|scripts)\/[\w./-]+\.ts|next dev|next-server|npm run dev)/g)];
  return m.length ? m[m.length - 1][1] : /next/.test(command) ? 'next dev' : null;
}

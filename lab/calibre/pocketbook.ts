/**
 * The PocketBook highlights sync, started from the app (ROADMAP 5.16b).
 *
 * Julian, 2026-10-03: „maybe include the pocketbook app from the other
 * project in it?" — decided as a button that runs his script as it is. The
 * script (`sync_highlights.py`, github.com/heissjl/pocketbook-sync) stays in
 * its own repository and is not changed or copied; this file only finds it,
 * says whether a sync can run, and runs it.
 *
 * The command is fixed here — `python3 <script>`, no arguments, in the
 * script's folder — and nothing of it comes from a request. The script asks
 * questions on a terminal when a path is missing; started from the app it has
 * no terminal, so a sync is offered only when its configuration is complete
 * and the reader is connected.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface PocketbookStatus {
  /** The script, when it was found. */
  script?: string;
  /** Where the reader is expected, and whether it is there now. */
  reader?: string;
  connected: boolean;
  /** Where the notes go. */
  notes?: string;
  /** Why a sync cannot run; empty when it can. */
  problems: string[];
}

interface SyncConfig {
  pocketbook_path?: string;
  obsidian_vault_path?: string;
  notes_vault_path?: string;
}

/** What the configuration and the file system say about a sync. Pure but for `exists`. */
export function pocketbookStatus(script: string | undefined, config: SyncConfig | null, exists: (path: string) => boolean): PocketbookStatus {
  const problems: string[] = [];
  if (!script) problems.push('The sync script was not found. Set POCKETBOOK_SYNC to the path of sync_highlights.py.');
  if (!config) problems.push('The sync is not set up yet: run python3 setup.py in the pocketbook project once.');
  const reader = config?.pocketbook_path;
  const notes = config?.notes_vault_path ?? config?.obsidian_vault_path;
  if (config && !reader) problems.push('The configuration names no reader path. Run python3 setup.py in the pocketbook project.');
  if (config && !notes) problems.push('The configuration names no notes folder. Run python3 setup.py in the pocketbook project.');
  // The reader's database is what the script reads; the mounted volume alone is not enough.
  const connected = !!reader && exists(join(reader, 'system', 'config', 'books.db'));
  if (reader && !connected) problems.push(`The reader is not connected (${reader}). Plug it in by USB and wait until it shows in Finder.`);
  if (notes && !exists(notes)) problems.push(`The notes folder is not there: ${notes}`);
  return { ...(script ? { script } : {}), ...(reader ? { reader } : {}), connected, ...(notes ? { notes } : {}), problems };
}

/** POCKETBOOK_SYNC, then the neighbouring project (from the main folder or from a worktree), then the README's clone location. */
export function findSyncScript(root: string): string | undefined {
  const candidates = [
    process.env.POCKETBOOK_SYNC,
    join(root, '..', 'pocketbook', 'sync_highlights.py'),
    join(root, '..', '..', '..', '..', 'pocketbook', 'sync_highlights.py'),
    join(homedir(), 'pocketbook-sync', 'sync_highlights.py'),
  ];
  return candidates.find((p): p is string => !!p && existsSync(p));
}

export function readSyncConfig(): SyncConfig | null {
  const file = process.env.POCKETBOOK_CONFIG ?? join(homedir(), '.pocketbook_sync_config.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as SyncConfig;
  } catch {
    return null;
  }
}

export interface SyncRun {
  ok: boolean;
  /** What the script printed, as it printed it. */
  output: string;
}

/** Runs the script once and hands back what it said. Never rejects. */
export function runSync(script: string, timeoutMs = 180_000): Promise<SyncRun> {
  return new Promise((done) => {
    let output = '';
    const child = spawn('/usr/bin/python3', [script], { cwd: dirname(script), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONUNBUFFERED: '1' } });
    const timer = setTimeout(() => {
      output += '\n[stopped: the sync did not finish in time]';
      child.kill();
    }, timeoutMs);
    const take = (chunk: Buffer) => {
      if (output.length < 200_000) output += chunk.toString('utf8');
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (err) => {
      clearTimeout(timer);
      done({ ok: false, output: `${output}\n${err.message}`.trim() });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ ok: code === 0, output: output.trim() });
    });
  });
}

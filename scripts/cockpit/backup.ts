/**
 * The last copy of the store (ROADMAP 2.11, lib/backup.ts): the Cockpit looks
 * into the backup folder beside the main checkout — `../bb-backups`, or
 * `BB_BACKUP_DIR` — and says how old the newest complete copy is. Only the
 * **last line** of a file is read, the footer with the key count and
 * `complete`; never a record, because the files hold what readers typed and
 * the hashes of their ids, and nothing of that belongs in docs/cockpit.html.
 */
import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import path from 'node:path';

export interface BackupFile {
  name: string;
  kb: number;
  /** ISO, the file's modification time. */
  mtime: string;
  keys: number | null;
  /** From the footer; null when the last line is not a footer. */
  complete: boolean | null;
}

export interface BackupStatus {
  dir: string;
  exists: boolean;
  /** Newest first. */
  files: BackupFile[];
  /** `.tmp` files: exports that broke off and were kept for a look. */
  tmp: number;
  /** The newest complete copy. */
  latest: BackupFile | null;
  /** Days since `latest`, one decimal; null without one. */
  ageDays: number | null;
}

export function backupDir(mainRoot: string, env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.BB_BACKUP_DIR ?? path.resolve(mainRoot, '..', 'bb-backups'));
}

/** The last non-empty line of a file, read from its tail only. */
function lastLine(file: string, size: number): string | null {
  const span = Math.min(size, 64 * 1024);
  if (span === 0) return null;
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(span);
    readSync(fd, buf, 0, span, size - span);
    const lines = buf.toString('utf8').split('\n').map(l => l.trim()).filter(Boolean);
    return lines.length ? lines[lines.length - 1] : null;
  } finally {
    closeSync(fd);
  }
}

function footerOf(file: string, size: number): { keys: number | null; complete: boolean | null } {
  try {
    const line = lastLine(file, size);
    if (!line) return { keys: null, complete: null };
    const f = JSON.parse(line) as { kind?: string; keys?: number; complete?: boolean };
    if (f.kind !== 'footer') return { keys: null, complete: null };
    return { keys: typeof f.keys === 'number' ? f.keys : null, complete: f.complete === true };
  } catch {
    return { keys: null, complete: null };
  }
}

export function readBackupStatus(dir: string, now: Date = new Date()): BackupStatus {
  if (!existsSync(dir)) return { dir, exists: false, files: [], tmp: 0, latest: null, ageDays: null };
  const names = readdirSync(dir);
  const tmp = names.filter(n => n.endsWith('.jsonl.tmp')).length;
  const files: BackupFile[] = names
    .filter(n => /^bb-redis-.*\.jsonl$/.test(n))
    .map(name => {
      const full = path.join(dir, name);
      const st = statSync(full);
      return { name, kb: Math.round(st.size / 1024), mtime: st.mtime.toISOString(), ...footerOf(full, st.size) };
    })
    .sort((a, b) => (a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0));
  const latest = files.find(f => f.complete === true) ?? null;
  const ageDays = latest ? Math.round(((now.getTime() - Date.parse(latest.mtime)) / 86_400_000) * 10) / 10 : null;
  return { dir, exists: true, files, tmp, latest, ageDays };
}

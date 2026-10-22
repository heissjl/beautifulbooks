import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupDir, readBackupStatus } from '../backup';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function folder(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'bb-backups-'));
  dirs.push(d);
  return d;
}

const header = JSON.stringify({ kind: 'header', version: 1, at: '2026-10-18T06:00:00.000Z', origin: 'buyitscovers.com', store: 'STORAGE_', dbsize: 3 });
const record = JSON.stringify({ k: 'wall:abc', t: 'string', v: '{"id":"abc","name":"typed by a reader"}', ttl: -1 });

function write(dir: string, name: string, lines: string[], at: Date) {
  const file = path.join(dir, name);
  writeFileSync(file, lines.join('\n') + '\n');
  utimesSync(file, at, at);
}

describe('the backup folder in the Cockpit (2.11)', () => {
  it('names the folder beside the main checkout, or BB_BACKUP_DIR', () => {
    expect(backupDir('/Users/julian/projects/beautifulbooks', {})).toBe('/Users/julian/projects/bb-backups');
    expect(backupDir('/Users/julian/projects/beautifulbooks', { BB_BACKUP_DIR: '/Volumes/Backup/bb' })).toBe('/Volumes/Backup/bb');
  });

  it('says there is nothing when the folder is missing', () => {
    const s = readBackupStatus('/nonexistent/bb-backups');
    expect(s).toMatchObject({ exists: false, latest: null, ageDays: null, files: [], tmp: 0 });
  });

  it('reads only the footer, takes the newest complete file and counts aborted ones', () => {
    const dir = folder();
    const now = new Date('2026-10-18T12:00:00Z');
    write(dir, 'bb-redis-2026-10-10-06-00.jsonl', [header, record, JSON.stringify({ kind: 'footer', keys: 1, complete: true, skipped: 0, other: [] })], new Date('2026-10-10T06:00:00Z'));
    write(dir, 'bb-redis-2026-10-18-06-00.jsonl', [header, record, JSON.stringify({ kind: 'footer', keys: 1, complete: false, skipped: 0, other: [], cursor: '42' })], new Date('2026-10-18T06:00:00Z'));
    write(dir, 'bb-redis-2026-10-18-07-00.jsonl.tmp', [header, record], new Date('2026-10-18T07:00:00Z'));
    write(dir, 'notes.txt', ['not a backup'], now);
    const s = readBackupStatus(dir, now);
    expect(s.files.map(f => f.name)).toEqual(['bb-redis-2026-10-18-06-00.jsonl', 'bb-redis-2026-10-10-06-00.jsonl']);
    expect(s.files[0].complete).toBe(false);
    expect(s.latest?.name).toBe('bb-redis-2026-10-10-06-00.jsonl');
    expect(s.latest?.keys).toBe(1);
    expect(s.ageDays).toBe(8.3);
    expect(s.tmp).toBe(1);
    // What readers typed never leaves the file.
    expect(JSON.stringify(s)).not.toContain('typed by a reader');
  });
});

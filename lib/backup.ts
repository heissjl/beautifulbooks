/**
 * A copy of the store as a file, and the way back (ROADMAP 2.11). Server
 * only; pure apart from the commands it is handed.
 *
 * The Redis holds what readers and friends made — their collections, the
 * game's votes, drafts and suggestions, the live state of the collections,
 * the analytics' daily totals — and the provider's own backup (every 24 h
 * since 2026-10-05) is the provider's: a copy outside it is the one Julian
 * can hold in his hand. `GET /api/admin/export` streams it, `npm run backup`
 * writes it to a folder beside the project, `npm run restore` reads it back
 * into an empty Redis.
 *
 * The format is JSON Lines, readable and checkable: a header, one line per
 * key with its type, its value as Redis holds it (strings, never parsed, so
 * a restore is byte for byte) and the time it has left, and a footer that
 * says how many keys and whether the walk was complete. A file without a
 * complete footer is an abort, not a backup (N12), and the script keeps it
 * under `.tmp` and says so. Only strings, lists and hashes exist in this
 * store (no set, no sorted set is written anywhere); anything else is noted
 * in the footer, not silently dropped. Two kinds of key are left out unless
 * asked for: the game's pair tokens (an hour) and the sent-alert markers
 * (two days) — memory of the moment, not worth keeping.
 */
import { hashEntries, type RedisCommands } from './redis';

export const BACKUP_VERSION = 1;

export type BackupType = 'string' | 'list' | 'hash';

export interface BackupRecord {
  k: string;
  t: BackupType;
  v: string | string[] | Record<string, string>;
  /** Milliseconds the key had left when read, or -1 without an expiry. */
  ttl: number;
}

export interface BackupHeader {
  kind: 'header';
  version: number;
  /** When the walk began, ISO. */
  at: string;
  /** Which site the store belongs to, for a file found later. */
  origin: string;
  /** The variable prefix of the store that was read. */
  store: string;
  dbsize: number | null;
}

export interface BackupFooter {
  kind: 'footer';
  keys: number;
  complete: boolean;
  /** Volatile keys left out (tokens, alert markers). */
  skipped: number;
  /** Keys of a type this format does not carry, by name. */
  other: string[];
  /** Where to go on when `complete` is false and time ran out. */
  cursor?: string;
}

/** Keys that are only memory of the moment: pair tokens (an hour) and the markers of sent alerts (two days). */
export const VOLATILE: readonly RegExp[] = [/^versus:token:/, /^alerts:/];
export const isVolatile = (key: string): boolean => VOLATILE.some(re => re.test(key));

export const SCAN_COUNT = 500;
/** A list is read in slices of this many: a `LRANGE 0 -1` over a million votes would outlast the command timeout. */
export const LIST_CHUNK = 5000;

export interface ExportOptions {
  now: Date;
  origin: string;
  store?: string;
  /** Volatile keys too. */
  all?: boolean;
  scanCount?: number;
  chunk?: number;
  /** Asked between SCAN rounds; true ends the walk with `complete: false` and the cursor to go on from. */
  stop?: () => boolean;
}

function whole(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

const isString = (x: unknown): x is string => typeof x === 'string';

async function readKey(commands: RedisCommands, key: string, chunk: number): Promise<BackupRecord | 'other' | null> {
  if (!commands.type || !commands.pTtl) throw new Error('this transport cannot export: TYPE and PTTL are needed');
  const type = String(await commands.type(key));
  let v: BackupRecord['v'];
  if (type === 'string') {
    const s = await commands.get(key);
    if (!isString(s)) return null;
    v = s;
  } else if (type === 'list') {
    const items: string[] = [];
    for (let start = 0; ; start += chunk) {
      const part = await commands.lRange(key, start, start + chunk - 1);
      const slice = Array.isArray(part) ? part.filter(isString) : [];
      items.push(...slice);
      if (slice.length < chunk) break;
    }
    v = items;
  } else if (type === 'hash') {
    v = Object.fromEntries(hashEntries(await commands.hGetAll(key)).map(([f, x]) => [f, String(x)]));
  } else if (type === 'none') {
    return null;
  } else {
    return 'other';
  }
  const ttl = whole(await commands.pTtl(key));
  return { k: key, t: type, v, ttl: ttl !== null && ttl >= 0 ? ttl : -1 };
}

/** The file, line by line: header, one record per key, footer. */
export async function* exportLines(commands: RedisCommands, options: ExportOptions): AsyncGenerator<string> {
  if (!commands.scan) throw new Error('this transport cannot export: SCAN is needed');
  const header: BackupHeader = {
    kind: 'header',
    version: BACKUP_VERSION,
    at: options.now.toISOString(),
    origin: options.origin,
    store: options.store ?? 'STORAGE_',
    dbsize: commands.dbSize ? whole(await commands.dbSize()) : null,
  };
  yield `${JSON.stringify(header)}\n`;
  const chunk = options.chunk ?? LIST_CHUNK;
  const seen = new Set<string>();
  const other: string[] = [];
  let cursor = '0';
  let keys = 0;
  let skipped = 0;
  let complete = true;
  do {
    const [next, batch] = await commands.scan(cursor, '*', options.scanCount ?? SCAN_COUNT);
    for (const key of batch) {
      // SCAN may hand a key out twice; the file holds it once.
      if (seen.has(key)) continue;
      seen.add(key);
      if (!options.all && isVolatile(key)) {
        skipped += 1;
        continue;
      }
      const record = await readKey(commands, key, chunk);
      if (record === null) continue;
      if (record === 'other') {
        other.push(key);
        continue;
      }
      keys += 1;
      yield `${JSON.stringify(record)}\n`;
    }
    cursor = next;
    if (cursor !== '0' && options.stop?.()) {
      complete = false;
      break;
    }
  } while (cursor !== '0');
  const footer: BackupFooter = { kind: 'footer', keys, complete, skipped, other: other.slice(0, 50), ...(complete ? {} : { cursor }) };
  yield `${JSON.stringify(footer)}\n`;
}

export interface Backup {
  header: BackupHeader;
  records: BackupRecord[];
  footer: BackupFooter;
}

const TYPES: ReadonlySet<string> = new Set<BackupType>(['string', 'list', 'hash']);

function isRecord(x: unknown): x is BackupRecord {
  if (!x || typeof x !== 'object') return false;
  const r = x as Partial<BackupRecord>;
  if (typeof r.k !== 'string' || typeof r.t !== 'string' || !TYPES.has(r.t) || typeof r.ttl !== 'number') return false;
  if (r.t === 'string') return typeof r.v === 'string';
  if (r.t === 'list') return Array.isArray(r.v) && r.v.every(isString);
  return !!r.v && typeof r.v === 'object' && !Array.isArray(r.v) && Object.values(r.v).every(isString);
}

/** Reads a file back, or says what is wrong with it: a file that is not whole must never be restored as if it were. */
export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return { ok: false, error: 'not a backup: fewer than two lines' };
  let header: unknown;
  let footer: unknown;
  try {
    header = JSON.parse(lines[0]);
    footer = JSON.parse(lines[lines.length - 1]);
  } catch {
    return { ok: false, error: 'not a backup: the first or last line is not JSON' };
  }
  const h = header as Partial<BackupHeader>;
  if (!h || h.kind !== 'header' || h.version !== BACKUP_VERSION || typeof h.at !== 'string') return { ok: false, error: 'not a backup: no header of version 1' };
  const f = footer as Partial<BackupFooter>;
  if (!f || f.kind !== 'footer' || typeof f.keys !== 'number') return { ok: false, error: 'no footer: the export broke off before it was done' };
  if (f.complete !== true) return { ok: false, error: `the export was not complete (${f.keys} keys, cursor ${f.cursor ?? '?'}) — an abort is not a backup` };
  const records: BackupRecord[] = [];
  for (const line of lines.slice(1, -1)) {
    let r: unknown;
    try {
      r = JSON.parse(line);
    } catch {
      return { ok: false, error: `a line is not JSON (after ${records.length} records)` };
    }
    if (!isRecord(r)) return { ok: false, error: `a line is not a record (after ${records.length} records)` };
    records.push(r);
  }
  if (records.length !== f.keys) return { ok: false, error: `the footer counts ${f.keys} keys, the file holds ${records.length}` };
  return { ok: true, backup: { header: h as BackupHeader, records, footer: f as BackupFooter } };
}

export interface RestoreOptions {
  /** The moment of restoring: a key's remaining time counts from the export's `at`. */
  now: Date;
  /** Overwrite keys that exist (a list or hash is deleted first); without it the caller checks that the store is empty. */
  force?: boolean;
  chunk?: number;
}

export interface RestoreResult {
  written: number;
  /** Keys whose time had run out between export and restore. */
  expired: number;
}

/** Writes the records into the store, with the time each key had left. */
export async function restoreRecords(commands: RedisCommands, backup: Backup, options: RestoreOptions): Promise<RestoreResult> {
  const chunk = options.chunk ?? LIST_CHUNK;
  const elapsed = options.now.getTime() - Date.parse(backup.header.at);
  let written = 0;
  let expired = 0;
  for (const r of backup.records) {
    const left = r.ttl >= 0 ? r.ttl - elapsed : -1;
    if (r.ttl >= 0 && left <= 0) {
      expired += 1;
      continue;
    }
    if (options.force && r.t !== 'string') await commands.del?.(r.k);
    if (r.t === 'string') {
      await commands.set(r.k, r.v as string);
    } else if (r.t === 'list') {
      const values = r.v as string[];
      for (let i = 0; i < values.length; i += chunk) {
        const slice = values.slice(i, i + chunk);
        if (commands.rPushMany) await commands.rPushMany(r.k, slice);
        else for (const value of slice) await commands.rPush(r.k, value);
      }
    } else {
      const fields = r.v as Record<string, string>;
      if (commands.hSet) await commands.hSet(r.k, fields);
      else for (const [f, v] of Object.entries(fields)) await commands.hSetNX(r.k, f, v);
    }
    if (left > 0) {
      if (commands.pExpire) await commands.pExpire(r.k, left);
      else await commands.expire?.(r.k, Math.max(1, Math.ceil(left / 1000)));
    }
    written += 1;
  }
  return { written, expired };
}

/** A folder for the copies: beside the project, never inside it, never in a synced cloud folder (the 0.6 GB that filled a disk on 2026-10-07 lived in one). */
export function refuseBackupDir(dir: string, repoRoot: string): string | null {
  const lower = dir.toLowerCase();
  if (lower.includes('mobile documents') || lower.includes('icloud')) return 'the backup folder must not lie in iCloud Drive';
  if (dir === repoRoot || dir.startsWith(`${repoRoot}/`)) return 'the backup folder must not lie inside the repository';
  return null;
}

/**
 * The copy of the store and the way back (ROADMAP 2.11, lib/backup.ts):
 * export → file → restore into an empty store, equal to the original; an
 * incomplete file is refused; volatile keys stay out unless asked for.
 * The store is a double with the same commands — there is no Redis on this
 * machine, so this proves the format and the walk, not the wire.
 */
import { describe, expect, it } from 'vitest';
import { exportLines, isVolatile, parseBackup, refuseBackupDir, restoreRecords } from '../backup';
import type { RedisCommands } from '../redis';

/** A Redis in memory: strings, lists and hashes with expiries, SCAN in slices. */
class MemoryRedis implements RedisCommands {
  strings = new Map<string, string>();
  lists = new Map<string, string[]>();
  hashes = new Map<string, Map<string, string>>();
  expires = new Map<string, number>();
  calls: string[] = [];
  constructor(private readonly clock: () => number) {}
  private note(c: string) {
    this.calls.push(c);
  }
  private alive(key: string): boolean {
    const until = this.expires.get(key);
    if (until !== undefined && until <= this.clock()) {
      this.strings.delete(key);
      this.lists.delete(key);
      this.hashes.delete(key);
      this.expires.delete(key);
      return false;
    }
    return true;
  }
  keys(): string[] {
    return [...new Set([...this.strings.keys(), ...this.lists.keys(), ...this.hashes.keys()])].filter(k => this.alive(k)).sort();
  }
  async rPush(key: string, value: string) {
    this.note('RPUSH');
    const l = this.lists.get(key) ?? [];
    l.push(value);
    this.lists.set(key, l);
    return l.length;
  }
  async rPushMany(key: string, values: readonly string[]) {
    this.note('RPUSHMANY');
    const l = this.lists.get(key) ?? [];
    l.push(...values);
    this.lists.set(key, l);
    return l.length;
  }
  async lRange(key: string, start: number, stop: number) {
    this.note('LRANGE');
    return (this.lists.get(key) ?? []).slice(start, stop + 1);
  }
  async lLen(key: string) {
    return (this.lists.get(key) ?? []).length;
  }
  async get(key: string) {
    this.note('GET');
    return this.alive(key) ? (this.strings.get(key) ?? null) : null;
  }
  async set(key: string, value: string) {
    this.note('SET');
    this.strings.set(key, value);
    this.expires.delete(key);
    return 'OK';
  }
  async hGetAll(key: string) {
    this.note('HGETALL');
    return Object.fromEntries(this.hashes.get(key) ?? []);
  }
  async hSetNX(key: string, field: string, value: string) {
    const h = this.hashes.get(key) ?? new Map<string, string>();
    this.hashes.set(key, h);
    if (h.has(field)) return 0;
    h.set(field, value);
    return 1;
  }
  async hSet(key: string, fields: Readonly<Record<string, string>>) {
    this.note('HSET');
    const h = this.hashes.get(key) ?? new Map<string, string>();
    for (const [f, v] of Object.entries(fields)) h.set(f, v);
    this.hashes.set(key, h);
    return Object.keys(fields).length;
  }
  async setNx(key: string, value: string, ttlSeconds: number) {
    if (this.strings.has(key) && this.alive(key)) return null;
    this.strings.set(key, value);
    this.expires.set(key, this.clock() + ttlSeconds * 1000);
    return 'OK';
  }
  async setEx(key: string, value: string, ttlSeconds: number) {
    this.strings.set(key, value);
    this.expires.set(key, this.clock() + ttlSeconds * 1000);
    return 'OK';
  }
  async pExpire(key: string, ms: number) {
    this.note('PEXPIRE');
    this.expires.set(key, this.clock() + ms);
    return 1;
  }
  async pTtl(key: string) {
    const until = this.expires.get(key);
    return until === undefined ? -1 : Math.max(0, until - this.clock());
  }
  async type(key: string) {
    if (!this.alive(key)) return 'none';
    return this.strings.has(key) ? 'string' : this.lists.has(key) ? 'list' : this.hashes.has(key) ? 'hash' : 'none';
  }
  async del(key: string) {
    this.note('DEL');
    this.strings.delete(key);
    this.lists.delete(key);
    this.hashes.delete(key);
    this.expires.delete(key);
    return 1;
  }
  async dbSize() {
    return this.keys().length;
  }
  async scan(cursor: string, _match: string, count: number): Promise<[string, string[]]> {
    const all = this.keys();
    const from = Number(cursor);
    const slice = all.slice(from, from + count);
    // Hand the first key out twice, as a real SCAN may: the export must hold it once.
    const next = from + count >= all.length ? '0' : String(from + count);
    return [next, from === 0 && slice.length ? [slice[0], ...slice] : slice];
  }
}

function seeded(clock: () => number): MemoryRedis {
  const r = new MemoryRedis(clock);
  r.strings.set('collections:published', JSON.stringify({ 'sf-masterworks': true }));
  r.strings.set('wall:aaaaaaaaaa', JSON.stringify({ id: 'aaaaaaaaaa', tiles: [] }));
  r.strings.set('wall:unsaved00', '{"id":"unsaved00","unsaved":true}');
  r.expires.set('wall:unsaved00', clock() + 48 * 3_600_000);
  r.strings.set('versus:token:abc', '1');
  r.expires.set('versus:token:abc', clock() + 3_600_000);
  r.strings.set('alerts:heartbeat:2026-10-17', '1');
  r.expires.set('alerts:heartbeat:2026-10-17', clock() + 2 * 86_400_000);
  r.lists.set('versus:mix-2000-paperwhite:votes', Array.from({ length: 12_345 }, (_, i) => JSON.stringify({ a: `c${i}`, b: `d${i}`, winner: 'a', on: '2026-10-17' })));
  r.lists.set('walls:all', ['aaaaaaaaaa']);
  r.hashes.set('walls:views', new Map([['aaaaaaaaaa', '12']]));
  r.hashes.set('ins:2026-10-17:clicks', new Map([['bookshop|us|product', '3']]));
  r.expires.set('ins:2026-10-17:clicks', clock() + 400 * 86_400_000);
  return r;
}

const T0 = Date.parse('2026-10-18T06:00:00Z');

async function dump(commands: RedisCommands, options: Parameters<typeof exportLines>[1]): Promise<string> {
  let out = '';
  for await (const line of exportLines(commands, options)) out += line;
  return out;
}

const snapshot = (r: MemoryRedis) => ({
  strings: [...r.strings].sort(),
  lists: [...r.lists].map(([k, v]) => [k, v.length, v[0], v[v.length - 1]]).sort(),
  hashes: [...r.hashes].map(([k, h]) => [k, [...h].sort()]).sort(),
});

describe('the backup (2.11)', () => {
  it('walks the store once, leaves the volatile keys out, and reads a long list in slices', async () => {
    const source = seeded(() => T0);
    const text = await dump(source, { now: new Date(T0), origin: 'buyitscovers.com', scanCount: 3, chunk: 5000 });
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { header, records, footer } = parsed.backup;
    expect(header).toMatchObject({ kind: 'header', version: 1, origin: 'buyitscovers.com', dbsize: 9 });
    expect(footer).toMatchObject({ complete: true, keys: 7, skipped: 2, other: [] });
    expect(records.map(r => r.k)).not.toContain('versus:token:abc');
    expect(records.map(r => r.k)).not.toContain('alerts:heartbeat:2026-10-17');
    expect(new Set(records.map(r => r.k)).size).toBe(records.length);
    const votes = records.find(r => r.k === 'versus:mix-2000-paperwhite:votes');
    expect(votes?.t).toBe('list');
    expect((votes?.v as string[]).length).toBe(12_345);
    expect(source.calls.filter(c => c === 'LRANGE').length).toBe(3 + 1);
    expect(records.find(r => r.k === 'wall:unsaved00')?.ttl).toBe(48 * 3_600_000);
    expect(records.find(r => r.k === 'wall:aaaaaaaaaa')?.ttl).toBe(-1);
  });

  it('restores into an empty store what the file holds, with the time each key had left', async () => {
    const source = seeded(() => T0);
    const text = await dump(source, { now: new Date(T0), origin: 'buyitscovers.com' });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const later = T0 + 3_600_000;
    const target = new MemoryRedis(() => later);
    const result = await restoreRecords(target, parsed.backup, { now: new Date(later) });
    expect(result).toEqual({ written: 7, expired: 0 });
    // The same picture, minus the two volatile keys that were left out on purpose.
    source.strings.delete('versus:token:abc');
    source.strings.delete('alerts:heartbeat:2026-10-17');
    expect(snapshot(target)).toEqual(snapshot(source));
    expect(await target.pTtl('wall:unsaved00')).toBe(47 * 3_600_000);
    expect(await target.pTtl('wall:aaaaaaaaaa')).toBe(-1);
    expect(target.calls.filter(c => c === 'RPUSHMANY').length).toBe(3 + 1);
  });

  it('takes the volatile keys too when asked, and skips a key whose time ran out in between', async () => {
    const source = seeded(() => T0);
    const text = await dump(source, { now: new Date(T0), origin: 'x', all: true });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.footer).toMatchObject({ keys: 9, skipped: 0 });
    const target = new MemoryRedis(() => T0 + 2 * 3_600_000);
    const result = await restoreRecords(target, parsed.backup, { now: new Date(T0 + 2 * 3_600_000) });
    expect(result.expired).toBe(1);
    expect(target.strings.has('versus:token:abc')).toBe(false);
  });

  it('refuses a file that broke off, that is not whole, or that is not a backup', async () => {
    const source = seeded(() => T0);
    let rounds = 0;
    const text = await dump(source, { now: new Date(T0), origin: 'x', scanCount: 2, stop: () => ++rounds >= 2 });
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('not complete');
    const lines = (await dump(seeded(() => T0), { now: new Date(T0), origin: 'x' })).trimEnd().split('\n');
    expect(parseBackup(lines.slice(0, -1).join('\n')).ok).toBe(false);
    expect(parseBackup([lines[0], ...lines.slice(2)].join('\n')).ok).toBe(false);
    expect(parseBackup('hello\nworld').ok).toBe(false);
  });

  it('knows which keys are memory of the moment, and where a copy may not lie', () => {
    expect(isVolatile('versus:token:abc')).toBe(true);
    expect(isVolatile('alerts:fill:votes:2026-10-17')).toBe(true);
    expect(isVolatile('versus:mix-2000-paperwhite:votes')).toBe(false);
    const repo = '/Users/julian/projects/beautifulbooks';
    expect(refuseBackupDir('/Users/julian/projects/bb-backups', repo)).toBeNull();
    expect(refuseBackupDir(`${repo}/backups`, repo)).toContain('inside the repository');
    expect(refuseBackupDir('/Users/julian/Library/Mobile Documents/com~apple~CloudDocs/bb-backups', repo)).toContain('iCloud');
  });
});

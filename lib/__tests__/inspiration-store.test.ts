import { describe, expect, it } from 'vitest';
import { emptyBoard, place } from '../inspiration/board';
import { shortId } from '../inspiration/shortid';
import { commandsLinkStore, linkStoreFromEnv, LinkStoreFull, memoryLinkStore } from '../inspiration/store';
import { inspirationEnabled } from '../inspiration/switch';

const board = (by = 'Julian') => ({ ...place(emptyBoard(), 0, { workId: 'OL468431W', coverId: 'ol:13853193' }), by });

describe('the link store', () => {
  it('gives a board back under the hash of its content', async () => {
    const store = memoryLinkStore();
    const id = await store.put(board());
    expect(id).toBe(shortId(board()));
    expect(id).toMatch(/^[a-z2-7]{8}$/);
    expect(await store.get(id)).toEqual(board());
  });

  it('writes a board once: the first day stands', async () => {
    const kept = new Map<string, string>();
    let writes = 0;
    const commands = { get: async (k: string) => kept.get(k) ?? null, set: async (k: string, v: string) => { writes++; kept.set(k, v); return 'OK'; } };
    const first = commandsLinkStore(commands, () => new Date('2026-10-05T10:00:00Z'));
    const later = commandsLinkStore(commands, () => new Date('2026-12-01T10:00:00Z'));
    const id = await first.put(board());
    expect(await later.put(board())).toBe(id);
    expect(writes).toBe(1);
    expect(JSON.parse([...kept.values()][0])).toEqual({ q: 'b=a1fz.88x6x~~~~~~~~&by=Julian', at: '2026-10-05' });
  });

  it('keeps nothing but the board and the name on it', async () => {
    const kept = new Map<string, string>();
    const store = commandsLinkStore({ get: async k => kept.get(k) ?? null, set: async (k, v) => { kept.set(k, v); return 'OK'; } });
    await store.put(board('A reader'));
    expect(Object.keys(JSON.parse([...kept.values()][0])).sort()).toEqual(['at', 'q']);
  });

  it('answers null for an id not on record, a malformed id and a damaged record', async () => {
    const store = commandsLinkStore({ get: async k => (k.endsWith('aaaaaaaa') ? 'not json' : null), set: async () => 'OK' });
    expect(await store.get('bbbbbbbb')).toBeNull();
    expect(await store.get('../etc')).toBeNull();
    expect(await store.get('aaaaaaaa')).toBeNull();
  });

  it('refuses an empty board, and lets a silent store be heard', async () => {
    await expect(memoryLinkStore().put(emptyBoard())).rejects.toThrow(/empty board/);
    const silent = commandsLinkStore({ get: async () => { throw new Error('down'); }, set: async () => 'OK' });
    await expect(silent.get('aaaaaaaa')).rejects.toThrow('down');
  });

  it('stops at its cap, and a board already on record still gets its link', async () => {
    const store = memoryLinkStore(1);
    const first = await store.put(board());
    await expect(store.put(board('Someone else'))).rejects.toBeInstanceOf(LinkStoreFull);
    expect(await store.put(board())).toBe(first);
    // The refused link was not counted: the place it left is not lost.
    await expect(store.put(board('A third'))).rejects.toBeInstanceOf(LinkStoreFull);
    expect(await store.get(shortId(board('Someone else')))).toBeNull();
  });

  it('has no store in a production build with no Redis at all', () => {
    expect(linkStoreFromEnv({ NODE_ENV: 'production' })).toBeNull();
  });

  it('lives in the site’s store, or in one of its own under LINKS_ where that is set', () => {
    expect(linkStoreFromEnv({ NODE_ENV: 'production', STORAGE_REDIS_URL: 'redis://site.example:6379' })).not.toBeNull();
    expect(linkStoreFromEnv({ NODE_ENV: 'production', LINKS_REDIS_URL: 'redis://links.example:6379' })).not.toBeNull();
  });
});

describe('the switch', () => {
  it('is on everywhere but Vercel’s production unless set', () => {
    expect(inspirationEnabled({})).toBe(true);
    expect(inspirationEnabled({ VERCEL_ENV: 'preview' })).toBe(true);
    expect(inspirationEnabled({ VERCEL_ENV: 'production' })).toBe(false);
    expect(inspirationEnabled({ VERCEL_ENV: 'production', INSPIRATION: 'on' })).toBe(true);
    expect(inspirationEnabled({ VERCEL_ENV: 'preview', INSPIRATION: 'OFF' })).toBe(false);
  });

  it('fails loudly on a typo', () => {
    expect(() => inspirationEnabled({ INSPIRATION: 'yes' })).toThrow(/INSPIRATION must be/);
  });
});

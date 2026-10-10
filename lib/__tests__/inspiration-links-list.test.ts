import { describe, expect, it } from 'vitest';
import { emptyBoard, place } from '../inspiration/board';
import { commandsLinkStore, memoryLinkStore } from '../inspiration/store';
import { scanReply } from '../hotornot/store';
import { OPS, summarizeOps } from '../insights/model';

const board = (by: string, cover = 'ol:13853193') => ({ ...place(emptyBoard(), 0, { workId: 'OL468431W', coverId: cover }), by });

describe('K17: Shelf-Portraits made, and the list of links', () => {
  it('runs onNew only when the link is written, not for a board shared again', async () => {
    const store = memoryLinkStore();
    let made = 0;
    await store.put(board('A reader'), () => made++);
    await store.put(board('A reader'), () => made++);
    await store.put(board('Someone else'), () => made++);
    expect(made).toBe(2);
  });

  it('lists the links newest first, with the store\'s own total', async () => {
    const kept = new Map<string, string>();
    let count = 0;
    let day = '2026-10-08';
    const commands = {
      get: async (k: string) => kept.get(k) ?? null,
      set: async (k: string, v: string) => { kept.set(k, v); return 'OK'; },
      hIncrBy: async (_k: string, _f: string, by: number) => (count += by),
      hGetAll: async () => ({ count: String(count) }),
      // Two pages, as a real SCAN may answer.
      scan: async (cursor: string): Promise<[string, string[]]> => {
        const keys = [...kept.keys()];
        return cursor === '0' ? ['7', keys.slice(0, 1)] : ['0', keys.slice(1)];
      },
    };
    const store = commandsLinkStore(commands, () => new Date(`${day}T12:00:00Z`));
    const older = await store.put(board('First'));
    day = '2026-10-10';
    const newer = await store.put(board('Second', 'ol:1'));
    const list = await store.list!(10);
    expect(list).not.toBeNull();
    expect(list!.count).toBe(2);
    expect(list!.links.map(r => r.id)).toEqual([newer, older]);
    expect(list!.links[0].at).toBe('2026-10-10');
    expect(list!.links[0].board.by).toBe('Second');
    expect(list!.truncated).toBe(false);
    expect((await store.list!(1))!.truncated).toBe(true);
  });

  it('says it cannot list where the store has no SCAN, rather than "none"', async () => {
    const store = commandsLinkStore({ get: async () => null, set: async () => 'OK' });
    expect(await store.list!(10)).toBeNull();
  });

  it('reads a SCAN answer from either transport', () => {
    expect(scanReply(['12', ['a', 'b']])).toEqual(['12', ['a', 'b']]);
    expect(scanReply({ cursor: '0', keys: ['c'] })).toEqual(['0', ['c']]);
    expect(scanReply(null)).toEqual(['0', []]);
  });

  it('sums the two portrait counts per period, apart from the operation\'s stumbles', () => {
    expect(OPS).toContain('portrait-made');
    const s = summarizeOps(['2026-10-10', '2026-10-11'], [{ 'portrait-made': '2', 'portrait-mine': '1' }, { 'portrait-made': '3' }]);
    expect(s.totals['portrait-made']).toBe(5);
    expect(s.totals['portrait-mine']).toBe(1);
    expect(s.daysWith['portrait-made']).toEqual(['2026-10-10', '2026-10-11']);
    expect(s.totals['google-stop']).toBe(0);
  });
});

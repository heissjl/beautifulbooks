/** The two new ways a photo is turned away (ROADMAP 2.18h): a silent store, a busy instance — counted in K13 as their own outcomes. */
import { describe, expect, it } from 'vitest';
import type { RedisCommands } from '../redis';
import { costUsd } from '../insights/prices';
import { countPhoto } from '../insights/store';
import { summarizePhotos } from '../insights/visits';

function fakeRedis() {
  const hashes = new Map<string, Map<string, number>>();
  const commands = {
    async hIncrBy(key: string, field: string, by: number) {
      const h = hashes.get(key) ?? new Map<string, number>();
      h.set(field, (h.get(field) ?? 0) + by);
      hashes.set(key, h);
      return h.get(field);
    },
    async expire() {
      return 1;
    },
    async hGetAll(key: string) {
      return Object.fromEntries(hashes.get(key) ?? new Map());
    },
  } as unknown as RedisCommands;
  return { commands, hashes };
}

const PROD = { VERCEL_ENV: 'production' };
const NOW = new Date('2026-10-17T10:00:00Z');

describe('photos turned away (2.18h)', () => {
  it('counts a silent store and a busy instance as their own outcomes, apart from the day cap', async () => {
    const r = fakeRedis();
    const opts = { env: PROD, commands: r.commands, now: NOW };
    expect(await countPhoto({ outcome: 'store' }, opts)).toBe('counted');
    expect(await countPhoto({ outcome: 'store' }, opts)).toBe('counted');
    expect(await countPhoto({ outcome: 'busy' }, opts)).toBe('counted');
    expect(await countPhoto({ outcome: 'capped' }, opts)).toBe('counted');
    expect(Object.fromEntries(r.hashes.get('ins:2026-10-17:photos') ?? [])).toEqual({ store: 2, busy: 1, capped: 1 });
  });

  it('sums them in the report, so the view can say why photos were not read', () => {
    const s = summarizePhotos(['2026-10-17'], [{ read: 3, store: '2', busy: 1, capped: 4 }], costUsd);
    expect(s).toMatchObject({ read: 3, store: 2, busy: 1, capped: 4, failed: 0 });
  });
});

/** K13: what reading shelf photos used and cost (ROADMAP 3.1), and the guards the CLAUDE.md "Analytics" rule leans on. */
import { describe, expect, it } from 'vitest';
import type { RedisCommands } from '../hotornot/store';
import { costUsd, MODEL_PRICES } from '../insights/prices';
import { VERDICTS } from '../insights/signals';
import { countPhoto } from '../insights/store';
import { summarizePhotos } from '../insights/visits';
import { FALLBACK_MODEL, PRIMARY_MODEL } from '../recognize';
import type { VerdictStatus } from '../verdicts';

function fakeRedis() {
  const hashes = new Map<string, Map<string, number>>();
  const commands = {
    async hIncrBy(key: string, field: string, by: number) {
      const h = hashes.get(key) ?? new Map<string, number>();
      h.set(field, (h.get(field) ?? 0) + by);
      hashes.set(key, h);
      return h.get(field);
    },
    async expire() { return 1; },
    async hGetAll(key: string) { return Object.fromEntries(hashes.get(key) ?? new Map()); },
  } as unknown as RedisCommands;
  return { commands, hashes };
}

const PROD = { VERCEL_ENV: 'production' };
const NOW = new Date('2026-10-04T10:00:00Z');

describe('prices', () => {
  it('knows every model the photo route may call — change a model, add its price', () => {
    for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) expect(MODEL_PRICES[model], model).toBeDefined();
  });

  it('prices tokens per million and knows nothing it was not told', () => {
    expect(costUsd('claude-sonnet-5', 1_000_000, 100_000)).toBeCloseTo(2 + 1);
    expect(costUsd('claude-opus-5-5', 5_000, 2_000)).toBeCloseTo(0.02 + 0.04);
    expect(costUsd('claude-unknown-9', 1000, 1000)).toBeNull();
  });
});

describe('counting photos', () => {
  it('adds a read photo with its tokens per model, and the photos turned away or failed', async () => {
    const r = fakeRedis();
    const opts = { env: PROD, commands: r.commands, now: NOW };
    expect(await countPhoto({ outcome: 'read', model: 'claude-sonnet-5', inputTokens: 3200, outputTokens: 900, books: 24, found: 19, maybe: 3 }, opts)).toBe('counted');
    expect(await countPhoto({ outcome: 'capped' }, opts)).toBe('counted');
    expect(await countPhoto({ outcome: 'failed' }, opts)).toBe('counted');
    const day = r.hashes.get('ins:2026-10-04:photos');
    expect(Object.fromEntries(day ?? [])).toEqual({ read: 1, capped: 1, failed: 1, 'in|claude-sonnet-5': 3200, 'out|claude-sonnet-5': 900, books: 24, found: 19, maybe: 3 });
    expect(await countPhoto({ outcome: 'read', model: 'bad|model', inputTokens: 1, outputTokens: 1, books: 0, found: 0, maybe: 0 }, opts)).toBe('invalid');
    expect(await countPhoto({ outcome: 'capped' }, { ...opts, env: {} })).toBe('off');
  });

  it('sums cost per day and calls an unknown price unknown, not free', () => {
    const s = summarizePhotos(
      ['2026-10-03', '2026-10-04'],
      [
        { read: '2', 'in|claude-sonnet-5': '1000000', 'out|claude-sonnet-5': '100000', books: '40', found: '30' },
        { read: 1, failed: 1, capped: 2, 'in|claude-opus-5-5': 500000, 'out|claude-opus-5-5': 0, 'in|claude-new-6': 10, 'out|claude-new-6': 5 },
      ],
      costUsd,
    );
    expect(s).toMatchObject({ read: 3, failed: 1, capped: 2, books: 40, found: 30, unpricedTokens: 15 });
    expect(s.costUsd).toBeCloseTo(3 + 2);
    expect(s.perDay.map(d => Math.round(d.costUsd * 100) / 100)).toEqual([3, 2]);
    expect(s.tokens['claude-new-6']?.costUsd).toBeNull();
  });
});

describe('the analytics keep up with the page', () => {
  it('has a class for every verdict the sidebar can show (K8)', () => {
    // A new IsbnVerdict status fails to compile here until VERDICTS knows it.
    const all: Record<VerdictStatus, true> = {
      verified: true, differs: true, uncompared: true, unknown: true, unavailable: true, pending: true,
      catalogueVerified: true, catalogueDiffers: true, catalogueUncompared: true, catalogueUnknown: true,
    };
    for (const status of Object.keys(all)) expect(VERDICTS as readonly string[]).toContain(status);
  });
});

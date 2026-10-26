/**
 * The operations block (ROADMAP 2.18g): the fill level of the store, its
 * lines and words, the note of the morning mail.
 */
import { describe, expect, it } from 'vitest';
import {
  DRAFTS_CAP,
  FILL_LINES,
  fillLine,
  fillMail,
  fillWarnings,
  heartbeatRecord,
  parseHeartbeatRecord,
  SUGGESTIONS_CAP,
  warningLine,
  type FillFacts,
} from '../fill';
import { gatherOperations, readFill, VOTE_LOGS } from '../operations';
import type { RedisCommands } from '../redis';
import { WALLS_CAP } from '../walls/model';

const FULL: FillFacts = { keys: 12, votes: 1000, walls: 3, drafts: 2, suggestions: 1, contentBytes: 2048 };

function fakeCommands(options: { lens?: Record<string, number>; noExtras?: boolean; failing?: string } = {}): RedisCommands {
  const lens = options.lens ?? {};
  const base: RedisCommands = {
    rPush: async () => 1,
    lRange: async () => [],
    lLen: async (key) => {
      if (key === options.failing) throw new Error('down');
      return lens[key] ?? 0;
    },
    get: async () => null,
    set: async () => 'OK',
    hGetAll: async () => ({}),
    hSetNX: async () => 1,
    setNx: async () => 'OK',
  };
  return options.noExtras ? base : { ...base, dbSize: async () => 12, strLen: async () => 2048 };
}

describe('the fill level (2.18g)', () => {
  it('knows every vote log of the game, the inherited pools first', () => {
    expect(VOTE_LOGS.length).toBeGreaterThan(1);
    expect(VOTE_LOGS[VOTE_LOGS.length - 1]).toBe('mix-2000-paperwhite-collections');
  });

  it('reads keys, the lists and a sample value, and adds the votes over every log', async () => {
    const lens: Record<string, number> = { 'walls:all': 3, 'curate:drafts': 2, 'suggest:items': 1 };
    VOTE_LOGS.forEach((name, i) => { lens[`versus:${name}:votes`] = (i + 1) * 100; });
    const f = await readFill(fakeCommands({ lens }));
    expect(f).toEqual({ keys: 12, walls: 3, drafts: 2, suggestions: 1, contentBytes: 2048, votes: VOTE_LOGS.reduce((s, _, i) => s + (i + 1) * 100, 0) });
  });

  it('says ? where the transport lacks the command or the store failed, never 0', async () => {
    const plain = await readFill(fakeCommands({ noExtras: true, lens: { 'walls:all': 3 } }));
    expect(plain.keys).toBeNull();
    expect(plain.contentBytes).toBeNull();
    expect(plain.walls).toBe(3);
    const broken = await readFill(fakeCommands({ failing: 'walls:all' }));
    expect(broken.walls).toBeNull();
    expect(fillLine(broken)).toContain('walls ?');
    const noVotes = await readFill({ ...fakeCommands(), lLen: async () => { throw new Error('down'); } });
    expect(noVotes.votes).toBeNull();
  });

  it('warns at the line — 90 % of a cap, two million votes — and not below', () => {
    expect(FILL_LINES.walls).toBe(Math.floor(WALLS_CAP * 0.9));
    expect(FILL_LINES.drafts).toBe(Math.floor(DRAFTS_CAP * 0.9));
    expect(FILL_LINES.suggestions).toBe(Math.floor(SUGGESTIONS_CAP * 0.9));
    expect(fillWarnings(FULL)).toEqual([]);
    expect(fillWarnings({ ...FULL, walls: FILL_LINES.walls, votes: null })).toEqual([{ list: 'walls', n: FILL_LINES.walls, line: FILL_LINES.walls }]);
    const w = fillWarnings({ ...FULL, votes: 2_500_000 })[0];
    expect(warningLine(w)).toBe('fill: votes 2500000 over 2000000');
    const mail = fillMail(w, { ...FULL, votes: 2_500_000 });
    expect(mail.subject).toContain('votes list is at 2500000');
    expect(mail.text).toContain('store: 12 keys, votes 2500000');
    expect(mail.text).toContain('not trimmed');
  });

  it('writes the health line with every number', () => {
    expect(fillLine(FULL)).toBe('store: 12 keys, votes 1000, walls 3, drafts 2, suggestions 1, published drafts 2 KB');
  });

  it('notes what became of the morning mail and reads only a well-formed note back', () => {
    const raw = heartbeatRecord('2026-10-16', 'sent', new Date('2026-10-17T06:00:00Z'));
    expect(parseHeartbeatRecord(raw)).toEqual({ day: '2026-10-16', result: 'sent', at: '2026-10-17T06:00:00.000Z' });
    expect(parseHeartbeatRecord('{"day":"x","result":"exploded","at":"y"}')).toBeNull();
    expect(parseHeartbeatRecord('not json')).toBeNull();
    expect(parseHeartbeatRecord(null)).toBeNull();
  });

  it('gathers the block without a store too: nothing read, nothing invented', async () => {
    const facts = await gatherOperations(null, 0);
    expect(facts.configured).toBe(false);
    expect(facts.fill).toBeNull();
    expect(facts.warnings).toEqual([]);
    expect(facts.heartbeat).toBeNull();
    const withStore = await gatherOperations({ ...fakeCommands(), get: async () => heartbeatRecord('2026-10-16', 'failed', new Date(0)) }, 0);
    expect(withStore.fill?.keys).toBe(12);
    expect(withStore.heartbeat).toMatchObject({ day: '2026-10-16', result: 'failed' });
  });
});

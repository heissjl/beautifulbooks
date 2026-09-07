/**
 * The shared slot queue for the cards' cover requests (SPEC §9.3 step 14).
 */
import { describe, expect, it } from 'vitest';
import { queueState, withSlot } from '../../components/coverQueue';

const defer = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
};

describe('withSlot', () => {
  it('runs eight tasks at once and holds the rest back', async () => {
    const gates = Array.from({ length: 12 }, defer);
    const started: number[] = [];
    const runs = gates.map((gate, i) =>
      withSlot(async () => { started.push(i); await gate.promise; return i; }),
    );

    await Promise.resolve();
    expect(started).toHaveLength(8);
    expect(queueState()).toMatchObject({ active: 8, waiting: 4 });

    gates[0].resolve();
    gates[1].resolve();
    await Promise.all([runs[0], runs[1]]);
    expect(started).toHaveLength(10);

    gates.forEach(g => g.resolve());
    await expect(Promise.all(runs)).resolves.toEqual([...Array(12).keys()]);
    expect(queueState()).toMatchObject({ active: 0, waiting: 0 });
  });

  it('frees the slot when a task fails, so one bad card does not block the grid', async () => {
    await expect(withSlot(async () => { throw new Error('nope'); })).rejects.toThrow('nope');
    expect(queueState()).toMatchObject({ active: 0, waiting: 0 });
    await expect(withSlot(async () => 'fine')).resolves.toBe('fine');
  });
});

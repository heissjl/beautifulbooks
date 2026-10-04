import { describe, expect, it } from 'vitest';
import { spreadPins as raw } from '../walls/pins';

// 0.12 × 400 is 48.00000000000001; the test speaks in whole pixels.
const spreadPins = (...args: Parameters<typeof raw>) => raw(...args).map((p) => (p ? [Math.round(p[0]), Math.round(p[1])] : p));

describe('spreadPins (5.11a): no pin hides another', () => {
  it('leaves pins that do not touch where the model put them', () => {
    expect(spreadPins([[0.1, 0.5], [0.5, 0.5], undefined], 400, 300, 24)).toEqual([[40, 150], [200, 150], undefined]);
  });

  it('fans a shelf of thin spines out up and down', () => {
    const out = spreadPins([[0.1, 0.5], [0.12, 0.5], [0.14, 0.5]], 400, 300, 24);
    expect(out[0]).toEqual([40, 150]);
    expect(out[1]).toEqual([48, 174]);
    expect(out[2]).toEqual([56, 126]);
  });

  it('fans a pile of thin books out left and right', () => {
    const out = spreadPins([[0.5, 0.5], [0.5, 0.52], [0.5, 0.54]], 400, 300, 24);
    expect(out[0]).toEqual([200, 150]);
    expect(out[1]).toEqual([224, 156]);
    expect(out[2]).toEqual([176, 162]);
  });

  it('stays inside the picture', () => {
    const out = spreadPins([[0.5, 0.99], [0.51, 0.99]], 400, 300, 24);
    expect((out[1] as [number, number])[1]).toBeLessThanOrEqual(300);
    expect(out[1]).toEqual([204, 273]);
  });
});

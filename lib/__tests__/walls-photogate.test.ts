/** The gate on photos read at once per instance (ROADMAP 2.18h). */
import { describe, expect, it } from 'vitest';
import { InFlight, PHOTOS_AT_ONCE } from '../walls/photogate';

describe('the photo gate (2.18h)', () => {
  it('lets PHOTOS_AT_ONCE photos in and turns the next away until one leaves', () => {
    const gate = new InFlight();
    for (let i = 0; i < PHOTOS_AT_ONCE; i++) expect(gate.enter()).toBe(true);
    expect(gate.enter()).toBe(false);
    expect(gate.inFlight).toBe(PHOTOS_AT_ONCE);
    gate.leave();
    expect(gate.enter()).toBe(true);
    expect(gate.inFlight).toBe(PHOTOS_AT_ONCE);
  });

  it('never counts below zero, however often a read leaves', () => {
    const gate = new InFlight(1);
    gate.leave();
    gate.leave();
    expect(gate.inFlight).toBe(0);
    expect(gate.enter()).toBe(true);
  });
});

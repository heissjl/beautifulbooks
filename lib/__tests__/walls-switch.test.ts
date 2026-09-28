import { describe, expect, it } from 'vitest';
import { wallsEnabled } from '../walls/switch';

describe('WALLS switch (E20)', () => {
  it('is off in Vercel production unless switched on, on everywhere else', () => {
    expect(wallsEnabled({ VERCEL_ENV: 'production' })).toBe(false);
    expect(wallsEnabled({ VERCEL_ENV: 'production', WALLS: 'on' })).toBe(true);
    expect(wallsEnabled({ VERCEL_ENV: 'preview' })).toBe(true);
    expect(wallsEnabled({})).toBe(true);
    expect(wallsEnabled({ WALLS: 'off' })).toBe(false);
  });

  it('refuses anything but on or off', () => {
    expect(() => wallsEnabled({ WALLS: 'yes' })).toThrow();
  });
});

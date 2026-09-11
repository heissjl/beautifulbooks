import { describe, expect, it } from 'vitest';
import { versusEnabled } from '../hotornot/switch';

describe('the game switch', () => {
  it('is on in previews and on a laptop, off in production unless switched on', () => {
    expect(versusEnabled({ VERCEL_ENV: 'preview' })).toBe(true);
    expect(versusEnabled({})).toBe(true);
    expect(versusEnabled({ VERCEL_ENV: 'production' })).toBe(false);
    expect(versusEnabled({ VERCEL_ENV: 'production', HOTORNOT: 'on' })).toBe(true);
    expect(versusEnabled({ VERCEL_ENV: 'preview', HOTORNOT: 'off' })).toBe(false);
    expect(versusEnabled({ VERCEL_ENV: 'production', HOTORNOT: ' ON ' })).toBe(true);
  });

  it('fails loudly on a typo instead of quietly meaning off', () => {
    expect(() => versusEnabled({ HOTORNOT: 'yes' })).toThrow(/HOTORNOT/);
  });
});

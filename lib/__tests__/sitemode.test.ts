import { describe, expect, it } from 'vitest';
import { commerceEnabled, siteMode } from '../sitemode';

describe('siteMode (E20)', () => {
  it('is hobby when unset, empty or hobby', () => {
    expect(siteMode(undefined)).toBe('hobby');
    expect(siteMode('')).toBe('hobby');
    expect(siteMode('hobby')).toBe('hobby');
    expect(siteMode(' Hobby ')).toBe('hobby');
  });
  it('is shop only when asked for', () => {
    expect(siteMode('shop')).toBe('shop');
    expect(commerceEnabled('shop')).toBe(true);
    expect(commerceEnabled('hobby')).toBe(false);
    expect(commerceEnabled('')).toBe(false);
  });
  it('refuses any other value instead of falling back', () => {
    expect(() => siteMode('prod')).toThrow(/NEXT_PUBLIC_SITE_MODE/);
    expect(() => siteMode('true')).toThrow();
  });
});

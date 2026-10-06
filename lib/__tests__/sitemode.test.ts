import { describe, expect, it } from 'vitest';
import { availabilityEnabled, commerceEnabled, siteMode } from '../sitemode';

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

describe('availabilityEnabled (ROADMAP 0.1: a switch of its own)', () => {
  it('stays off in shop mode unless its own switch says on', () => {
    expect(availabilityEnabled('shop', undefined)).toBe(false);
    expect(availabilityEnabled('shop', '')).toBe(false);
    expect(availabilityEnabled('shop', 'true')).toBe(false);
    expect(availabilityEnabled('shop', 'on')).toBe(true);
    expect(availabilityEnabled('shop', ' ON ')).toBe(true);
  });
  it('stays off in hobby mode even when its switch says on', () => {
    expect(availabilityEnabled('hobby', 'on')).toBe(false);
    expect(availabilityEnabled('', 'on')).toBe(false);
  });
});


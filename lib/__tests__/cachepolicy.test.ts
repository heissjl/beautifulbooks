/** The CDN keeps full answers, not silences (ROADMAP 2.18e, lib/cachepolicy.ts). */
import { describe, expect, it } from 'vitest';
import { CACHE_DEGRADED, CACHE_FULL, CACHE_NONE, CACHE_STAND_IN, isbnCacheControl, worksCacheControl } from '../cachepolicy';

describe('isbnCacheControl', () => {
  it('never keeps an answer nobody gave', () => {
    expect(isbnCacheControl({ unavailable: true })).toBe(CACHE_NONE);
  });
  it('keeps the catalogue’s stand-in an hour and Google’s answer a day', () => {
    expect(isbnCacheControl({ source: 'openlibrary' })).toBe(CACHE_STAND_IN);
    expect(isbnCacheControl({ source: 'googlebooks' })).toBe(CACHE_FULL);
  });
});

describe('worksCacheControl', () => {
  it('keeps a page 0 without Google a minute, otherwise the day', () => {
    expect(worksCacheControl({ googleSilent: true })).toBe(CACHE_DEGRADED);
    expect(worksCacheControl({})).toBe(CACHE_FULL);
  });
  it('lets the CDN serve the last good answer when the route errors', () => {
    expect(CACHE_FULL).toContain('stale-if-error=86400');
    expect(CACHE_DEGRADED).not.toContain('stale-while-revalidate');
  });
});

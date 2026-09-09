import { describe, expect, it } from 'vitest';
import { coverIdFromSegment, coverPathSegment, coverRefFromUrl, coverUrlFor, proxiedCoverSrc } from '../coverurl';

describe('cover ids in a share path (ROADMAP 6.20)', () => {
  it('goes there and back for both sources', () => {
    expect(coverPathSegment('ol:15251791')).toBe('ol-15251791');
    expect(coverIdFromSegment('ol-15251791')).toBe('ol:15251791');
    expect(coverIdFromSegment(coverPathSegment('gb:AbC-123_x'))).toBe('gb:AbC-123_x');
  });

  it('refuses what a stranger might type into the address bar', () => {
    for (const bad of [undefined, '', 'ol', '-15251791', 'xx-1', 'ol-', 'ol-../../etc', 'ol-<script>']) {
      expect(coverIdFromSegment(bad), bad).toBeNull();
    }
  });

  it('builds the image URL, and nothing for an id it does not know', () => {
    expect(coverUrlFor('ol:123', 'L')).toBe('https://covers.openlibrary.org/b/id/123-L.jpg');
    expect(coverUrlFor('gb:abc')).toContain('zoom=1');
    expect(coverUrlFor('ol:0')).toBeNull();
    expect(coverUrlFor('nope:1')).toBeNull();
  });
});

describe('the image route’s addresses (ROADMAP 1.3)', () => {
  it('rewrites the URLs this codebase builds', () => {
    expect(proxiedCoverSrc('https://covers.openlibrary.org/b/id/15213153-M.jpg')).toBe('/img/M/ol-15213153');
    expect(proxiedCoverSrc('https://covers.openlibrary.org/b/id/12543834-L.jpg')).toBe('/img/L/ol-12543834');
    expect(proxiedCoverSrc(coverUrlFor('gb:IyhvzwEACAAJ', 'M')!)).toBe('/img/M/gb-IyhvzwEACAAJ');
    expect(proxiedCoverSrc(coverUrlFor('gb:IyhvzwEACAAJ', 'L')!)).toBe('/img/L/gb-IyhvzwEACAAJ');
  });

  it('round-trips: what the route rebuilds is what the browser asked for', () => {
    for (const id of ['ol:15213153', 'gb:IyhvzwEACAAJ']) {
      for (const size of ['S', 'M', 'L'] as const) {
        const upstream = coverUrlFor(id, size)!;
        expect(coverRefFromUrl(upstream)).toEqual({ coverId: id, size });
      }
    }
  });

  it('leaves anything it did not build alone, rather than guessing', () => {
    // The safe direction: an unproxied image still loads.
    for (const url of [
      'https://example.com/cover.jpg',
      'https://covers.openlibrary.org/b/olid/OL123M-M.jpg',
      'https://books.google.com/books/content?id=abc&fife=w999',
      'https://evil.example/?x=https://covers.openlibrary.org/b/id/1-M.jpg',
    ]) {
      expect(proxiedCoverSrc(url)).toBe(url);
      expect(coverRefFromUrl(url)).toBeNull();
    }
  });
});

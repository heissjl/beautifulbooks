import { describe, expect, it } from 'vitest';
import { coverIdFromSegment, coverPathSegment, coverUrlFor } from '../coverurl';

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

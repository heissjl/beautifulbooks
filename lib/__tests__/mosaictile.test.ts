/**
 * The size a search card's tile asks for (ROADMAP 6.34, lib/coverurl.ts).
 */
import { describe, expect, it } from 'vitest';
import { mosaicTileSrc } from '../coverurl';

describe('mosaicTileSrc', () => {
  it('keeps the first tile at the size it came with', () => {
    expect(mosaicTileSrc('https://covers.openlibrary.org/b/id/8237639-L.jpg', 0)).toBe('/img/L/ol-8237639');
  });

  it('asks for the medium size everywhere else', () => {
    expect(mosaicTileSrc('https://covers.openlibrary.org/b/id/12455623-L.jpg', 1)).toBe('/img/M/ol-12455623');
    expect(mosaicTileSrc('https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&source=gbs_api&fife=w800', 3))
      .toBe('/img/M/gb-abc');
  });

  it('leaves an address it cannot rebuild alone', () => {
    expect(mosaicTileSrc('https://example.org/cover.jpg', 2)).toBe('https://example.org/cover.jpg');
  });
});

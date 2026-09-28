import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeShelf, encodeShelf, parseFragment, shelfFragment, type ShelfEntry } from '../sharelink';

/** Realistic Open Library numbers: works up to ~40 million, covers up to ~15 million. */
function shelf(n: number): ShelfEntry[] {
  return Array.from({ length: n }, (_, i) => ({ workId: `OL${27_000_000 + i * 104_729}W`, coverId: 12_000_000 + i * 7_919 }));
}

describe('share link', () => {
  it('round-trips order, ids and a missing cover', () => {
    const entries: ShelfEntry[] = [
      { workId: 'OL1168007W', coverId: 12648655 },
      { workId: 'OL45804W', coverId: 0 },
      { workId: 'OL1W', coverId: 1 },
      { workId: 'OL39999999W', coverId: 14999999 },
    ];
    expect(decodeShelf(encodeShelf(entries))).toEqual(entries);
  });

  it('round-trips an empty shelf', () => {
    expect(decodeShelf(encodeShelf([]))).toEqual([]);
  });

  it('refuses a malformed payload instead of guessing', () => {
    expect(decodeShelf('')).toBeNull();
    expect(decodeShelf('not base64!')).toBeNull();
    expect(decodeShelf('Ag')).toBeNull(); // version 2
    const good = encodeShelf([{ workId: 'OL45804W', coverId: 5 }]);
    expect(decodeShelf(good.slice(0, -1))).toBeNull(); // cut mid-varint or odd count
  });

  it('throws on something that is not a work id', () => {
    expect(() => encodeShelf([{ workId: 'OL123M', coverId: 1 }])).toThrow();
  });

  it('carries a title in the fragment', () => {
    const frag = shelfFragment(shelf(3), 'Mein Regal & Co.');
    expect(parseFragment(frag)).toEqual({ entries: shelf(3), title: 'Mein Regal & Co.' });
    expect(parseFragment('#x=1')).toBeNull();
  });

  it('stays short enough to paste: about 11 characters per book', () => {
    const base = 'http://127.0.0.1:4330/';
    const len20 = (base + shelfFragment(shelf(20))).length;
    const len60 = (base + shelfFragment(shelf(60))).length;
    // Measured 2026-09-26 with these ids: 240 and 667 characters (lab/shelf/README.md).
    expect(len20).toBeLessThan(260);
    expect(len60).toBeLessThan(700);
  });

  it('the page’s inline copy writes and reads the same bytes', () => {
    const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');
    const grab = (name: string) => {
      const start = html.indexOf(`function ${name}(`);
      const next = html.indexOf('\nfunction ', start + 1);
      const end = html.indexOf('\n\nconst $', start);
      return html.slice(start, next > 0 && next < end ? next : end);
    };
    const page = new Function(`${grab('encodeShelf')}\n${grab('decodeShelf')}\nreturn { encodeShelf, decodeShelf };`)() as {
      encodeShelf: typeof encodeShelf; decodeShelf: typeof decodeShelf;
    };
    const entries = shelf(25);
    expect(page.encodeShelf(entries)).toBe(encodeShelf(entries));
    expect(page.decodeShelf(encodeShelf(entries))).toEqual(entries);
  });
});

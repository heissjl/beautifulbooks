import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import { booksOnReader, findReader, isReader, makeThumb, ReaderCovers, thumbFile, thumbSize } from '../reader';

const dirs: string[] = [];
const folder = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'calibre-reader-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A colour picture, left half red and right half white. */
function cover(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      png.data[at] = 255;
      png.data[at + 1] = png.data[at + 2] = x < width / 2 ? 0 : 255;
      png.data[at + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}
const header = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20), bitDepth: png[24], colorType: png[25] });

/** A reader as the firmware lays it out, with one book Calibre sent and the picture the reader made of it. */
function fakeReader(): { root: string; lpath: string; old: Buffer } {
  const root = folder();
  const lpath = 'Books/Strugatsky, Arkady & Strugatsky, Boris/Roadside Picnic - Arkady Strugatsky & Boris Strugatsky.epub';
  mkdirSync(join(root, 'Books/Strugatsky, Arkady & Strugatsky, Boris'), { recursive: true });
  writeFileSync(join(root, lpath), 'the book itself');
  mkdirSync(join(root, 'system/cover_chache/1/Books/Strugatsky, Arkady & Strugatsky, Boris'), { recursive: true });
  const old = makeThumb(cover(100, 160)) as Buffer;
  writeFileSync(join(root, 'system/cover_chache/1', `${lpath}.png`), old);
  writeFileSync(join(root, 'metadata.calibre'), JSON.stringify([{ application_id: 403, lpath, title: 'Roadside Picnic' }, { application_id: 7, lpath: 'Books/gone.epub' }, { lpath: 'Books/not-calibres.epub' }]));
  return { root, lpath, old };
}

describe('the picture the reader keeps of a book', () => {
  it('fits into 260 × 393 and is never enlarged', () => {
    expect(thumbSize(996, 1500)).toEqual({ width: 260, height: 392 });
    expect(thumbSize(1080, 1832)).toEqual({ width: 232, height: 393 });
    expect(thumbSize(200, 300)).toEqual({ width: 200, height: 300 });
  });

  it('is grey, 8 bit, and the mean of what it covers', () => {
    const thumb = makeThumb(cover(1040, 1572)) as Buffer;
    expect(header(thumb)).toEqual({ width: 260, height: 393, bitDepth: 8, colorType: 0 });
    const back = PNG.sync.read(thumb);
    // Red is 76 in grey (Rec. 601), white 255; pngjs hands grey back as RGBA.
    expect(back.data[0]).toBe(76);
    expect(back.data[(100 * 260 + 259) * 4]).toBe(255);
    expect(makeThumb(Buffer.from('not an image'))).toBeNull();
  });
});

describe('finding the reader and its books', () => {
  it('knows a PocketBook by its picture folder and Calibre’s list, and takes one only when there is exactly one', () => {
    const volumes = folder();
    mkdirSync(join(volumes, 'Macintosh HD'));
    expect(findReader(volumes)).toBeNull();
    const { root } = fakeReader();
    expect(isReader(root)).toBe(true);
    mkdirSync(join(volumes, 'PB626/system/cover_chache/1'), { recursive: true });
    expect(findReader(volumes)).toBeNull();
    writeFileSync(join(volumes, 'PB626/metadata.calibre'), '[]');
    expect(findReader(volumes)).toBe(join(volumes, 'PB626'));
  });

  it('reads which file is which Calibre book, and leaves out what Calibre does not number', () => {
    const books = booksOnReader([{ application_id: 403, lpath: 'a.epub' }, { application_id: 403, lpath: 'a.mobi' }, { lpath: 'x.epub' }, { application_id: 'x', lpath: 'y.epub' }, { application_id: 189, lpath: 'system/config/Active Contents/Our Man.epub_A_08a9.html' }, null]);
    expect([...books]).toEqual([[403, ['a.epub', 'a.mobi']]]);
    expect(booksOnReader({ not: 'a list' }).size).toBe(0);
  });

  it('never names a picture outside the reader’s picture folder', () => {
    expect(thumbFile('/Volumes/PB626', 'Books/a.epub')).toBe('/Volumes/PB626/system/cover_chache/1/Books/a.epub.png');
    expect(() => thumbFile('/Volumes/PB626', '../../config/books.db')).toThrow(/outside/);
  });
});

describe('putting a cover on the reader', () => {
  it('writes the picture and nothing else, keeps the old one, and puts it back', () => {
    const { root, lpath, old } = fakeReader();
    const keep = join(folder(), 'reader');
    const reader = new ReaderCovers(root, keep);
    const picture = join(root, 'system/cover_chache/1', `${lpath}.png`);

    const result = reader.put(403, cover(1080, 1832), 'ol:1');
    expect(result).toEqual({ ok: true, lpaths: [lpath] });
    expect(header(readFileSync(picture))).toMatchObject({ width: 232, height: 393, colorType: 0 });
    expect(readFileSync(join(root, lpath), 'utf8')).toBe('the book itself');
    expect(readdirSync(join(root, 'system/cover_chache/1/Books/Strugatsky, Arkady & Strugatsky, Boris'))).toHaveLength(1);
    expect(reader.status([403, 7, 99])).toEqual(new Map([[403, { onReader: true, put: 'ol:1' }], [7, { onReader: false }], [99, { onReader: false }]]));

    // A second cover later: what goes back is still the reader's own picture, not the first of ours.
    reader.put(403, cover(600, 900), 'ol:2');
    expect(reader.back(403)).toEqual({ ok: true, lpaths: [lpath] });
    expect(readFileSync(picture).equals(old)).toBe(true);
    expect(reader.status([403]).get(403)).toEqual({ onReader: true });
    expect(reader.back(403)).toMatchObject({ ok: false });
  });

  it('refuses a book that is not on the reader and a cover that does not decode, and changes nothing', () => {
    const { root, lpath, old } = fakeReader();
    const keep = join(folder(), 'reader');
    const reader = new ReaderCovers(root, keep);
    expect(reader.put(7, cover(600, 900))).toMatchObject({ ok: false, error: expect.stringContaining('not on the reader') });
    expect(reader.put(99, cover(600, 900))).toMatchObject({ ok: false });
    expect(reader.put(403, Buffer.from('half a file'))).toMatchObject({ ok: false, error: expect.stringContaining('does not decode') });
    expect(readFileSync(join(root, 'system/cover_chache/1', `${lpath}.png`)).equals(old)).toBe(true);
    expect(existsSync(keep)).toBe(false);
  });
});

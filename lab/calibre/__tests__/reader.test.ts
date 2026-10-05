import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import { booksOnReader, findReader, homePositions, isReader, makeThumb, picturesOf, positionBox, ReaderCovers, thumbFile, thumbSize } from '../reader';

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
    const thumb = makeThumb(cover(520, 786)) as Buffer;
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

describe('the pictures of the home screen', () => {
  const lpath = 'Books/Strugatsky, Arkady & Strugatsky, Boris/Roadside Picnic - Arkady Strugatsky & Boris Strugatsky.epub';
  const index = [
    'rb.1.author=Arkady Strugatsky, Boris Strugatsky',
    `rb.1.path=/mnt/ext1/${lpath}`,
    'rb.1.title=Roadside Picnic',
    'rb.2.path=/mnt/ext1/Books/Frisch, Max/Montauk - Frisch, Max.epub',
    't.1.path=',
    `t.41.path=/mnt/ext1/${lpath}`,
    `t.7.title=/mnt/ext1/${lpath}`,
  ].join('\n');

  /** The fake reader, with the home screen's pictures as the firmware makes them: one per size, and copies by position. */
  function withHome(): { root: string; old: Buffer } {
    const { root, old } = fakeReader();
    const sized = join(root, 'system/cache/desktop/1/Books/Strugatsky, Arkady & Strugatsky, Boris');
    mkdirSync(sized, { recursive: true });
    const picture = cover(400, 640);
    for (const [w, h] of [[268, 396], [250, 368], [123, 184]]) writeFileSync(join(sized, `Roadside Picnic - Arkady Strugatsky & Boris Strugatsky.epub_${w}x${h}.png`), makeThumb(picture, { width: w, height: h }) as Buffer);
    // Another book's picture in the same folder, and one whose name only starts alike.
    writeFileSync(join(sized, 'Ugly Swans, The - Arkady Strugatsky & Boris Strugatsky.epub_268x396.png'), old);
    writeFileSync(join(sized, 'Roadside Picnic - Arkady Strugatsky & Boris Strugatsky.epub.bak_268x396.png'), old);
    for (const dir of ['rb', 't']) mkdirSync(join(root, 'system/cache/desktop', dir), { recursive: true });
    writeFileSync(join(root, 'system/cache/desktop/rb/1.png'), makeThumb(cover(400, 640), { width: 268, height: 396 }) as Buffer);
    writeFileSync(join(root, 'system/cache/desktop/rb/2.png'), old);
    writeFileSync(join(root, 'system/cache/desktop/t/41.png'), makeThumb(cover(400, 640), { width: 123, height: 184 }) as Buffer);
    writeFileSync(join(root, 'system/cache/desktop/cache.dat'), index);
    return { root, old };
  }

  it('finds the positions that show a book, by its path and nothing else', () => {
    expect(homePositions(index, lpath)).toEqual(['rb/1.png', 't/41.png']);
    expect(homePositions(index, 'Books/Frisch, Max/Montauk - Frisch, Max.epub')).toEqual(['rb/2.png']);
    expect(homePositions(index, '')).toEqual([]);
  });

  it('lists the library’s picture, each size the reader made, and the positions with the size they show', () => {
    const { root } = withHome();
    const rel = (file: string) => file.slice(root.length + 1);
    expect(picturesOf(root, lpath).map((p) => [rel(p.file), p.box.width, p.box.height, p.where])).toEqual([
      [`system/cover_chache/1/${lpath}.png`, 260, 393, 'library'],
      [`system/cache/desktop/1/${lpath}_123x184.png`, 123, 184, 'home'],
      [`system/cache/desktop/1/${lpath}_250x368.png`, 250, 368, 'home'],
      [`system/cache/desktop/1/${lpath}_268x396.png`, 268, 396, 'home'],
      ['system/cache/desktop/rb/1.png', 268, 396, 'home'],
      ['system/cache/desktop/t/41.png', 123, 184, 'home'],
    ]);
    // A book the reader keeps no sizes of still has the position that shows it, in that position's size.
    expect(picturesOf(root, 'Books/Frisch, Max/Montauk - Frisch, Max.epub').map((p) => [rel(p.file), p.box.width, p.box.height])).toEqual([
      ['system/cover_chache/1/Books/Frisch, Max/Montauk - Frisch, Max.epub.png', 260, 393],
      ['system/cache/desktop/rb/2.png', 250, 368],
    ]);
    // And one that stands nowhere on the home screen has the library's picture only.
    expect(picturesOf(root, 'Books/Dick, Philip K_/Ubik - Philip K. Dick.epub')).toHaveLength(1);
    expect([1, 2, 3, 4, 5, 9].map((n) => positionBox(`rb/${n}.png`).width)).toEqual([268, 250, 234, 268, 250, 234]);
    expect(positionBox('t/41.png')).toEqual({ width: 123, height: 184 });
  });

  it('writes them all in their own sizes, leaves the index and the other books alone, and puts every one back', () => {
    const { root, old } = withHome();
    const before = new Map(picturesOf(root, lpath).map((p) => [p.file, readFileSync(p.file)]));
    const reader = new ReaderCovers(root, join(folder(), 'reader'));
    const result = reader.put(403, cover(540, 916), 'ol:1');
    expect(result.ok && result.pictures).toHaveLength(6);
    expect(header(readFileSync(join(root, 'system/cache/desktop/rb/1.png')))).toMatchObject({ width: 233, height: 396, colorType: 0 });
    expect(header(readFileSync(join(root, `system/cache/desktop/1/${lpath}_123x184.png`)))).toMatchObject({ width: 108, height: 184 });
    expect(readFileSync(join(root, 'system/cache/desktop/cache.dat'), 'utf8')).toBe(index);
    expect(readFileSync(join(root, 'system/cache/desktop/rb/2.png')).equals(old)).toBe(true);
    expect(readFileSync(join(root, 'system/cache/desktop/1/Books/Strugatsky, Arkady & Strugatsky, Boris/Ugly Swans, The - Arkady Strugatsky & Boris Strugatsky.epub_268x396.png')).equals(old)).toBe(true);
    expect(readFileSync(join(root, lpath), 'utf8')).toBe('the book itself');

    const back = reader.back(403);
    expect(back.ok && back.pictures).toHaveLength(6);
    for (const [file, bytes] of before) expect(readFileSync(file).equals(bytes)).toBe(true);
  });

  it('puts back the reader’s own library picture when the first write was recorded before pictures had names in the record', () => {
    const { root, old } = withHome();
    const keep = join(folder(), 'reader');
    mkdirSync(join(keep, 'pictures/403'), { recursive: true });
    writeFileSync(join(keep, 'pictures/403/first.png'), old);
    writeFileSync(join(keep, 'reader.jsonl'), `${JSON.stringify({ at: '2026-10-05T01:25:21.056Z', action: 'put', bookId: 403, lpath, coverId: 'ol:1', backup: join(keep, 'pictures/403/first.png') })}\n`);
    writeFileSync(join(root, 'system/cover_chache/1', `${lpath}.png`), makeThumb(cover(600, 900)) as Buffer);
    const reader = new ReaderCovers(root, keep);
    reader.put(403, cover(540, 916), 'ol:2');
    reader.back(403);
    expect(readFileSync(join(root, 'system/cover_chache/1', `${lpath}.png`)).equals(old)).toBe(true);
  });
});

describe('putting a cover on the reader', () => {
  it('writes the picture and nothing else, keeps the old one, and puts it back', () => {
    const { root, lpath, old } = fakeReader();
    const keep = join(folder(), 'reader');
    const reader = new ReaderCovers(root, keep);
    const picture = join(root, 'system/cover_chache/1', `${lpath}.png`);

    const result = reader.put(403, cover(540, 916), 'ol:1');
    expect(result).toEqual({ ok: true, lpaths: [lpath], pictures: [`system/cover_chache/1/${lpath}.png`] });
    expect(header(readFileSync(picture))).toMatchObject({ width: 232, height: 393, colorType: 0 });
    expect(readFileSync(join(root, lpath), 'utf8')).toBe('the book itself');
    expect(readdirSync(join(root, 'system/cover_chache/1/Books/Strugatsky, Arkady & Strugatsky, Boris'))).toHaveLength(1);
    expect(reader.status([403, 7, 99])).toEqual(new Map([[403, { onReader: true, put: 'ol:1' }], [7, { onReader: false }], [99, { onReader: false }]]));
    // For the app's overview: the books whose file is there (7 is listed, its file is gone), and the cover last put.
    expect(reader.present()).toEqual(new Set([403]));
    expect(reader.lastPut()).toEqual(new Map([[403, 'ol:1']]));

    // A second cover later: what goes back is still the reader's own picture, not the first of ours.
    reader.put(403, cover(600, 900), 'ol:2');
    expect(reader.back(403)).toEqual({ ok: true, lpaths: [lpath], pictures: [`system/cover_chache/1/${lpath}.png`] });
    expect(readFileSync(picture).equals(old)).toBe(true);
    expect(reader.status([403]).get(403)).toEqual({ onReader: true });
    expect(reader.lastPut().size).toBe(0);
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

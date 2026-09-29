import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import { heicToJpeg, shrinkRgba } from '@/lib/walls/heicjpeg';
import { looksLikeHeif } from '@/lib/walls/photofile';

// 80 x 50, written by `sips -s format heic` from a PNG, as an iPhone would write it.
const HEIC = new Uint8Array(readFileSync(join(__dirname, '..', '__fixtures__', 'photo-80x50.heic')));

const head = (text: string) => new Uint8Array([0, 0, 0, 0x20, ...Array.from(text, (c) => c.charCodeAt(0))]);

describe('looksLikeHeif', () => {
  it('knows an iPhone photo by its first bytes, whatever its name or type', () => {
    expect(looksLikeHeif(HEIC.subarray(0, 12))).toBe(true);
    expect(looksLikeHeif(head('ftypmif1'))).toBe(true);
  });

  it('leaves JPEG, PNG, AVIF and short files alone', () => {
    expect(looksLikeHeif(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]))).toBe(false);
    expect(looksLikeHeif(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]))).toBe(false);
    expect(looksLikeHeif(head('ftypavif'))).toBe(false);
    expect(looksLikeHeif(head('ftyp'))).toBe(false);
  });
});

describe('shrinkRgba', () => {
  it('keeps an image that already fits', () => {
    const image = { width: 4, height: 2, data: new Uint8Array(32) };
    expect(shrinkRgba(image, 4)).toBe(image);
  });

  it('averages every source pixel into the smaller image', () => {
    // 4 x 2: left half black, right half white → 2 x 1: one black, one white.
    const data = new Uint8Array(4 * 2 * 4);
    for (let y = 0; y < 2; y++) for (let x = 2; x < 4; x++) data.fill(255, (y * 4 + x) * 4, (y * 4 + x) * 4 + 4);
    const out = shrinkRgba({ width: 4, height: 2, data }, 2);
    expect([out.width, out.height]).toEqual([2, 1]);
    expect(Array.from(out.data)).toEqual([0, 0, 0, 0, 255, 255, 255, 255]);
  });
});

describe('heicToJpeg', () => {
  it('turns a HEIC into a JPEG with the long edge shrunk', async () => {
    const out = await heicToJpeg(HEIC, 40);
    expect([out.width, out.height]).toEqual([40, 25]);
    const back = jpeg.decode(out.jpeg);
    expect([back.width, back.height]).toEqual([40, 25]);
  });

  it('throws on bytes libheif cannot read, rather than returning an empty picture', async () => {
    await expect(heicToJpeg(head('ftypheic'), 40)).rejects.toThrow();
  });
});

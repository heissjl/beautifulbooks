import { describe, expect, it } from 'vitest';
import jpeg from 'jpeg-js';
import { exifOrientation, orient, preparePhoto, shrink } from '../photoprep';
import { decode } from '../imagehash';

/** A w × h image whose top-left quarter is red and the rest grey. */
const picture = (w: number, h: number) => {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const red = x < w / 2 && y < h / 2; rgba[i] = red ? 220 : 128; rgba[i + 1] = red ? 30 : 128; rgba[i + 2] = red ? 30 : 128; rgba[i + 3] = 255; }
  return { width: w, height: h, rgba };
};
const at = (img: { width: number; rgba: Uint8Array }, x: number, y: number) => img.rgba[(y * img.width + x) * 4];

/** A JPEG with an APP1 Exif segment carrying the orientation tag, big-endian. */
function withOrientation(bytes: Uint8Array, orientation: number): Uint8Array {
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0];
  const app1 = [0xff, 0xe1, 0, 0, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  app1[2] = ((app1.length - 2) >> 8) & 0xff; app1[3] = (app1.length - 2) & 0xff;
  return new Uint8Array([0xff, 0xd8, ...app1, ...bytes.slice(2)]);
}

describe('photoprep (5.11a): the photo as the model gets it, made on the server', () => {
  it('reads the EXIF orientation, and says 1 when there is none', () => {
    const plain = new Uint8Array(jpeg.encode({ width: 4, height: 4, data: Buffer.from(picture(4, 4).rgba) }, 80).data);
    expect(exifOrientation(plain)).toBe(1);
    expect(exifOrientation(withOrientation(plain, 6))).toBe(6);
    expect(exifOrientation(withOrientation(plain, 8))).toBe(8);
    expect(exifOrientation(new Uint8Array([0x89, 0x50]))).toBe(1);
  });

  it('turns a photo upright: 6 is a quarter turn clockwise, 8 anticlockwise, 3 upside down', () => {
    const p = picture(4, 2); // red top-left
    const six = orient(p, 6);
    expect([six.width, six.height]).toEqual([2, 4]);
    expect(at(six, 1, 0)).toBe(220); // red moves to the top-right
    expect(at(six, 0, 3)).toBe(128);
    const eight = orient(p, 8);
    expect(at(eight, 0, 3)).toBe(220); // ... or the bottom-left
    const three = orient(p, 3);
    expect(at(three, 3, 1)).toBe(220); // ... or the bottom-right
    expect(orient(p, 1)).toBe(p);
  });

  it('shrinks to the long edge by box means and leaves a small picture alone', () => {
    const big = picture(40, 20);
    const small = shrink(big, 10);
    expect([small.width, small.height]).toEqual([10, 5]);
    expect(at(small, 0, 0)).toBe(220);
    expect(at(small, 9, 4)).toBe(128);
    expect(shrink(big, 100)).toBe(big);
  });

  it('prepares a rotated JPEG as an upright plain JPEG without EXIF, and refuses what it cannot decode', () => {
    const p = picture(40, 20);
    const raw = new Uint8Array(jpeg.encode({ width: 40, height: 20, data: Buffer.from(p.rgba) }, 90).data);
    const out = preparePhoto(withOrientation(raw, 6));
    expect(out).toMatchObject({ width: 20, height: 40, orientation: 6, shrunk: false });
    expect(exifOrientation(new Uint8Array(out!.bytes))).toBe(1);
    const back = decode(new Uint8Array(out!.bytes))!;
    expect(at(back, 18, 1)).toBeGreaterThan(180); // red top-right
    expect(at(back, 1, 38)).toBeLessThan(160);
    expect(preparePhoto(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

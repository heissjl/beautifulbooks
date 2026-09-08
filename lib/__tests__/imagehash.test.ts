import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { decodeToGray, dhash, hamming, looksLikeScannedPage, signature } from '../imagehash';
import { colourDistance, decodeHues } from '../imagesig';

/**
 * Synthetic "covers" with horizontal structure (dHash compares left/right
 * neighbours): a gradient with dark stripes at fixed positions. Design b
 * reverses the gradient and moves the stripes.
 */
function paint(width: number, height: number, variant: 'a' | 'a-noisy' | 'b' | 'blank'): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fx = x / width;
      const fy = y / height;
      let v: number;
      if (variant === 'blank') v = 251; // scanned paper, not mid-grey
      else if (variant === 'b') v = Math.round((1 - fx) * 255) - (fx > 0.55 && fx < 0.7 ? 90 : 0) - (fy < 0.15 ? 60 : 0);
      else v = Math.round(fx * 255) - (fx > 0.2 && fx < 0.35 ? 90 : 0) - (fy > 0.4 && fy < 0.6 ? 60 : 0);
      if (variant === 'a-noisy') v += ((x * 7 + y * 13) % 5) - 2;
      v = Math.max(0, Math.min(255, v));
      const p = (y * width + x) * 4;
      rgba[p] = v; rgba[p + 1] = v; rgba[p + 2] = v; rgba[p + 3] = 255;
    }
  }
  return rgba;
}

function pngBytes(width: number, height: number, variant: Parameters<typeof paint>[2]): Uint8Array {
  const png = new PNG({ width, height });
  png.data = Buffer.from(paint(width, height, variant));
  return new Uint8Array(PNG.sync.write(png));
}

function jpegBytes(width: number, height: number, variant: Parameters<typeof paint>[2]): Uint8Array {
  return new Uint8Array(jpeg.encode({ width, height, data: Buffer.from(paint(width, height, variant)) }, 85).data);
}

describe('imagehash', () => {
  it('decodes PNG and JPEG to grayscale', () => {
    expect(decodeToGray(pngBytes(20, 30, 'a'))).toMatchObject({ width: 20, height: 30 });
    expect(decodeToGray(jpegBytes(20, 30, 'a'))).toMatchObject({ width: 20, height: 30 });
    expect(decodeToGray(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('gives near-identical hashes for the same design at different sizes, formats and noise', () => {
    const a1 = dhash(decodeToGray(pngBytes(60, 90, 'a'))!);
    const a2 = dhash(decodeToGray(jpegBytes(180, 270, 'a'))!);
    const a3 = dhash(decodeToGray(pngBytes(100, 150, 'a-noisy'))!);
    expect(a1).toHaveLength(16);
    expect(hamming(a1, a2)).toBeLessThanOrEqual(4);
    expect(hamming(a1, a3)).toBeLessThanOrEqual(6);
  });

  it('separates different designs', () => {
    const a = dhash(decodeToGray(pngBytes(60, 90, 'a'))!);
    const b = dhash(decodeToGray(pngBytes(60, 90, 'b'))!);
    expect(hamming(a, b)).toBeGreaterThan(16);
  });

  it('measures a blank page as flat, pale and structureless', () => {
    const blank = signature(pngBytes(60, 90, 'blank'))!;
    expect(blank.contrast).toBe(0);
    expect(blank.mean).toBeGreaterThan(200);
    expect(looksLikeScannedPage(blank)).toBe(true);

    const cover = signature(pngBytes(60, 90, 'a'))!;
    expect(cover.contrast).toBeGreaterThan(20);
    expect(looksLikeScannedPage(cover)).toBe(false);
  });

  it('never flags a signature recorded before mean luminance existed', () => {
    expect(looksLikeScannedPage({ hash: '0000000000000000', contrast: 0 })).toBe(false);
  });

  it('hamming distance basics', () => {
    expect(hamming('0000000000000000', '0000000000000000')).toBe(0);
    expect(hamming('ffffffffffffffff', '0000000000000000')).toBe(64);
    expect(hamming('f', '0000000000000000')).toBe(64);
  });
});

/**
 * Colour signatures (ROADMAP 6.10, PLAN-speicher §3.1).
 *
 * The dHash sees only structure, so "looks like this one" — a statement
 * about colour — needs its own measure. Verified on real jackets on
 * 2026-09-08: the beige linen 1984 and the orange Lolita came out at 0.18,
 * the cyan Neuromancer and the red Berlin Alexanderplatz at 0.88.
 */
function flood(hex: [number, number, number], width = 40, height = 60): Uint8Array {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = hex[0];
    png.data[i * 4 + 1] = hex[1];
    png.data[i * 4 + 2] = hex[2];
    png.data[i * 4 + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(png));
}

describe('colour signature', () => {
  const sigOf = (rgb: [number, number, number]) => signature(flood(rgb), { colour: true })!;
  const red = sigOf([220, 30, 30]);
  const crimson = sigOf([190, 40, 60]);
  const teal = sigOf([20, 170, 180]);
  const grey = sigOf([128, 128, 128]);

  it('is measured only when asked for', () => {
    const plain = signature(flood([220, 30, 30]))!;
    expect(plain.hues).toBeUndefined();
    expect(plain.saturation).toBeUndefined();
    expect(red.hues).toBeTruthy();
  });

  it('puts two reds closer together than a red and a teal', () => {
    const near = colourDistance(red, crimson)!;
    const far = colourDistance(red, teal)!;
    expect(near).toBeLessThan(0.2);
    expect(far).toBeGreaterThan(0.7);
    expect(near).toBeLessThan(far);
  });

  it('scores grey as unsaturated, and keeps it away from vivid colour', () => {
    expect(grey.saturation).toBe(0);
    expect(red.saturation).toBeGreaterThan(200);
    // A grey image has no hue at all, so only the vividness penalty separates
    // them — without that penalty a photograph would match every jacket.
    expect(colourDistance(grey, red)!).toBeGreaterThan(0.2);
  });

  it('answers null rather than guessing when a signature has no colour', () => {
    expect(colourDistance(signature(flood([220, 30, 30]))!, red)).toBeNull();
  });

  it('survives a malformed histogram instead of throwing', () => {
    expect(colourDistance({ ...red, hues: 'not base64!!' }, red)).toBeNull();
    expect(decodeHues('AAAA')).toBeNull();
  });
});

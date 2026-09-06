import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { BLANK_CONTRAST, contrast, decodeToGray, dhash, hamming, signature } from '../imagehash';

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
      if (variant === 'blank') v = 240;
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

  it('flags blank scans by contrast', () => {
    expect(contrast(decodeToGray(pngBytes(60, 90, 'blank'))!)).toBeLessThan(BLANK_CONTRAST);
    expect(contrast(decodeToGray(pngBytes(60, 90, 'a'))!)).toBeGreaterThan(BLANK_CONTRAST);
    expect(signature(pngBytes(10, 10, 'blank'))).toMatchObject({ contrast: 0 });
  });

  it('hamming distance basics', () => {
    expect(hamming('0000000000000000', '0000000000000000')).toBe(0);
    expect(hamming('ffffffffffffffff', '0000000000000000')).toBe(64);
    expect(hamming('f', '0000000000000000')).toBe(64);
  });
});

import { describe, expect, it } from 'vitest';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { imageSize } from '../imagesize';

describe('imageSize', () => {
  it('reads a JPEG and a PNG header without decoding', () => {
    const data = Buffer.alloc(37 * 23 * 4, 128);
    expect(imageSize(new Uint8Array(jpeg.encode({ data, width: 37, height: 23 }, 80).data))).toEqual({ width: 37, height: 23 });
    const png = new PNG({ width: 37, height: 23 });
    data.copy(png.data);
    expect(imageSize(new Uint8Array(PNG.sync.write(png)))).toEqual({ width: 37, height: 23 });
  });

  it('says null for anything else', () => {
    expect(imageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { RgbaImage } from '../../../lib/imagehash';
import {
  PHOTO_MAX_HAMMING, coverIdFromUrl, cropBox, pickCover, pickWork, sameAuthor, signatureOfImage, titleScore,
} from '../match';

/** Shaped like a `search()` answer for "1984 Orwell": the ranked order is the search's own. */
const works = [
  { id: 'OL1168083W', title: '1984 (adaptation)', authors: ['Michael Dean', 'George Orwell'] },
  { id: 'OL1168007W', title: 'Nineteen Eighty-Four', authors: ['George Orwell'] },
  { id: 'OL999W', title: 'Nineteen Eighty-Four (York Notes)', authors: ['Brian Nobody'] },
];

describe('sameAuthor', () => {
  it('matches a surname alone, as a spine prints it', () => {
    expect(sameAuthor('ORWELL', 'George Orwell')).toBe(true);
    expect(sameAuthor('Orwell, George', 'George Orwell')).toBe(true);
    expect(sameAuthor('García Márquez', 'Gabriel García Márquez')).toBe(true);
  });
  it('keeps two people with the same surname apart when both first names are there', () => {
    expect(sameAuthor('Anne Brontë', 'Emily Brontë')).toBe(false);
    expect(sameAuthor('', 'George Orwell')).toBe(false);
  });
});

describe('titleScore', () => {
  it('scores equal, contained and different titles', () => {
    expect(titleScore('The Great Gatsby', 'Great Gatsby')).toBe(2);
    expect(titleScore('Dune', 'Dune Messiah')).toBe(1);
    expect(titleScore('It', 'Kitchen')).toBe(0);
  });
});

describe('pickWork', () => {
  it('prefers primary author and title over the search’s first place', () => {
    expect(pickWork(works, { title: 'Nineteen Eighty-Four', author: 'George Orwell' })).toEqual({ index: 1, reason: 'author+title' });
  });
  it('never takes a study guide for the book just because the title matches', () => {
    expect(pickWork(works, { title: 'Nineteen Eighty-Four', author: 'Orwell' })?.index).toBe(1);
  });
  it('falls back to the title, then to the ranked order, and says which', () => {
    expect(pickWork(works, { title: 'Nineteen Eighty-Four', author: 'Somebody Else' })).toEqual({ index: 1, reason: 'title-only' });
    expect(pickWork(works, { title: 'Something unrelated', author: '' })).toEqual({ index: 0, reason: 'first-result' });
    expect(pickWork([], { title: 'x', author: 'y' })).toBeNull();
  });
});

describe('coverIdFromUrl', () => {
  it('reads the Open Library id and nothing else', () => {
    expect(coverIdFromUrl('https://covers.openlibrary.org/b/id/12648655-M.jpg')).toBe(12648655);
    expect(coverIdFromUrl('https://books.google.com/books/content?id=abc')).toBeUndefined();
    expect(coverIdFromUrl(undefined)).toBeUndefined();
  });
});

/** A synthetic image: left half dark, right half light, with a red square. */
function picture(width: number, height: number, shift = 0): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const v = x < width / 2 + shift ? 40 : 220;
      const red = x > width * 0.6 && x < width * 0.8 && y > height * 0.2 && y < height * 0.4;
      rgba[p] = red ? 200 : v; rgba[p + 1] = red ? 30 : v; rgba[p + 2] = red ? 30 : v; rgba[p + 3] = 255;
    }
  }
  return { width, height, rgba };
}

describe('cropBox', () => {
  it('cuts the box out pixel for pixel', () => {
    const img = picture(100, 50);
    const crop = cropBox(img, [0.5, 0.2, 0.3, 0.4])!;
    expect(crop.width).toBe(30);
    expect(crop.height).toBe(20);
    // Top-left of the crop is pixel (50, 10) of the photo.
    expect(Array.from(crop.rgba.subarray(0, 4))).toEqual(Array.from(img.rgba.subarray((10 * 100 + 50) * 4, (10 * 100 + 50) * 4 + 4)));
  });
  it('refuses a box too small to hash', () => {
    expect(cropBox(picture(100, 50), [0.1, 0.1, 0.02, 0.5])).toBeNull();
  });
});

describe('pickCover', () => {
  const photo = signatureOfImage(picture(90, 135));
  const same = signatureOfImage(picture(60, 90, 1));
  const other = signatureOfImage(picture(60, 90, -25));

  it('finds the same design among the work’s covers', () => {
    const found = pickCover(photo, [{ coverId: 2, signature: other }, { coverId: 1, signature: same }]);
    expect(found?.coverId).toBe(1);
    expect(found!.distance).toBeLessThanOrEqual(PHOTO_MAX_HAMMING);
  });

  it('chooses nothing when no cover is near enough, so the wall says "default" instead of claiming the edition', () => {
    const far = { ...same, hash: same.hash.split('').map(c => (15 - parseInt(c, 16)).toString(16)).join('') };
    expect(pickCover(photo, [{ coverId: 3, signature: far }])).toBeNull();
  });

  it('lets colour veto a structural match when both sides carry it', () => {
    // Same structure as the photo, but all blue where the photo is red.
    const blueish = { ...same, hues: Buffer.from(new Uint8Array(16).map((_, i) => (i === 10 ? 255 : 0))).toString('base64'), saturation: 250 };
    expect(pickCover(photo, [{ coverId: 4, signature: blueish }])).toBeNull();
    // Without colour on the candidate, structure alone decides.
    expect(pickCover(photo, [{ coverId: 5, signature: { hash: same.hash, contrast: same.contrast } }])?.coverId).toBe(5);
  });
});

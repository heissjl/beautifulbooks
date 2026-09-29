import { describe, expect, it } from 'vitest';
import { countImageTypes, isVinyl, vinylColourNote, type MbRelease } from '../parse';

const release = (over: Partial<MbRelease>): MbRelease => ({ id: 'x', title: 'Rumours', ...over });

describe('isVinyl', () => {
  it('finds vinyl in any medium', () => {
    expect(isVinyl(release({ media: [{ format: 'CD' }, { format: '12" Vinyl' }] }))).toBe(true);
    expect(isVinyl(release({ media: [{ format: 'Cassette' }] }))).toBe(false);
    expect(isVinyl(release({ media: [{ format: null }] }))).toBe(false);
    expect(isVinyl(release({}))).toBe(false);
  });
});

describe('vinylColourNote', () => {
  it('reads the colour from the disambiguation', () => {
    expect(vinylColourNote(release({ disambiguation: 'limited red vinyl' }))).toBe('red');
    expect(vinylColourNote(release({ disambiguation: 'Picture Disc' }))).toBe('picture disc');
    expect(vinylColourNote(release({ disambiguation: 'coloured vinyl, numbered' }))).toBe('coloured');
  });

  it('says nothing when nothing is written, rather than guessing black', () => {
    expect(vinylColourNote(release({ disambiguation: '2011 remaster' }))).toBeNull();
    expect(vinylColourNote(release({}))).toBeNull();
  });
});

describe('countImageTypes', () => {
  it('counts each type of an image, untyped ones apart', () => {
    expect(countImageTypes([
      { types: ['Front'], front: true, back: false },
      { types: ['Back', 'Spine'], front: false, back: true },
      { types: ['Medium'], front: false, back: false },
      { types: [], front: false, back: false },
    ])).toEqual({ Front: 1, Back: 1, Spine: 1, Medium: 1, '(untyped)': 1 });
  });
});

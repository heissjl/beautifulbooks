import { describe, expect, it } from 'vitest';
import { distinguishingNote, sleeveCredits, sleeveLine } from '../captions';
import { excerpt } from '../wiki';

const kindOfBlue = {
  pressings: 42, first: '1959', last: '2025', countries: ['US', 'AU', 'CA', 'GB', 'FR', 'JP'], labels: ['Columbia', 'Coronet Records', 'Fontana'],
  mbCredits: [], discogsCredits: ['Photography By: Jay Maisel', 'Sleeve Notes: Bill Evans', 'Photography By [Cover Photo]: Jay Maisel', 'Sleeve Notes: Benny Green (2)'],
  notes: [],
};

describe('sleeveCredits', () => {
  it('names who made the picture once, and leaves sleeve notes and back-cover photos out (Autobahn: Niemöller shot the back)', () => {
    expect(sleeveCredits(kindOfBlue)).toEqual(['Photo: Jay Maisel']);
    expect(sleeveCredits({ mbCredits: ['design/illustration: Emil Schult', 'photography: Barbara Niemöller'], discogsCredits: ['Photography By [Backcoverphoto]: Barbara Niemöller', 'Painting [Coverpainting]: Emil Schult'] }))
      .toEqual(['Design: Emil Schult', 'Painting: Emil Schult']);
  });
});

describe('sleeveCredits on a stack of reissues', () => {
  it('keeps the names most pressings agree on, at most two per kind (Kind of Blue, Columbia stack)', () => {
    const credits = [
      ...Array(9).fill('Photography By [Cover Photo]: Jay Maisel'),
      'Photography By: Don Hunstein', 'Design: John A. Beck', 'Design: Studio voor Visuele Pop.Cultuur',
    ];
    expect(sleeveCredits({ mbCredits: [], discogsCredits: credits })).toEqual(['Photo: Jay Maisel']);
  });
});

describe('sleeveLine', () => {
  it('sets label, years, pressings, countries and credits in one line', () => {
    expect(sleeveLine(kindOfBlue)).toBe('Columbia, Coronet Records · 1959–2025 · 42 pressings with a photo, 6 countries · Photo: Jay Maisel');
    expect(sleeveLine({ ...kindOfBlue, pressings: 1, first: '1993', last: '1993', countries: ['RU'], labels: ['Russian Disc'], discogsCredits: [] }))
      .toBe('Russian Disc · 1993 · 1 pressing with a photo, 1 country');
  });
});

describe('distinguishingNote', () => {
  it('picks the note that tells the sleeve apart and skips printers and stickers', () => {
    expect(distinguishingNote([
      'Sleeve: ℗ © 1974 Phonogram, Inc. Printed in U.S.A.',
      "This UK release has a 'Motorway logo' sleeve design with the white areas not embossed.",
    ])).toBe("This UK release has a 'Motorway logo' sleeve design with the white areas not embossed.");
    expect(distinguishingNote(['Dutch issue with unique cover photography and orange CBS labels.'])).toBe('Dutch issue with unique cover photography and orange CBS labels.');
    expect(distinguishingNote(['Printed in England by Robor Limited (sleeve).', 'Cat# on sticker upper right rear of outer gatefold sleeve.'])).toBeNull();
  });
});

describe('excerpt', () => {
  it('keeps whole paragraphs up to the limit, and cuts a long first one at a sentence end', () => {
    expect(excerpt('First para.\n\nSecond para.\n\n' + 'x'.repeat(800), 100)).toBe('First para.\n\nSecond para.');
    expect(excerpt('One. Two sentences here. ' + 'y'.repeat(50), 30)).toBe('One. Two sentences here.');
  });
});

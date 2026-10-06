import { describe, expect, it } from 'vitest';
import { rgbToOklab } from '../../colorsort/color';
import { colourGap, pickBySpine, publisherTokens, samePublisher, type EditionCandidate } from '../edition';

const lab = (r: number, g: number, b: number) => rgbToOklab(r, g, b);
const cover = (id: number, publisher: string | undefined, main: [number, number, number], other: [number, number, number] = [245, 240, 230]): EditionCandidate =>
  ({ coverId: id, publisher, colours: [{ lab: lab(...main), share: 0.6 }, { lab: lab(...other), share: 0.4 }] });

describe('publisher', () => {
  it('drops the words every publisher has', () => {
    expect(publisherTokens('Penguin Books Ltd.')).toEqual(['penguin']);
    expect(publisherTokens('Suhrkamp Verlag')).toEqual(['suhrkamp']);
  });

  it('matches a spine name to its record, loosely', () => {
    expect(samePublisher('Penguin', 'Penguin Books')).toBe(true);
    expect(samePublisher('suhrkamp taschenbuch', 'Suhrkamp')).toBe(true);
    expect(samePublisher('dtv', 'Deutscher Taschenbuch Verlag')).toBe(true);
    expect(samePublisher('Fischer', 'S. Fischer Verlag')).toBe(true);
    expect(samePublisher('Penguin', 'Vintage')).toBe(false);
    expect(samePublisher('Penguin', undefined)).toBe(false);
  });
});

describe('pickBySpine', () => {
  const orange = lab(235, 110, 30);

  it('takes the publisher’s cover whose colour the spine carries', () => {
    const r = pickBySpine({ lab: orange }, 'Penguin', [
      cover(1, 'Vintage', [236, 112, 32]),        // right colour, wrong publisher
      cover(2, 'Penguin Books', [30, 60, 140]),    // right publisher, wrong colour
      cover(3, 'Penguin Books', [228, 105, 40]),   // both
    ]);
    expect(r.pick?.coverId).toBe(3);
    expect(r.ranked.map(c => c.coverId)).toEqual([3, 2, 1]);
  });

  it('says nothing when the publisher’s covers are all another colour', () => {
    const r = pickBySpine({ lab: orange }, 'Penguin', [cover(2, 'Penguin Books', [30, 60, 140])]);
    expect(r.pick).toBeNull();
    expect(r.ranked).toHaveLength(1);
  });

  it('picks by colour alone only when one cover clearly wins', () => {
    const clear = pickBySpine({ lab: orange }, undefined, [cover(1, 'A', [236, 112, 32]), cover(2, 'B', [30, 60, 140])]);
    expect(clear.pick?.coverId).toBe(1);
    const toss = pickBySpine({ lab: orange }, undefined, [cover(1, 'A', [236, 112, 32]), cover(2, 'B', [232, 108, 36])]);
    expect(toss.pick).toBeNull();
  });

  it('measures the gap to a main colour, not to a speck', () => {
    const c = [{ lab: lab(235, 110, 30), share: 0.05 }, { lab: lab(20, 20, 20), share: 0.95 }];
    expect(colourGap({ lab: orange }, c)).toBeGreaterThan(0.3);
  });
});

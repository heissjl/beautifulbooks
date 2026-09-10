import { describe, expect, it } from 'vitest';
import index from '../../data/cover-index.json';
import { HERO_FAN } from '../herofan';
import { COLOUR_MAX, SAME_DESIGN_BITS } from '../coverindex';
import { colourDistance, hamming, looksLikeScannedPage, type ImageSignature } from '../imagesig';

type Raw = { works: [string, string, string][]; covers: [number, string, string, number, number, number, string][] };
const raw = index as unknown as Raw;

function signatureOf(coverId: string): { work: string; sig: ImageSignature } {
  const row = raw.covers.find(c => c[1] === coverId);
  if (!row) throw new Error(`${coverId} is not in the cover index`);
  return { work: raw.works[row[0]][0], sig: { hash: row[2], contrast: row[3], mean: row[4], saturation: row[5], hues: row[6] } };
}

/**
 * The fan says "one book, four faces". Each half of that is checked here:
 * the ids belong to the named work, and no two of them are the same design
 * or even the same colour family. A swapped id that broke either would make
 * the first thing on the page say the opposite of what it is for.
 */
describe('the home page fan (ROADMAP 1.9)', () => {
  const picks = HERO_FAN.coverIds.map(signatureOf);

  it('shows four covers of the one book it names', () => {
    expect(HERO_FAN.coverIds).toHaveLength(4);
    expect(new Set(HERO_FAN.coverIds).size).toBe(4);
    for (const p of picks) expect(p.work).toBe(HERO_FAN.workId);
    expect(raw.works.find(w => w[0] === HERO_FAN.workId)?.[1]).toBe(HERO_FAN.title);
  });

  it('shows four different faces, well beyond the folding and similarity gates', () => {
    for (let i = 0; i < picks.length; i++) {
      for (let j = i + 1; j < picks.length; j++) {
        expect(hamming(picks[i].sig.hash, picks[j].sig.hash)).toBeGreaterThan(SAME_DESIGN_BITS);
        expect(colourDistance(picks[i].sig, picks[j].sig) ?? 1).toBeGreaterThan(COLOUR_MAX * 4);
      }
    }
  });

  it('shows no scan that looks like a blank page', () => {
    for (const p of picks) expect(looksLikeScannedPage(p.sig)).toBe(false);
  });
});

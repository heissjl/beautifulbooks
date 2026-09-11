import { describe, expect, it } from 'vitest';
import index from '../../data/cover-index.json';
import { HERO_FAN, HERO_RING_IDS } from '../herofan';
import { COLOUR_MAX, SAME_DESIGN_BITS, STRUCTURE_MAX } from '../coverindex';
import { colourDistance, hamming, HASH_BITS, looksLikeScannedPage, type ImageSignature } from '../imagesig';
import { SAME_COVER_MAX_DISTANCE, SAME_ISBN_MAX_DISTANCE, SAME_PRINTING_MAX_DISTANCE } from '../works';

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

/** The rondell makes the same promise with seven faces (1.9, 2026-09-11). */
describe('the home page rondell', () => {
  const ring = HERO_RING_IDS.map(signatureOf);

  it("shows seven different covers of the one book, the fan's four among them", () => {
    expect(HERO_RING_IDS).toHaveLength(7);
    expect(new Set(HERO_RING_IDS).size).toBe(7);
    for (const id of HERO_FAN.coverIds) expect(HERO_RING_IDS).toContain(id);
    for (const p of ring) {
      expect(p.work).toBe(HERO_FAN.workId);
      expect(looksLikeScannedPage(p.sig)).toBe(false);
    }
  });

  it('keeps every pair further apart in structure than any threshold the site uses', () => {
    // Julian 2026-09-11: the ring's covers must differ by more than the loosest
    // rule anywhere — the folding tiers and the "looks like this" structure gate.
    const loosest = Math.max(
      SAME_DESIGN_BITS,
      SAME_COVER_MAX_DISTANCE,
      SAME_PRINTING_MAX_DISTANCE,
      SAME_ISBN_MAX_DISTANCE,
      Math.ceil(STRUCTURE_MAX * HASH_BITS),
    );
    expect(loosest).toBe(SAME_ISBN_MAX_DISTANCE);
    for (let i = 0; i < ring.length; i++) {
      for (let j = i + 1; j < ring.length; j++) {
        expect(hamming(ring[i].sig.hash, ring[j].sig.hash)).toBeGreaterThan(loosest);
        expect(colourDistance(ring[i].sig, ring[j].sig) ?? 1).toBeGreaterThan(COLOUR_MAX * 4);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import index from '../../data/cover-index.json';
import ringsFile from '../../data/hero-rings.json';
import { CURATED_LIST } from '../curated';
import { HERO_RINGS, pickHeroRing } from '../herofan';
import {
  pickRing,
  ringPairOk,
  ringsFor,
  RING_MIN_BITS,
  RING_MIN_COLOUR,
  RING_SIZE,
  type CoverIndexFile,
  type RingCandidate,
} from '../heroring';
import { colourDistance, hamming, looksLikeScannedPage, type ImageSignature } from '../imagesig';
import { SAME_ISBN_MAX_DISTANCE } from '../works';

const raw = index as unknown as CoverIndexFile;

function signatureOf(coverId: string): { work: string; sig: ImageSignature } {
  const row = raw.covers.find(c => c[1] === coverId);
  if (!row) throw new Error(`${coverId} is not in the cover index`);
  return { work: raw.works[row[0]][0], sig: { hash: row[2], contrast: row[3], mean: row[4], saturation: row[5], hues: row[6] } };
}

/**
 * The ring says "one book, many faces". Both halves are checked on every ring
 * the home page can draw: the ids belong to the curated book it names, and no
 * two of them are near each other by any rule the site uses (ROADMAP 1.9).
 */
describe('the home page rings (ROADMAP 1.9)', () => {
  it('are exactly what the rules give for the committed index and curated list', () => {
    // Rebuilt with `npx tsx scripts/build-hero-rings.ts`; a stale file fails here, not on the home page.
    expect(HERO_RINGS).toEqual(ringsFor(raw, CURATED_LIST));
  });

  it('leave plenty of books to draw from', () => {
    expect(HERO_RINGS.length).toBeGreaterThan(10);
  });

  it('clear the loosest threshold of the site, which today is the fold for a shared ISBN', () => {
    // Julian 2026-09-11: further apart than any threshold used anywhere else.
    expect(RING_MIN_BITS).toBe(SAME_ISBN_MAX_DISTANCE);
    expect(ringsFile.rules).toEqual({ size: RING_SIZE, minBits: RING_MIN_BITS, minColour: RING_MIN_COLOUR });
  });

  it('each show seven different faces of the curated book they name', () => {
    const curated = new Map(CURATED_LIST.map(w => [w.id, w]));
    for (const ring of HERO_RINGS) {
      expect(curated.get(ring.workId)?.title).toBe(ring.title);
      expect(ring.coverIds).toHaveLength(RING_SIZE);
      expect(new Set(ring.coverIds).size).toBe(RING_SIZE);
      const sigs = ring.coverIds.map(signatureOf);
      for (const s of sigs) {
        expect(s.work).toBe(ring.workId);
        expect(looksLikeScannedPage(s.sig)).toBe(false);
      }
      for (let i = 0; i < sigs.length; i++) {
        for (let j = i + 1; j < sigs.length; j++) {
          expect(hamming(sigs[i].sig.hash, sigs[j].sig.hash)).toBeGreaterThan(RING_MIN_BITS);
          expect(colourDistance(sigs[i].sig, sigs[j].sig)).toBeGreaterThan(RING_MIN_COLOUR);
        }
      }
    }
  });

  it('draw one ring per visit, from anywhere in the list', () => {
    expect(pickHeroRing(() => 0)).toBe(HERO_RINGS[0]);
    expect(pickHeroRing(() => 0.999999)).toBe(HERO_RINGS[HERO_RINGS.length - 1]);
  });
});

describe('pickRing', () => {
  it('gives no ring when the covers are one design many times over', () => {
    const one = signatureOf(HERO_RINGS[0].coverIds[0]).sig;
    const same: RingCandidate[] = Array.from({ length: 12 }, (_, i) => ({ id: `ol:${i}`, sig: one }));
    expect(pickRing(same)).toBeNull();
  });

  it('refuses a pair whose colour is unknown, since it cannot show that it differs', () => {
    const a = signatureOf(HERO_RINGS[0].coverIds[0]).sig;
    const b = signatureOf(HERO_RINGS[0].coverIds[1]).sig;
    expect(ringPairOk(a, b)).toBe(true);
    expect(ringPairOk({ ...a, hues: undefined }, b)).toBe(false);
  });
});

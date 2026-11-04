import { describe, expect, it } from 'vitest';
import index from '../../data/cover-index.json';
import ringsFile from '../../data/hero-rings.json';
import signaturesFile from '../../data/hero-ring-signatures.json';
import { collectionRecords, parseCollections } from '../collections';
import { CURATED_LIST } from '../curated';
import { COLLECTION_RINGS, COLLECTION_RING_SHARE, HERO_RINGS, pickHeroPick, pickHeroRing } from '../herofan';
import {
  collectionPairOk,
  collectionRingsFor,
  COLLECTION_RING_MIN_COLOUR,
  COLLECTION_RING_MIN_COVERS,
  pickCollectionRing,
  ringCollections,
  signatureMap,
  type SignatureFile,
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
import { SAME_COVER_MAX_DISTANCE, SAME_ISBN_MAX_DISTANCE } from '../works';

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

/**
 * Collection rings (ROADMAP 6.59): seven books of one published collection.
 * Built from data/collections.json with signatures the build measured into
 * data/hero-ring-signatures.json, so this runs without network.
 */
describe('the collection rings (ROADMAP 6.59)', () => {
  const sigs = signatureMap(raw, signaturesFile as unknown as SignatureFile);
  const published = ringCollections(parseCollections(collectionRecords(), { includeDrafts: false }));

  it('are exactly what the rules give for the committed collections and signatures', () => {
    // Rebuilt with `npx tsx scripts/build-hero-rings.ts`. A cover added to a
    // collection has no signature yet and cannot change a ring; a cover taken
    // off a collection that stood on its ring fails here.
    expect(COLLECTION_RINGS).toEqual(collectionRingsFor(published, sigs));
    expect(ringsFile.collectionRules).toEqual({ minCovers: COLLECTION_RING_MIN_COVERS, minColour: COLLECTION_RING_MIN_COLOUR });
  });

  it('exist for more than one collection', () => {
    expect(COLLECTION_RINGS.length).toBeGreaterThan(1);
  });

  it('each show seven different books of the published collection they name, by seven authors', () => {
    const bySlug = new Map(published.map(c => [c.slug, c]));
    for (const ring of COLLECTION_RINGS) {
      const collection = bySlug.get(ring.slug);
      expect(collection?.title).toBe(ring.title);
      expect(collection?.published).toBe(true);
      expect(ring.covers).toHaveLength(RING_SIZE);
      expect(new Set(ring.covers.map(c => c.author)).size).toBe(RING_SIZE);
      for (const c of ring.covers) {
        const pick = collection?.works.find(w => `ol:${w.coverId}` === c.coverId);
        expect(pick, `${c.coverId} on ${ring.slug}`).toBeDefined();
        expect(c.workId).toBe(pick?.coverWork ?? pick?.id);
        expect(looksLikeScannedPage(sigs.get(c.coverId))).toBe(false);
      }
      const s = ring.covers.map(c => sigs.get(c.coverId) as ImageSignature);
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          expect(hamming(s[i].hash, s[j].hash)).toBeGreaterThan(SAME_COVER_MAX_DISTANCE);
          expect(colourDistance(s[i], s[j])).toBeGreaterThan(COLLECTION_RING_MIN_COLOUR);
        }
      }
    }
  });

  it('take one visit in three, and only for a collection published on the site now', () => {
    const live = COLLECTION_RINGS.map(r => r.slug);
    expect(pickHeroPick(live, () => 0).kind).toBe('collection');
    expect(pickHeroPick(live, () => COLLECTION_RING_SHARE + 0.01).kind).toBe('work');
    // Switched off on /curate: the file still has its ring, the home page must not link it.
    expect(pickHeroPick([], () => 0).kind).toBe('work');
    const only = pickHeroPick([live[1]], () => 0);
    expect(only.kind === 'collection' && only.ring.slug).toBe(live[1]);
  });
});

describe('pickCollectionRing', () => {
  const ring = COLLECTION_RINGS[0];
  const sigs = signatureMap(raw, signaturesFile as unknown as SignatureFile);
  const candidates = ring.covers.map(c => ({ id: c.coverId, sig: sigs.get(c.coverId) as ImageSignature, cover: c }));

  it('gives no ring to a collection with fewer covers than the minimum', () => {
    expect(COLLECTION_RING_MIN_COVERS).toBeGreaterThan(RING_SIZE);
    expect(pickCollectionRing(candidates)).toBeNull();
  });

  it('refuses two books by one author', () => {
    const [a, b] = candidates;
    expect(collectionPairOk(a, b)).toBe(true);
    expect(collectionPairOk(a, { ...b, cover: { ...b.cover, author: a.cover.author } })).toBe(false);
  });

  it('refuses the same image under two books', () => {
    const [a, b] = candidates;
    expect(collectionPairOk(a, { ...b, sig: { ...b.sig, hash: a.sig.hash } })).toBe(false);
  });
});

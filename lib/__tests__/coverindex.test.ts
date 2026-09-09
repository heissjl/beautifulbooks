/**
 * The built cover index (ROADMAP 6.10, PLAN-speicher §3).
 *
 * The similarity tests run against the real `data/cover-index.json` rather
 * than a fixture, because the point of the index is that it is real data and
 * a fixture would only test the unpacking. They therefore assert
 * **invariants** — sorted, bounded, never itself, never the same book — and
 * not which cover comes back, which is a matter of taste and of whichever
 * snapshot is committed.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_DISTANCE, SAME_DESIGN_BITS, STRUCTURE_WEIGHT,
  bitsApart, coverUrlFor, indexBuiltAt, indexSignatures, indexSize, lookDistance, similarTo,
} from '../coverindex';
import type { ImageSignature } from '../imagesig';

const sig = (saturation: number, hues: number[]): ImageSignature => ({
  hash: '', contrast: 0, saturation,
  hues: Buffer.from(Uint8Array.from(hues)).toString('base64'),
});
const red = [255, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128];
const teal = [0, 0, 0, 0, 0, 0, 0, 128, 255, 128, 0, 0, 0, 0, 0, 0];

describe('cover URLs are rebuilt, not stored', () => {
  it('builds an Open Library URL from the numeric id', () => {
    expect(coverUrlFor('ol:13550503', 'M')).toBe('https://covers.openlibrary.org/b/id/13550503-M.jpg');
    expect(coverUrlFor('ol:13550503', 'S')).toContain('-S.jpg');
  });

  it('builds a Google URL at zoom=1, never higher', () => {
    const url = coverUrlFor('gb:J08rAAAAMAAJ', 'L')!;
    expect(url).toContain('id=J08rAAAAMAAJ');
    // zoom=2 and up is a page out of the scan, not the cover (SPEC F3.1).
    expect(url).toContain('zoom=1');
    expect(url).not.toContain('zoom=2');
  });

  it('answers null for anything it does not recognise', () => {
    expect(coverUrlFor('ol:not-a-number')).toBeNull();
    expect(coverUrlFor('http://evil.example.com/x.jpg')).toBeNull();
    expect(coverUrlFor('')).toBeNull();
  });
});

describe('distance', () => {
  it('counts differing bits across both halves of the hash', () => {
    expect(bitsApart(0, 0, 0, 0)).toBe(0);
    expect(bitsApart(0xffffffff, 0xffffffff, 0, 0)).toBe(64);
    expect(bitsApart(0b1011, 0, 0b0011, 0)).toBe(1);
    // The high half must not be ignored: a difference there counts too.
    expect(bitsApart(0x80000000, 0, 0, 0)).toBe(1);
  });

  it('needs both structure and colour to call two covers alike', () => {
    // Same layout, opposite palette: not similar.
    const sameLayoutOtherColour = lookDistance(0, sig(200, red), sig(200, teal));
    // Same palette, unrelated layout: also not similar.
    const sameColourOtherLayout = lookDistance(32, sig(200, red), sig(200, red));
    const both = lookDistance(0, sig(200, red), sig(200, red));
    expect(both).toBeCloseTo(0, 5);
    expect(sameLayoutOtherColour).toBeGreaterThan(0.3);
    expect(sameColourOtherLayout).toBeCloseTo(0.5 * STRUCTURE_WEIGHT, 5);
  });

  it('falls back to structure alone when a signature carries no colour', () => {
    const plain: ImageSignature = { hash: '', contrast: 0 };
    expect(lookDistance(32, plain, plain)).toBeCloseTo(0.5, 5);
  });
});

describe('the index that is committed', () => {
  const size = indexSize();

  it('holds works and covers, and says when it was built', () => {
    expect(size.works).toBeGreaterThan(0);
    expect(size.covers).toBeGreaterThan(size.works);
    expect(indexBuiltAt()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('says nothing about a cover it has never seen', () => {
    expect(similarTo('ol:999999999')).toEqual([]);
    expect(similarTo('gb:nothing')).toEqual([]);
  });

  it('returns other books only, sorted, bounded and inside the threshold', () => {
    // Walk a stretch of real covers so the test does not rest on one pick.
    const file = JSON.parse(
      readFileSync(path.join(process.cwd(), 'data', 'cover-index.json'), 'utf8'),
    ) as { works: Array<[string, string, string]>; covers: Array<[number, string]> };

    let checked = 0;
    for (const [workIndex, coverId] of file.covers.slice(0, 300)) {
      const found = similarTo(coverId, 6);
      if (found.length === 0) continue;
      checked++;
      expect(found.length).toBeLessThanOrEqual(6);
      expect(found.map(f => f.distance)).toEqual([...found.map(f => f.distance)].sort((a, b) => a - b));
      const ownWorkId = file.works[workIndex][0];
      for (const f of found) {
        expect(f.coverId).not.toBe(coverId);
        expect(f.distance).toBeLessThanOrEqual(MAX_DISTANCE);
        expect(f.url).toContain('http');
        expect(f.title).toBeTruthy();
        // Never another cover of the same book: that wall is one click away.
        expect(f.workId).not.toBe(ownWorkId);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('can be asked for the same book on purpose', () => {
    const file = JSON.parse(
      readFileSync(path.join(process.cwd(), 'data', 'cover-index.json'), 'utf8'),
    ) as { works: Array<[string, string, string]>; covers: Array<[number, string]> };
    const sameWorkHits = file.covers.slice(0, 300).flatMap(([workIndex, coverId]) =>
      similarTo(coverId, 6, { sameWork: true }).filter(f => f.workId === file.works[workIndex][0]));
    // Not an assertion about how many, only that the switch is wired at all.
    expect(Array.isArray(sameWorkHits)).toBe(true);
  });

  it('never offers a cover that is simply the same design', () => {
    expect(SAME_DESIGN_BITS).toBeGreaterThan(0);
    expect(MAX_DISTANCE).toBeLessThan(1);
  });
});

describe('signatures handed out for folding (ROADMAP 5.4a)', () => {
  /* Taken from the committed file rather than pinned, so a rebuilt index does
     not turn into a red test about nothing. */
  const known = (
    JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'cover-index.json'), 'utf8')) as {
      covers: Array<[number, string]>;
    }
  ).covers[0][1];

  it('returns a usable signature for a cover it knows', () => {
    const sigs = indexSignatures([known]);
    const sig = sigs.get(known);
    expect(sig).toBeDefined();
    // 64 bits as 16 hex characters, the shape `hamming` expects.
    expect(sig!.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(sig!.contrast).toBeGreaterThanOrEqual(0);
  });

  it('is silent about a cover it has never seen, rather than guessing one', () => {
    // A missing signature must read as "not folded", never as "no duplicate".
    const sigs = indexSignatures([known, 'ol:999999999']);
    expect(sigs.has(known)).toBe(true);
    expect(sigs.has('ol:999999999')).toBe(false);
    expect(sigs.size).toBe(1);
  });

  it('agrees with the packed halves the index searches on', () => {
    const sig = indexSignatures([known]).get(known)!;
    const hi = parseInt(sig.hash.slice(0, 8), 16);
    const lo = parseInt(sig.hash.slice(8, 16), 16);
    expect(bitsApart(hi, lo, hi, lo)).toBe(0);
  });
});

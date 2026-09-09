/**
 * The built cover index: which covers exist, and what each one looks like
 * (ROADMAP 6.10, PLAN-speicher §3, decision E18).
 *
 * **Server-side only.** The JSON is over a megabyte at five hundred works;
 * importing this module from a client component would ship all of it to the
 * browser. The client asks `/api/similar/<coverId>` and gets six answers.
 * Same trap as `lib/imagehash.ts`, and it is in CLAUDE.md for the same reason.
 *
 * The file is read once at module load and unpacked into typed arrays: each
 * 64-bit hash as two 32-bit halves, the colour measures as bytes. Two
 * `Uint32Array` lookups and two XORs beat a `BigUint64Array` here — and they
 * do not require raising the ES target for one literal.
 * A search is then a linear scan over a few tens of thousands of XORs, which
 * is microseconds — no tree, no query language, no database. Left as
 * JavaScript objects the same data would occupy several megabytes of heap
 * for no gain.
 *
 * The index is a **snapshot** and goes stale as the catalogues change. That
 * is tolerable because it carries nothing that has to be true: it answers
 * "what looks like this", never "which edition should I buy". `builtAt` says
 * when, and a cover the index does not know returns nothing at all rather
 * than a guess.
 */
import indexFile from '@/data/cover-index.json';
import { HASH_BITS, colourDistance, type ImageSignature } from './imagesig';

interface RawIndex {
  builtAt: string;
  works: Array<[id: string, title: string, author: string]>;
  covers: Array<[work: number, cover: string, hash: string, contrast: number, mean: number, saturation: number, hues: string]>;
}

export interface SimilarCover {
  coverId: string;
  workId: string;
  title: string;
  author: string;
  url: string;
  urlSmall: string;
  /** 0 (indistinguishable) to 1 (nothing in common). */
  distance: number;
}

/*
  `coverUrlFor` lives in `lib/coverurl.ts` since 2026-09-09: the share route
  needs one cover's URL and must not drag the whole index in to get it.
  Re-exported here because callers of the index expect it.
*/
import { coverUrlFor } from './coverurl';
export { coverUrlFor };

interface Unpacked {
  builtAt: string;
  works: RawIndex['works'];
  coverIds: string[];
  /** Work index per cover, aligned with `coverIds`. */
  workOf: Uint16Array;
  /** The 64-bit dHash split in two, high half first. */
  hashHi: Uint32Array;
  hashLo: Uint32Array;
  saturation: Uint8Array;
  /** Luminance standard deviation, needed to hand out a full ImageSignature. */
  contrast: Uint8Array;
  hues: string[];
  positionOf: Map<string, number>;
}

let unpacked: Unpacked | null = null;

function load(): Unpacked {
  if (unpacked) return unpacked;
  const raw = indexFile as RawIndex;
  const n = raw.covers.length;
  const out: Unpacked = {
    builtAt: raw.builtAt,
    works: raw.works,
    coverIds: new Array<string>(n),
    workOf: new Uint16Array(n),
    hashHi: new Uint32Array(n),
    hashLo: new Uint32Array(n),
    saturation: new Uint8Array(n),
    contrast: new Uint8Array(n),
    hues: new Array<string>(n),
    positionOf: new Map(),
  };
  for (let i = 0; i < n; i++) {
    const [work, coverId, hash, contrast, , saturation, hues] = raw.covers[i];
    out.coverIds[i] = coverId;
    out.workOf[i] = work;
    out.hashHi[i] = parseInt(hash.slice(0, 8), 16);
    out.hashLo[i] = parseInt(hash.slice(8, 16), 16);
    out.saturation[i] = saturation;
    out.contrast[i] = contrast;
    out.hues[i] = hues;
    out.positionOf.set(coverId, i);
  }
  unpacked = out;
  return out;
}

export function indexBuiltAt(): string {
  return load().builtAt;
}

export function indexSize(): { works: number; covers: number } {
  const idx = load();
  return { works: idx.works.length, covers: idx.coverIds.length };
}

/**
 * Signatures for these covers, out of the built index (ROADMAP 5.4a, 2026-09-09).
 *
 * The point is what it does **not** do: no image is fetched and nothing is
 * hashed. A server-rendered page can therefore fold duplicates, which the
 * normal path cannot afford — `dedupeCovers: true` downloads and hashes every
 * cover, and that is what made the decade page answer 404 in production.
 *
 * Only covers the index knows come back. A caller must treat a missing
 * signature as "not folded", never as "no duplicate": the index is a snapshot
 * of the curated works and is silent about everything else.
 */
export function indexSignatures(coverIds: readonly string[]): Map<string, ImageSignature> {
  const idx = load();
  const out = new Map<string, ImageSignature>();
  for (const id of coverIds) {
    const at = idx.positionOf.get(id);
    if (at === undefined) continue;
    const hi = idx.hashHi[at].toString(16).padStart(8, '0');
    const lo = idx.hashLo[at].toString(16).padStart(8, '0');
    out.set(id, { hash: hi + lo, contrast: idx.contrast[at], saturation: idx.saturation[at], hues: idx.hues[at] });
  }
  return out;
}

/** Set bits in a 32-bit word, by the usual halving trick. */
function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >>> 24;
}

/** Bits differing between two 64-bit hashes held as high and low halves. */
export function bitsApart(aHi: number, aLo: number, bHi: number, bLo: number): number {
  return popcount32(aHi ^ bHi) + popcount32(aLo ^ bLo);
}

/**
 * When two covers count as looking alike.
 *
 * The first attempt blended structure and colour into one number and let
 * anything under 0.45 through. Measured on the built index over 58.000
 * random pairs of covers from different books, that was meaningless: the
 * median pair scores 0.51 on colour and 0.48 on structure, so a blend at 0.45
 * admitted **every** cover — all 5.621 of them had a neighbour, and looking
 * at the results, four of six samples were noise.
 *
 * So both measures are **gates**, not weights, and both are set where the
 * distribution says the top one percent begins:
 *
 * | percentile of random pairs | colour | structure |
 * |---|---|---|
 * | 0.1 % | 0.03 | 0.20 |
 * | 1 % | 0.09 | 0.28 |
 * | 5 % | 0.17 | 0.36 |
 * | 50 % | 0.51 | 0.48 |
 *
 * The gates were then set by looking, not by arithmetic. At the one-percent
 * mark (colour 0.09, structure 0.28) roughly half of all covers still found a
 * neighbour and the pairs were unconvincing — a black-and-white *1984* beside
 * a cream *L'étranger*. Tightening colour to 0.055 leaves **11 % of covers
 * with any neighbour at all**, and those pairs hold up: the cream Gallimard
 * *1984* finds the cream Gallimard *L'étranger*, the brown cloth binding
 * finds *Brave New World* and *Ulysses* in the same muted board, the plain
 * typographic ones find each other. Most covers show no row, which is the
 * right outcome for a feature that should be a find rather than a fixture.
 *
 * Ranking among the survivors leans on colour, because "looks like this one"
 * is mostly a statement about palette; the dHash is there to stop a red
 * jacket matching every other red thing regardless of how it is laid out.
 */
export const COLOUR_MAX = 0.055;
export const STRUCTURE_MAX = 0.28;
export const STRUCTURE_WEIGHT = 0.35;

/** Below this the two are the same design, which the wall already folds away. */
export const SAME_DESIGN_BITS = 8;

/**
 * The worst score a shown pair can have, which follows from the two gates
 * rather than being chosen. Anything above it means a gate leaked.
 */
export const MAX_DISTANCE = STRUCTURE_MAX * STRUCTURE_WEIGHT + COLOUR_MAX * (1 - STRUCTURE_WEIGHT);

export function lookDistance(structureBits: number, aSig: ImageSignature, bSig: ImageSignature): number {
  const structure = structureBits / HASH_BITS;
  const colour = colourDistance(aSig, bSig);
  if (colour === null) return structure;
  return structure * STRUCTURE_WEIGHT + colour * (1 - STRUCTURE_WEIGHT);
}

/**
 * Covers that look like this one, nearest first.
 *
 * Excludes the cover itself, anything within `SAME_DESIGN_BITS` of it (that
 * is the same design, and saying "this cover looks like this cover" helps
 * nobody), and — unless asked otherwise — every other cover of the same
 * work, because a book's own wall is one click away already.
 *
 * Returns an empty list for a cover the index has never seen. That is the
 * honest answer: the index covers fifty works, not the catalogue.
 */
export function similarTo(coverId: string, limit = 6, { sameWork = false } = {}): SimilarCover[] {
  const idx = load();
  const at = idx.positionOf.get(coverId);
  if (at === undefined) return [];

  const ownWork = idx.workOf[at];
  const source: ImageSignature = { hash: '', contrast: 0, saturation: idx.saturation[at], hues: idx.hues[at] };
  const found: SimilarCover[] = [];

  for (let i = 0; i < idx.coverIds.length; i++) {
    if (i === at) continue;
    if (!sameWork && idx.workOf[i] === ownWork) continue;
    const bits = bitsApart(idx.hashHi[at], idx.hashLo[at], idx.hashHi[i], idx.hashLo[i]);
    if (bits <= SAME_DESIGN_BITS) continue;
    if (bits / HASH_BITS > STRUCTURE_MAX) continue;
    const other: ImageSignature = { hash: '', contrast: 0, saturation: idx.saturation[i], hues: idx.hues[i] };
    const colour = colourDistance(source, other);
    if (colour === null || colour > COLOUR_MAX) continue;
    const distance = lookDistance(bits, source, other);
    const [workId, title, author] = idx.works[idx.workOf[i]];
    const url = coverUrlFor(idx.coverIds[i], 'M');
    const urlSmall = coverUrlFor(idx.coverIds[i], 'S');
    if (!url || !urlSmall) continue;
    found.push({ coverId: idx.coverIds[i], workId, title, author, url, urlSmall, distance });
  }

  found.sort((a, b) => a.distance - b.distance);

  // One cover per book. Two jackets of the same novel are usually near each
  // other in colour, so without this the row fills up with the same title
  // twice — measured on the blue Voyager *Neuromancer*, which found
  // *Wuthering Heights* and *The Old Man and the Sea* two times each.
  const seenWorks = new Set<string>();
  const best: SimilarCover[] = [];
  for (const match of found) {
    if (seenWorks.has(match.workId)) continue;
    seenWorks.add(match.workId);
    best.push(match);
    if (best.length >= limit) break;
  }
  return best;
}

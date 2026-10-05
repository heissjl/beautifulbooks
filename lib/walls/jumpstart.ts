/**
 * A collection of one's own, started from another (ROADMAP 5.13k; Julian,
 * 2026-09-28: „make it possible to jump-start own collections by choosing one
 * of the curated collections or one of the user generated collections“). Pure.
 */
import type { WallWork } from '@/lib/collections';
import { MAX_TILES, validTile, type PublicWall, type Tile } from './model';

export interface StartedTiles {
  tiles: Tile[];
  /** Covers the site serves itself (SPEC F8.3): they have no Open Library id and cannot go on a reader's collection. */
  skipped: number;
  /** Covers past MAX_TILES, left out. */
  capped: number;
}

/** The covers of a curated collection as tiles, in its order. */
export function tilesFromCurated(works: readonly WallWork[]): StartedTiles {
  const usable: Tile[] = [];
  let skipped = 0;
  for (const w of works) {
    if (w.image || !w.coverId) {
      skipped++;
      continue;
    }
    try {
      usable.push(validTile({ workId: w.coverWork ?? w.id, coverId: String(w.coverId), title: w.title, author: w.author, printings: [] }));
    } catch {
      skipped++;
    }
  }
  const seen = new Set<string>();
  const unique = usable.filter((t) => !seen.has(t.coverId) && !!seen.add(t.coverId));
  return { tiles: unique.slice(0, MAX_TILES), skipped, capped: Math.max(0, unique.length - MAX_TILES) };
}

/** A reader's collection copied: the covers and what the server already looked up about them. */
export function tilesFromWall(wall: PublicWall): StartedTiles {
  return { tiles: wall.tiles.slice(0, MAX_TILES).map((t) => ({ ...t, printings: [...t.printings] })), skipped: 0, capped: Math.max(0, wall.tiles.length - MAX_TILES) };
}

/** What the /create page needs to offer a collection to start from: no more than a card shows. */
/** First covers shown beside a collection to start from: six fill a row on /create (Julian, 2026-10-04: „6 statt 4 cover"). */
export const PREVIEW_COVERS = 6;

export interface StartOption {
  kind: 'curated' | 'reader';
  /** Slug for a curated collection, id for a reader's. */
  key: string;
  title: string;
  by?: string;
  count: number;
  /** How many of them go in: a collection holds MAX_TILES. */
  taken: number;
  /** Up to four Open Library cover ids for the preview. */
  covers: string[];
}

export function curatedOption(c: { slug: string; title: string; works: readonly WallWork[] }): StartOption | null {
  const { tiles, capped } = tilesFromCurated(c.works);
  if (tiles.length === 0) return null;
  return { kind: 'curated', key: c.slug, title: c.title, count: tiles.length + capped, taken: tiles.length, covers: tiles.slice(0, PREVIEW_COVERS).map((t) => t.coverId) };
}

export function readerOption(w: PublicWall): StartOption | null {
  if (w.tiles.length === 0) return null;
  return { kind: 'reader', key: w.id, title: w.title, ...(w.by ? { by: w.by } : {}), count: w.tiles.length, taken: Math.min(w.tiles.length, MAX_TILES), covers: w.tiles.slice(0, PREVIEW_COVERS).map((t) => t.coverId) };
}

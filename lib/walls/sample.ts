/**
 * Six covers to start a wall with (ROADMAP 5.13c; Julian, 2026-09-28: „eine
 * random auswahl von 6 covern … entweder aus der curated liste oder aus den
 * top 10% des versus spiels"). Pure: the caller passes both lists and the
 * random source.
 */
import { validTile, type Tile } from './model';

export const SAMPLE_SIZE = 6;
/** The share of the game's table that counts as its top. */
export const TOP_SHARE = 0.1;

export interface SampleCandidate {
  /** `ol:<n>` or a bare number. */
  coverId: string | number;
  workId: string;
  title: string;
  author?: string;
  /** A site-served image (SPEC F8.3) has no Open Library id and cannot go on a wall. */
  image?: string;
}

export type SampleSource = 'curated' | 'versus';

export interface SampleTile extends Tile {
  from: SampleSource;
}

function toTile(c: SampleCandidate, from: SampleSource): SampleTile | null {
  if (c.image) return null;
  const id = String(c.coverId).replace(/^ol:/, '');
  if (!/^\d+$/.test(id)) return null;
  try {
    return { ...validTile({ workId: c.workId, coverId: id, title: c.title, author: c.author, printings: [] }), from };
  } catch {
    return null;
  }
}

/**
 * Up to `size` covers drawn from both lists together, one per work, each
 * cover once. A work in both lists keeps the curated cover.
 */
export function drawSample(
  curated: readonly SampleCandidate[],
  versusTop: readonly SampleCandidate[],
  random: () => number = Math.random,
  size = SAMPLE_SIZE,
): SampleTile[] {
  const byWork = new Map<string, SampleTile>();
  for (const [list, from] of [[curated, 'curated'], [versusTop, 'versus']] as const) {
    for (const c of list) {
      const tile = toTile(c, from);
      if (tile && !byWork.has(tile.workId)) byWork.set(tile.workId, tile);
    }
  }
  const pool = [...byWork.values()];
  // Fisher–Yates, only as far as needed.
  for (let i = 0; i < Math.min(size, pool.length); i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}

/** The top share of a table that is already sorted best first, only covers that have played. */
export function topShare<T extends { games: number }>(table: readonly T[], share = TOP_SHARE): T[] {
  const played = table.filter((e) => e.games > 0);
  return played.slice(0, Math.max(1, Math.ceil(played.length * share)));
}

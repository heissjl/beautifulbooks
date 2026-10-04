/**
 * The covers Julian chose on the site, as a list (lab/calibre, ROADMAP 5.16).
 *
 * Two sources: a reader's collection, read once from the site
 * (`GET /api/walls/<id>`), or a curated collection, read from
 * `data/collections.json` without any request. The tool only reads; choosing
 * happens on the site as it does today.
 *
 * The image address is rebuilt from the cover id (`ol:<number>` or
 * `gb:<volume>`), never taken from a request or a file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionRecord } from '../../lib/collections';
import { coverUrlFor } from '../../lib/coverurl';
import { cleanIsbn, isbn10to13 } from '../../lib/normalize';
import { userAgent } from '../../lib/seo';
import { isWallId, tileCoverId, type PublicWall } from '../../lib/walls/model';

export interface CoverPick {
  workId: string;
  /** `ol:<number>` or `gb:<volume id>`. */
  coverId: string;
  title: string;
  author?: string;
  /** ISBN-13 of the printings known to have carried this cover. */
  isbns: string[];
}

export interface Source {
  kind: 'wall' | 'curated';
  /** The collection's id or slug. */
  ref: string;
  title: string;
  picks: CoverPick[];
  /** Tiles that cannot be used, with the reason. */
  skipped: string[];
}

const isbn13 = (raw: string | undefined): string | undefined => {
  const clean = cleanIsbn(raw);
  return clean ? isbn10to13(clean) : undefined;
};

export function picksFromWall(wall: PublicWall): Source {
  const picks = wall.tiles.map((t) => ({
    workId: t.workId,
    coverId: tileCoverId(t),
    title: t.title,
    ...(t.author ? { author: t.author } : {}),
    isbns: [...new Set(t.printings.map((p) => isbn13(p.isbn13 ?? p.isbn10)).filter((i): i is string => !!i))],
  }));
  return { kind: 'wall', ref: wall.id, title: wall.title || 'Untitled collection', picks, skipped: [] };
}

export function picksFromCurated(record: CollectionRecord): Source {
  const picks: CoverPick[] = [];
  const skipped: string[] = [];
  for (const w of record.works ?? []) {
    // A cover the site serves itself (`local:`) has no catalogue id to rebuild an address from.
    if (!/^(ol:\d{1,12}|gb:[A-Za-z0-9_-]{1,40})$/.test(w.coverId)) {
      skipped.push(`${w.title}: the cover is one of the site's own images (${w.coverId})`);
      continue;
    }
    const isbn = isbn13(w.coverIsbn);
    picks.push({ workId: w.coverWork ?? w.id, coverId: w.coverId, title: w.title, ...(w.author ? { author: w.author } : {}), isbns: isbn ? [isbn] : [] });
  }
  return { kind: 'curated', ref: record.slug, title: record.title, picks, skipped };
}

/** A collection's address, its id, or a curated slug. */
export function parseSourceArg(arg: string, curatedSlugs: readonly string[]): { kind: 'wall'; id: string } | { kind: 'curated'; slug: string } | null {
  const value = arg.trim();
  const fromUrl = /\/c\/([a-z0-9]{10})(?:[/?#]|$)/.exec(value) ?? /\/collections\/([a-z0-9-]+)(?:[/?#]|$)/.exec(value);
  const name = fromUrl ? fromUrl[1] : value;
  if (curatedSlugs.includes(name)) return { kind: 'curated', slug: name };
  if (isWallId(name)) return { kind: 'wall', id: name };
  return null;
}

export function curatedRecords(root: string): CollectionRecord[] {
  return (JSON.parse(readFileSync(join(root, 'data/collections.json'), 'utf8')) as { collections: CollectionRecord[] }).collections;
}

/** One request to the site for a reader's collection; none for a curated one. */
export async function loadSource(arg: string, root: string, base: string): Promise<Source> {
  const records = curatedRecords(root);
  const parsed = parseSourceArg(arg, records.map((r) => r.slug));
  if (!parsed) throw new Error(`"${arg}" is neither a collection's address or id (ten characters) nor a curated slug.`);
  if (parsed.kind === 'curated') return picksFromCurated(records.find((r) => r.slug === parsed.slug) as CollectionRecord);
  const res = await fetch(`${base}/api/walls/${parsed.id}`, { headers: { 'user-agent': userAgent(base) }, signal: AbortSignal.timeout(30_000) });
  // A site that did not answer is not "no such collection" (SPEC N12).
  if (res.status === 404) throw new Error(`The site knows no collection ${parsed.id}.`);
  if (!res.ok) throw new Error(`The site answered ${res.status} for the collection — try again in a moment.`);
  return picksFromWall(((await res.json()) as { wall: PublicWall }).wall);
}

/**
 * Where the largest image of a cover is. Open Library keeps the scan as it
 * was uploaded under the id without a size letter; `-L` is the fallback.
 * `default=false` makes a missing cover a 404 instead of a blank picture.
 */
export function imageUrls(coverId: string): string[] {
  if (coverId.startsWith('ol:')) {
    const id = coverId.slice(3);
    if (!/^\d{1,12}$/.test(id)) return [];
    return [`https://covers.openlibrary.org/b/id/${id}.jpg?default=false`, `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`];
  }
  // The same shape a tile may carry (lib/walls/model.ts); anything else gets no address at all.
  if (!/^gb:[A-Za-z0-9_-]{1,40}$/.test(coverId)) return [];
  const url = coverUrlFor(coverId, 'L');
  return url ? [url] : [];
}

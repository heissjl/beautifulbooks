/**
 * One work's wall of covers from its loaded pages: retail images mixed in,
 * duplicates folded, grouped by language (SPEC F2.3). Shared by the book page
 * and the wall picker on /walls (ROADMAP 5.13c), so both show the same wall.
 */
import type { CoverTab } from '@/components/CoverGallery';
import type { ImageSignature } from '@/lib/imagesig';
import type { Cover, EditionView } from '@/lib/model';
import { orderGroups, type MergedWork, type Truncation } from '@/lib/pages';
import { coversNewestFirst, foldDuplicateCovers, groupCoversByLanguage, withRetailCovers } from '@/lib/works';

/**
 * Folds and groups the covers of a wall.
 *
 * Folding cannot happen on the server: it only ever sees one page of
 * editions, and duplicates sit across pages (SPEC §9.3 step 11). `extra`
 * carries the retail covers fetched for a selected ISBN (step 13a); they
 * join before folding, so a retail image identical to the catalogue scan
 * folds into it instead of showing up twice.
 */
export function buildWall(
  merged: MergedWork<EditionView>,
  extra: readonly Cover[],
  extraSignatures: ReadonlyMap<string, ImageSignature>,
  preferred: string | undefined,
  /** The cover the address names; it leads its fold group (see foldDuplicateCovers). */
  pinnedId: string | null = null,
) {
  // Each id once: the shop's image is often a Google volume page 0 already has (6.37).
  const all = withRetailCovers(merged.covers, extra);
  const signatures = new Map(merged.signatures);
  for (const [id, sig] of extraSignatures) signatures.set(id, sig);

  /*
    Which editions carried each scan *before* folding (ROADMAP 6.14, and the
    ordering in `orderEditionsForMarket`). Folding merges the members' edition
    ids into the representative, so afterwards a tile lists printings that
    never had that picture; this map remembers who did.
  */
  const editionsByScan = new Map<string, readonly string[]>(all.map(c => [c.id, c.editionIds]));
  const covers = foldDuplicateCovers(all, signatures, merged.editions, {}, pinnedId);
  const coversById = new Map(covers.map(c => [c.id, c]));
  const ordered = orderGroups(groupCoversByLanguage(covers, merged.editions, preferred, signatures, merged.coverPage), preferred);
  const groups: CoverTab[] = ordered.map(g => ({
    language: g.language,
    covers: g.coverIds.map(id => coversById.get(id)).filter((c): c is Cover => !!c),
  }));
  // `signatures` goes out too: the verdict must know which pictures the fold
  // could compare at all (ROADMAP 6.32).
  // The whole wall in one list, for the "All languages" pill (ROADMAP 6.8).
  const wholeWall = coversNewestFirst(covers, merged.editions, signatures, merged.coverPage);
  return { covers, coversById, groups, all: wholeWall, editionsByScan, signatures };
}

/** "Scribner 1996" style caption from the editions carrying a cover. */
export function captionFor(cover: Cover, editionsById: ReadonlyMap<string, EditionView>): string {
  const eds = cover.editionIds.map(id => editionsById.get(id)).filter((e): e is EditionView => !!e);
  const first = eds[0];
  if (!first) return '';
  const parts = [first.publisher, first.year ? String(first.year) : undefined].filter(Boolean);
  const more = eds.length > 1 ? ` +${eds.length - 1}` : '';
  return parts.join(' ') + more;
}

/**
 * What the wall is showing and how much of the catalogue it has seen
 * (SPEC §9.3 step 11, F). Open Library knows far more editions than carry a
 * cover, so the honest statement is "n covers out of m edition records
 * checked", never "every cover".
 */
export function progressLabel(covers: number, merged: Pick<MergedWork, 'checked' | 'total' | 'done' | 'truncated'>): string {
  const n = `${covers} cover${covers === 1 ? '' : 's'}`;
  const checked = merged.checked.toLocaleString('en');
  const total = merged.total.toLocaleString('en');
  if (!merged.done) return `${n} from ${checked} of ${total} editions checked`;
  const reason: Record<Exclude<Truncation, null>, string> = {
    cap: `${n} from the first ${checked} of ${total} editions`,
    error: `${n} from ${checked} of ${total} editions; the source stopped answering`,
  };
  if (merged.truncated) return reason[merged.truncated];
  return `${n} from ${total} edition${merged.total === 1 ? '' : 's'}`;
}

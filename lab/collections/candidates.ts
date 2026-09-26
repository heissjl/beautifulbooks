/**
 * Pure rules for turning a list of per-work cover candidates (e.g.
 * `lists/sf-relaunch-russian.json`, from `lab/international-covers/`) into a
 * draft collection record. No file access here; `from-candidates.ts` reads
 * and writes.
 */
import type { CollectionPick, CollectionRecord } from '../../lib/collections';

export interface CandidateRow {
  order: number;
  id: string;
  title: string;
  author: string;
  coverId: string | null;
  edition: string | null;
  /** The chosen edition's language code, when the list mixes languages. */
  language?: string | null;
  /** The chosen edition's ISBN, kept as `coverIsbn` for the ISFDB cover-artist lookup (6.52). */
  isbn?: string | null;
  status: 'found' | 'none' | 'failed';
}

export interface DraftSpec {
  slug: string;
  title: string;
  /**
   * Prefix of each pick's `from`; the row's language (if any) and edition id
   * follow, e.g. `openlibrary` → `openlibrary:fre:OL123M`.
   */
  from: string;
  addedAt: string;
}

/**
 * A `series` draft with the works that have a cover, in list order.
 *
 * `publishers` is empty on purpose: the covers are other publishers'
 * translations, not the series printing, so no spelling bounds them — and
 * an empty list is what `newCollection` gives a fresh series too.
 * `coverSource: 'catalogue'` makes the wall say the covers were not all
 * picked by eye. An existing record's intro and `coverCredits` switch are
 * kept, and so is a pick's ISFDB credit while its image is the same;
 * `published` is always false (only Julian publishes).
 */
export function draftFromCandidates(rows: CandidateRow[], spec: DraftSpec, existing?: CollectionRecord): CollectionRecord {
  const seen = new Set<string>();
  const works: CollectionPick[] = [];
  for (const r of [...rows].sort((a, b) => a.order - b.order)) {
    if (r.status !== 'found' || !r.coverId || seen.has(r.id)) continue;
    seen.add(r.id);
    // A cover credit found earlier stays with the same image; a new image starts without one.
    const before = existing?.works.find(w => w.id === r.id && w.coverId === r.coverId);
    const credit = before ? pickCredit(before) : {};
    works.push({
      id: r.id,
      title: r.title,
      author: r.author,
      coverId: r.coverId,
      addedAt: spec.addedAt,
      from: [spec.from, r.language, r.edition?.replace('/books/', '')].filter(Boolean).join(':'),
      ...(r.isbn ? { coverIsbn: r.isbn } : {}),
      ...credit,
    });
  }
  return {
    slug: spec.slug,
    title: spec.title,
    kind: 'series',
    intro: existing?.intro ?? '',
    published: false,
    ...(existing?.coverCredits ? { coverCredits: existing.coverCredits } : {}),
    coverSource: 'catalogue',
    publishers: [],
    works,
  };
}

/** The collections with `record` replacing the one of the same slug, or appended. Nothing else changes. */
export function upsertCollection(collections: CollectionRecord[], record: CollectionRecord): CollectionRecord[] {
  const at = collections.findIndex(c => c.slug === record.slug);
  if (at < 0) return [...collections, record];
  return collections.map((c, i) => (i === at ? record : c));
}

function pickCredit(p: CollectionPick): Partial<CollectionPick> {
  return {
    ...(p.coverArtists ? { coverArtists: p.coverArtists } : {}),
    ...(p.isfdbRecord ? { isfdbRecord: p.isfdbRecord } : {}),
    ...(p.creditWithheld ? { creditWithheld: p.creditWithheld } : {}),
  };
}

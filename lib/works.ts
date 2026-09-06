/**
 * Work identity, edition dedupe, relevance ranking and language grouping.
 * Pure functions, no I/O (SPEC.md §2, §3 F1.2–F1.4, F2.3–F2.4, F4).
 */
import type { Cover, Edition, LanguageGroup, SourceEdition, Work, WorkSummary } from './model';
import type { EditionCandidate } from './sources/googlebooks-parse';
import { looksLikeSecondaryLiterature, normalizeTitle, titleAuthorKey } from './normalize';
import { BLANK_CONTRAST, hamming, type ImageSignature } from './imagehash';

export const MOSAIC_COVERS = 4;

function identityKey(w: { title: string; authors: string[] }): string {
  return titleAuthorKey(w.title, w.authors[0]);
}

function uniq<T>(xs: readonly T[]): T[] {
  return Array.from(new Set(xs));
}

/**
 * Identity rule 2 (SPEC §2.1): works with the same normalized title and
 * primary author are one work, even if Open Library has several ids for it.
 * The id of the member with the most editions survives; edition counts add
 * up, covers and languages are unioned.
 */
export function mergeWorks(works: readonly WorkSummary[]): WorkSummary[] {
  const byKey = new Map<string, WorkSummary>();
  for (const w of works) {
    const key = identityKey(w);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...w, coverUrls: [...w.coverUrls], languages: [...w.languages] });
      continue;
    }
    const takeIdFrom = (w.editionCount ?? 0) > (existing.editionCount ?? 0) ? w : existing;
    byKey.set(key, {
      id: takeIdFrom.id,
      title: takeIdFrom.title,
      authors: takeIdFrom.authors,
      firstPublishYear: minDefined(existing.firstPublishYear, w.firstPublishYear),
      editionCount: (existing.editionCount ?? 0) + (w.editionCount ?? 0) || undefined,
      coverUrls: uniq([...existing.coverUrls, ...w.coverUrls]),
      languages: uniq([...existing.languages, ...w.languages]),
    });
  }
  return Array.from(byKey.values());
}

function minDefined(a?: number, b?: number): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

/**
 * Attaches Google Books candidates to existing works by title + primary
 * author, contributing covers and languages. Candidates that match no work
 * are discarded: Google Books never creates works (decision E5).
 */
export function attachCandidates(
  works: readonly WorkSummary[],
  candidates: readonly EditionCandidate[],
): WorkSummary[] {
  const byKey = new Map<string, WorkSummary>();
  const out = works.map(w => {
    const copy = { ...w, coverUrls: [...w.coverUrls], languages: [...w.languages] };
    byKey.set(identityKey(copy), copy);
    return copy;
  });
  for (const c of candidates) {
    const work = byKey.get(identityKey(c));
    if (!work) continue;
    if (!work.coverUrls.includes(c.coverUrl)) work.coverUrls.push(c.coverUrl);
    if (c.language && !work.languages.includes(c.language)) work.languages.push(c.language);
  }
  return out;
}

/** Assigns candidates to a known work (detail page). Non-matching ones are dropped. */
export function candidatesToSourceEditions(
  work: { id: string; title: string; authors: string[] },
  candidates: readonly EditionCandidate[],
): SourceEdition[] {
  const key = identityKey(work);
  return candidates.filter(c => identityKey(c) === key).map(c => toSourceEdition(work.id, c));
}

/** Candidates found by ISBN lookup already belong to the work; no title match needed. */
export function isbnCandidatesToSourceEditions(
  workId: string,
  candidates: readonly EditionCandidate[],
): SourceEdition[] {
  return candidates.map(c => toSourceEdition(workId, c));
}

function toSourceEdition(workId: string, c: EditionCandidate): SourceEdition {
  const { authors, coverUrl, ...rest } = c;
  void authors;
  void coverUrl;
  return { ...rest, workId };
}

/** Merge key per SPEC §2.2: ISBN-13 when present, otherwise the source edition id. */
export function editionKey(e: Pick<Edition, 'id' | 'isbn13'>): string {
  return e.isbn13 ? `isbn:${e.isbn13}` : `id:${e.id}`;
}

function mergeEditionMeta(base: Edition, extra: Edition): Edition {
  return {
    ...base,
    language: base.language ?? extra.language,
    publisher: base.publisher ?? extra.publisher,
    publishedDate: base.publishedDate ?? extra.publishedDate,
    year: base.year ?? extra.year,
    isbn10: base.isbn10 ?? extra.isbn10,
    pageCount: base.pageCount ?? extra.pageCount,
    format: base.format ?? extra.format,
    previewUrl: base.previewUrl ?? extra.previewUrl,
    description: (extra.description?.length ?? 0) > (base.description?.length ?? 0) ? extra.description : base.description,
  };
}

/**
 * SPEC §2.1: translators are not authors. Open Library lists them among a
 * work's authors without a role, but they only appear on editions in a
 * language other than the work's main language. An author (never the first)
 * whose key occurs on no edition explicitly in the main language is dropped.
 * Editions without language data give no evidence either way (the Spanish
 * Mumbo Jumbo lacks a language field at Open Library). Requires author keys
 * on the work and on the editions; otherwise the work is returned unchanged.
 */
export function withoutTranslators(work: Work, editions: readonly SourceEdition[]): Work {
  if (!work.authorKeys || work.authorKeys.length !== work.authors.length || work.authors.length < 2) return work;
  const withKeys = editions.filter(e => e.authorKeys && e.authorKeys.length > 0);
  if (withKeys.length === 0) return work;

  const langCounts = new Map<string, number>();
  for (const e of withKeys) if (e.language) langCounts.set(e.language, (langCounts.get(e.language) ?? 0) + 1);
  let mainLanguage: string | undefined;
  let best = 0;
  for (const [lang, n] of langCounts) if (n > best) { mainLanguage = lang; best = n; }
  if (!mainLanguage) return work;

  const onMainLanguage = new Set<string>();
  const onAnyEdition = new Set<string>();
  for (const e of withKeys) {
    for (const k of e.authorKeys!) {
      onAnyEdition.add(k);
      if (e.language === mainLanguage) onMainLanguage.add(k);
    }
  }
  const keep = work.authors.map((_, i) => {
    if (i === 0) return true;
    const key = work.authorKeys![i];
    // Unknown to the editions: no evidence either way, keep.
    if (!onAnyEdition.has(key)) return true;
    return onMainLanguage.has(key);
  });
  if (keep.every(Boolean)) return work;
  return {
    ...work,
    authors: work.authors.filter((_, i) => keep[i]),
    authorKeys: work.authorKeys.filter((_, i) => keep[i]),
  };
}

export interface EditionsAndCovers {
  editions: Edition[];
  covers: Cover[];
}

/**
 * SPEC §2.2/§2.3 (E8): editions with the same ISBN become one edition with
 * merged metadata; every cover of every source survives and points at the
 * surviving edition. Cover identity is the image id, never the ISBN.
 */
export function assembleEditions(sources: readonly SourceEdition[]): EditionsAndCovers {
  const editionsByKey = new Map<string, Edition>();
  const coversById = new Map<string, Cover>();
  for (const src of sources) {
    const { covers, authorKeys, ...edition } = src;
    void authorKeys;
    const key = editionKey(edition);
    const existing = editionsByKey.get(key);
    const survivor = existing ? mergeEditionMeta(existing, edition) : edition;
    editionsByKey.set(key, survivor);
    for (const c of covers) {
      const cover = coversById.get(c.id);
      if (cover) {
        if (!cover.editionIds.includes(survivor.id)) cover.editionIds.push(survivor.id);
      } else {
        coversById.set(c.id, { id: c.id, url: c.url, urlSmall: c.urlSmall, source: src.source, editionIds: [survivor.id] });
      }
    }
  }
  return { editions: Array.from(editionsByKey.values()), covers: Array.from(coversById.values()) };
}

export const SECONDARY_PENALTY = 60;

/**
 * Relevance per SPEC §3 F1.4. Exact title match beats prefix beats
 * substring; edition count adds a logarithmic popularity bonus; titles that
 * are about a work rather than the work itself are penalized.
 */
export function relevance(work: WorkSummary, query: string): number {
  const q = normalizeTitle(query);
  const t = normalizeTitle(work.title);
  let score = 0;
  if (q && t === q) score += 100;
  else if (q && t.startsWith(q)) score += 50;
  else if (q && t.includes(q)) score += 25;
  score += Math.min(40, 6 * Math.log2((work.editionCount ?? 0) + 1));
  if (looksLikeSecondaryLiterature(work.title)) score -= SECONDARY_PENALTY;
  return score;
}

export function rankWorks(works: readonly WorkSummary[], query: string): WorkSummary[] {
  return works
    .map((w, i) => ({ w, i, s: relevance(w, query) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.w);
}

/**
 * SPEC §3 F1.2: with a language set, a work is shown if it has at least one
 * edition in that language. Works without language data are kept because
 * missing metadata is not evidence of absence.
 */
export function filterWorksByLanguage(works: readonly WorkSummary[], language: string | undefined): WorkSummary[] {
  if (!language || language === 'all') return [...works];
  return works.filter(w => w.languages.length === 0 || w.languages.includes(language));
}

/** Up to MOSAIC_COVERS distinct cover URLs (SPEC §3 F4). */
export function mosaicCovers(work: WorkSummary): string[] {
  return uniq(work.coverUrls).slice(0, MOSAIC_COVERS);
}

/** Language of a cover: the most common language among the editions carrying it. */
export function coverLanguage(cover: Cover, editionsById: ReadonlyMap<string, Edition>): string | undefined {
  const counts = new Map<string, number>();
  for (const id of cover.editionIds) {
    const lang = editionsById.get(id)?.language;
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [lang, n] of counts) if (n > bestN) { best = lang; bestN = n; }
  return best;
}

function coverYear(cover: Cover, editionsById: ReadonlyMap<string, Edition>): number {
  return Math.max(-1, ...cover.editionIds.map(id => editionsById.get(id)?.year ?? -1));
}

/**
 * SPEC §3 F2.3–F2.4: covers grouped by language, preferred language first,
 * then by size descending; unknown language last. Within a group newest first.
 */
export function groupCoversByLanguage(
  covers: readonly Cover[],
  editions: readonly Edition[],
  preferred?: string,
): LanguageGroup[] {
  const editionsById = new Map(editions.map(e => [e.id, e]));
  const groups = new Map<string | undefined, Cover[]>();
  for (const c of covers) {
    const lang = coverLanguage(c, editionsById);
    const list = groups.get(lang) ?? [];
    list.push(c);
    groups.set(lang, list);
  }
  const newestFirst = (a: Cover, b: Cover) => coverYear(b, editionsById) - coverYear(a, editionsById);
  return Array.from(groups.entries())
    .map(([language, cs]) => ({ language, covers: cs.sort(newestFirst) }))
    .sort((a, b) => {
      if (a.language === undefined) return 1;
      if (b.language === undefined) return -1;
      if (preferred && preferred !== 'all') {
        if (a.language === preferred) return -1;
        if (b.language === preferred) return 1;
      }
      return b.covers.length - a.covers.length || a.language.localeCompare(b.language);
    })
    .map(g => ({ language: g.language, coverIds: g.covers.map(c => c.id) }));
}

export const SAME_COVER_MAX_DISTANCE = 8;

/**
 * SPEC §2.3 phase 2 (§8.5): covers whose images are the same design are
 * folded into one. `signatures` maps cover id to a perceptual hash; covers
 * without a signature (not fetched within the time budget) stay as they
 * are and fold on a later request once cached. Blank scans (no contrast)
 * are dropped unless they are an edition's only cover.
 *
 * Representative of a group: an Open Library cover before a Google one
 * (Google images are often the current printing, OL scans the actual
 * edition), then the first seen. Edition ids are unioned; folded ids are
 * kept in `similarIds` so the UI can say "+2 similar".
 */
export function foldDuplicateCovers(
  covers: readonly Cover[],
  signatures: ReadonlyMap<string, ImageSignature>,
  maxDistance = SAME_COVER_MAX_DISTANCE,
): Cover[] {
  // Drop blank scans that are not an edition's only cover.
  const coversPerEdition = new Map<string, number>();
  for (const c of covers) for (const id of c.editionIds) coversPerEdition.set(id, (coversPerEdition.get(id) ?? 0) + 1);
  const kept = covers.filter(c => {
    const sig = signatures.get(c.id);
    if (!sig || sig.contrast >= BLANK_CONTRAST) return true;
    return c.editionIds.some(id => (coversPerEdition.get(id) ?? 0) <= 1);
  });

  // Greedy grouping: each cover joins the first group whose representative is within range.
  const groups: Array<{ rep: Cover; members: Cover[] }> = [];
  for (const c of kept) {
    const sig = signatures.get(c.id);
    let target: { rep: Cover; members: Cover[] } | undefined;
    if (sig) {
      target = groups.find(g => {
        const rs = signatures.get(g.rep.id);
        return !!rs && hamming(rs.hash, sig.hash) <= maxDistance;
      });
    }
    if (target) target.members.push(c);
    else groups.push({ rep: c, members: [c] });
  }

  return groups.map(g => {
    if (g.members.length === 1) return g.members[0];
    const rep = g.members.find(m => m.source === 'openlibrary') ?? g.members[0];
    const editionIds = uniq(g.members.flatMap(m => m.editionIds));
    const similarIds = g.members.filter(m => m.id !== rep.id).map(m => m.id);
    return { ...rep, editionIds, similarIds };
  });
}

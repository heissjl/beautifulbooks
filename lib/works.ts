/**
 * Work identity, edition dedupe, relevance ranking and language grouping.
 * Pure functions, no I/O (SPEC.md §2, §3 F1.2–F1.4, F2.3–F2.4, F4).
 */
import type { Edition, LanguageGroup, WorkSummary } from './model';
import type { EditionCandidate } from './sources/googlebooks-parse';
import { looksLikeSecondaryLiterature, normalizeTitle, titleAuthorKey } from './normalize';

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
export function candidatesToEditions(
  work: { id: string; title: string; authors: string[] },
  candidates: readonly EditionCandidate[],
): Edition[] {
  const key = identityKey(work);
  return candidates
    .filter(c => identityKey(c) === key)
    .map(({ authors: _authors, ...rest }) => ({ ...rest, workId: work.id }));
}

/** Dedupe key per SPEC §2.2: ISBN-13, then cover id/URL, then title+publisher+year. */
export function editionKey(e: Edition): string {
  if (e.isbn13) return `isbn:${e.isbn13}`;
  const olCover = e.coverUrl.match(/\/b\/id\/(\d+)-/);
  if (olCover) return `cover:${olCover[1]}`;
  if (e.source === 'googlebooks') return `cover:${e.coverUrl}`;
  return `tpy:${normalizeTitle(e.title)}::${(e.publisher ?? '').toLowerCase().slice(0, 20)}::${e.year ?? ''}`;
}

function completeness(e: Edition): number {
  return (e.description ? 4 : 0) + (e.isbn13 ? 2 : 0) + (e.pageCount ? 1 : 0) + (e.publisher ? 1 : 0);
}

export function dedupeEditions(editions: readonly Edition[]): Edition[] {
  const seen = new Map<string, Edition>();
  for (const e of editions) {
    const key = editionKey(e);
    const existing = seen.get(key);
    if (!existing || completeness(e) > completeness(existing)) seen.set(key, e);
  }
  return Array.from(seen.values());
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

/**
 * SPEC §3 F2.3–F2.4: group by language, preferred language first, then by
 * size descending; unknown language last. Within a group newest first.
 */
export function groupEditionsByLanguage(editions: readonly Edition[], preferred?: string): LanguageGroup[] {
  const groups = new Map<string | undefined, Edition[]>();
  for (const e of editions) {
    const list = groups.get(e.language) ?? [];
    list.push(e);
    groups.set(e.language, list);
  }
  const byYearDesc = (a: Edition, b: Edition) => (b.year ?? -1) - (a.year ?? -1);
  return Array.from(groups.entries())
    .map(([language, eds]) => ({ language, editions: eds.sort(byYearDesc) }))
    .sort((a, b) => {
      if (a.language === undefined) return 1;
      if (b.language === undefined) return -1;
      if (preferred && preferred !== 'all') {
        if (a.language === preferred) return -1;
        if (b.language === preferred) return 1;
      }
      return b.editions.length - a.editions.length || a.language.localeCompare(b.language);
    });
}

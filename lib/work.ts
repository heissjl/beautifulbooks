/**
 * Detail-page orchestration (SPEC §3 F2, E8, §9.3 step 11). Server-side only.
 *
 * Open Library serves a work's editions 100 records at a time, newest record
 * first, and only a quarter of them carry a cover. Loading one page therefore
 * shows the most recently catalogued printings and nothing else: for The
 * Great Gatsby that was 43 of 379 covers. So the unit here is *one page*;
 * the client keeps asking for the next one and merges them (lib/pages.ts).
 *
 * Page 0 additionally carries the work itself and the Google Books
 * candidates for its title; later pages are Open Library only, so the Google
 * quota does not grow with the number of pages. What a shop currently shows
 * for a given ISBN is asked separately, when a cover is selected (lib/isbn.ts,
 * SPEC §9.3 step 13a).
 */
import type { Cover, Edition, LanguageGroup, Work } from './model';
import type { ImageSignature } from './imagesig';
import type { PageInfo } from './pages';
import { hashCovers } from './coverhash';
import { searchEditionCandidates } from './sources/googlebooks';
import { OL_EDITIONS_PAGE, getEditionsPage, getWork } from './sources/openlibrary';
import { parseEditions } from './sources/openlibrary-parse';
import {
  assembleEditions, candidatesToSourceEditions, foldDuplicateCovers, groupCoversByLanguage,
  withoutTranslators,
} from './works';

/** Never scan more edition records than this; beyond it works are anthologies and bibles. */
export const MAX_EDITIONS_SCANNED = 1500;

/** Time budget for hashing one page's covers. */
export const DEFAULT_HASH_DEADLINE_MS = 4000;

export interface WorkDetail {
  work: Work;
  editions: Edition[];
  covers: Cover[];
  groups: LanguageGroup[];
}

/** One page of a work's editions and their covers. */
export interface WorkPage {
  /** Always loaded: parsing editions needs the work's author names (F3.1). */
  work: Work;
  editions: Edition[];
  covers: Cover[];
  /** Perceptual signature per cover id, when `signatures` was requested. */
  signatures?: Record<string, ImageSignature>;
  page: PageInfo;
}

export interface WorkPageOptions {
  /** Record offset, a multiple of 100. Default 0. */
  offset?: number;
  /** Hash this page's covers so the client can fold duplicates. */
  signatures?: boolean;
  hashDeadlineMs?: number;
  /**
   * Ask Google Books for this title on page 0. Default true.
   *
   * Off for a search card's mosaic: a result page of twenty cards would cost
   * twenty Google requests, and measured on five works Google contributed
   * nothing the mosaic needs — Open Library alone filled all four tiles every
   * time (2026-09-07, SPEC §8.7). The quota is the binding constraint before
   * launch, so a caller that does not need the retail image does not spend it.
   */
  googleBooks?: boolean;
}

export interface WorkDetailOptions {
  /** Language to list first (the search filter the user came from). */
  preferredLanguage?: string;
  /** Fold covers with the same image (perceptual hash). Default true. */
  dedupeCovers?: boolean;
  /** Time budget for hashing cover images, per page. */
  hashDeadlineMs?: number;
  /** Stop after this many edition records. Default MAX_EDITIONS_SCANNED. */
  maxEntries?: number;
  /**
   * Ask Google Books on page 0. Default true, as for a single page — but a
   * caller that only counts years has no use for it and must say so, or it
   * spends a request per cold render (E10, ROADMAP 5.4a).
   */
  googleBooks?: boolean;
}

const WORK_ID = /^OL\d+W$/;

export function isWorkId(id: string | undefined): id is string {
  return !!id && WORK_ID.test(id);
}

/** Offset of the page after this one, or undefined when nothing follows. */
function nextOffsetFor(offset: number, entries: number, total: number, cap: number): number | undefined {
  const next = offset + OL_EDITIONS_PAGE;
  if (entries < OL_EDITIONS_PAGE) return undefined;
  if (next >= total || next >= cap) return undefined;
  return next;
}

/**
 * One page of editions with their covers.
 *
 * Returns null for unknown or malformed ids. Throws when Open Library is
 * unreachable so the caller can tell "not found" from "temporarily
 * unavailable".
 */
export async function getWorkPage(workId: string, options: WorkPageOptions = {}): Promise<WorkPage | null> {
  if (!isWorkId(workId)) return null;
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const work = await getWork(workId);
  if (!work) return null;

  // Past the scan cap the answer is an empty page that says where it is,
  // not the last page under the cap wearing the wrong offset (ROADMAP 1.7).
  // One record is fetched so the source's total can still be reported.
  if (offset >= MAX_EDITIONS_SCANNED) {
    const probe = await getEditionsPage(workId, offset, 1);
    return { work, editions: [], covers: [], page: { offset, limit: OL_EDITIONS_PAGE, total: probe.size } };
  }

  const first = offset === 0;
  // Google Books runs on page 0 only, and only when the caller wants it: its
  // quota must not grow with the page count nor with the size of a result list.
  const askGoogle = first && (options.googleBooks ?? true);
  const [page, gbCandidates] = await Promise.all([
    getEditionsPage(workId, offset, OL_EDITIONS_PAGE),
    askGoogle ? searchEditionCandidates(work.title, work.authors[0]) : Promise.resolve([]),
  ]);
  const olEditions = parseEditions(page.entries, work);
  const cleanWork = first ? withoutTranslators(work, olEditions) : work;

  const { editions, covers } = assembleEditions([
    ...olEditions,
    ...candidatesToSourceEditions(work, gbCandidates),
  ]);

  const result: WorkPage = {
    work: cleanWork,
    editions,
    covers,
    page: {
      offset,
      limit: OL_EDITIONS_PAGE,
      total: page.size,
      nextOffset: nextOffsetFor(offset, page.entries.length, page.size, MAX_EDITIONS_SCANNED),
    },
  };

  if (options.signatures) {
    const signatures = await hashCovers(covers, { deadlineMs: options.hashDeadlineMs ?? DEFAULT_HASH_DEADLINE_MS });
    result.signatures = Object.fromEntries(signatures);
  }
  return result;
}

/**
 * The whole work: every page up to the cap, folded and grouped. Used by the
 * tests and available for a server render; the detail page loads pages
 * itself so it can show the first covers within a second (SPEC §9.3).
 */
/** A later page is worth a second attempt before the walk gives up. */
const PAGE_RETRY_DELAY_MS = 2_000;

/**
 * One retry for a later edition page, the server-side twin of the retry in
 * `useWorkPages` (ROADMAP 1.10).
 *
 * Measured in production 2026-09-09: *Brave New World* rendered its decade
 * page from **41 edition records instead of 130**, because the walk gave up
 * on the first page that did not answer — and `revalidate = 86400` then froze
 * that third of a book for a day. Open Library answers a slow editions
 * request past the 12 s timeout often enough from Frankfurt that one attempt
 * is not a measurement of anything.
 */
async function fetchPageWithRetry(
  workId: string,
  offset: number,
  options: WorkDetailOptions,
): Promise<WorkPage | null> {
  const ask = () => getWorkPage(workId, {
    offset, hashDeadlineMs: options.hashDeadlineMs, googleBooks: false,
  });
  try {
    return await ask();
  } catch {
    await new Promise(r => setTimeout(r, PAGE_RETRY_DELAY_MS));
    return ask();
  }
}

export async function getWorkDetail(workId: string, options: WorkDetailOptions = {}): Promise<WorkDetail | null> {
  const cap = options.maxEntries ?? MAX_EDITIONS_SCANNED;
  const first = await getWorkPage(workId, {
    offset: 0, hashDeadlineMs: options.hashDeadlineMs, googleBooks: options.googleBooks,
  });
  if (!first) return null;

  const pages: WorkPage[] = [first];
  let next = first.page.nextOffset;
  while (next !== undefined && next < cap) {
    /*
      A later page that fails ends the walk with what has arrived, instead of
      throwing the whole work away. Measured 2026-09-09: the decade page
      answered 404 in production for a work whose wall renders fine, because
      one page in the middle timed out — the same lesson as the retry in 1.10,
      one level up.
    */
    let page: WorkPage | null;
    try {
      page = await fetchPageWithRetry(workId, next, options);
    } catch {
      break;
    }
    if (!page) break;
    pages.push(page);
    next = page.page.nextOffset;
  }

  const editionsById = new Map<string, Edition>();
  const coversById = new Map<string, Cover>();
  for (const page of pages) {
    for (const edition of page.editions) if (!editionsById.has(edition.id)) editionsById.set(edition.id, edition);
    for (const cover of page.covers) {
      const existing = coversById.get(cover.id);
      if (!existing) coversById.set(cover.id, { ...cover, editionIds: [...cover.editionIds] });
      else for (const id of cover.editionIds) if (!existing.editionIds.includes(id)) existing.editionIds.push(id);
    }
  }
  const editions = Array.from(editionsById.values());
  const assembled = Array.from(coversById.values());

  // Same design, several scans: fold by perceptual hash within a time budget.
  const covers = options.dedupeCovers === false
    ? assembled
    : foldDuplicateCovers(assembled, await hashCovers(assembled, { deadlineMs: options.hashDeadlineMs }), editions);

  const groups = groupCoversByLanguage(covers, editions, options.preferredLanguage);
  return { work: first.work, editions, covers, groups };
}

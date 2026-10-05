/**
 * Covers taken off the site on request (ROADMAP 2.18k, decision J6).
 *
 * The site shows images that belong to publishers, designers and
 * photographers. When one of them asks for a cover to go, it has to go within
 * one deploy, not after a day of work — so the list lives in the repository
 * (`data/hidden-covers.json`) and every path a cover takes to a reader asks
 * here: the image route (`/img`, which refuses it), the work page's covers
 * (`assembleEditions`), a search card's mosaic, a shop's ISBN image, similar
 * covers, collections, the home wall and ring, the cover game and the share
 * cards. `lib/__tests__/hiddencovers.test.ts` checks each of them.
 *
 * An entry is the cover id as the site writes it — `ol:<number>`,
 * `gb:<volume>` or `local:<file>` — with the day it was hidden and a note on
 * who asked. Nothing is deleted: the image stays at Open Library or Google,
 * and taking an entry out brings the cover back with the next deploy.
 *
 * Pure and small, so client components may import it.
 */
import hiddenFile from '@/data/hidden-covers.json';
import { coverRefFromUrl } from './coverurl';

export interface HiddenCover {
  id: string;
  /** The day it was taken off, YYYY-MM-DD. */
  hidden: string;
  /** Who asked, in a few words — never a mail address or a name the person did not want kept. */
  note?: string;
}

const COVER_ID = /^(ol|gb|local):[\w.-]{1,128}$/;

export function parseHiddenCovers(raw: unknown): Set<string> {
  const list = (raw as { covers?: unknown })?.covers;
  const out = new Set<string>();
  if (!Array.isArray(list)) return out;
  for (const entry of list) {
    const id = (entry as Partial<HiddenCover> | null)?.id;
    if (typeof id === 'string' && COVER_ID.test(id)) out.add(id);
  }
  return out;
}

const HIDDEN = parseHiddenCovers(hiddenFile);

/** Tests replace the list; the site never does. */
let hidden: ReadonlySet<string> = HIDDEN;
export function setHiddenCoversForTest(ids: readonly string[] | null): void {
  hidden = ids ? new Set(ids) : HIDDEN;
}

export function isHiddenCover(coverId: string | null | undefined): boolean {
  return !!coverId && hidden.has(coverId);
}

/**
 * The same question for an image address. Open Library and Google addresses
 * and our own `/img/<size>/<segment>` are read back to an id. A collection's
 * own file (`local:`) has no id in its address; `parseCollections` drops it
 * by the pick's id instead.
 */
export function isHiddenCoverUrl(url: string | null | undefined): boolean {
  if (!url || hidden.size === 0) return false;
  const ref = coverRefFromUrl(url);
  if (ref) return hidden.has(ref.coverId);
  const proxied = url.match(/^\/img\/[SML]\/(ol|gb)-([\w.-]{1,128})(?:\?|$)/);
  return !!proxied && hidden.has(`${proxied[1]}:${proxied[2]}`);
}

/** A list without its hidden covers. */
export function withoutHiddenCovers<T extends { id: string }>(covers: readonly T[]): T[] {
  return hidden.size === 0 ? [...covers] : covers.filter(c => !hidden.has(c.id));
}
